#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::SystemTime,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_prevent_default::{Builder as PreventBuilder, KeyboardShortcut};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

const DEFAULT_LISTEN: &str = "0.0.0.0:8080";
const CONFIG_FILE: &str = "config.toml";

#[derive(Default)]
struct SidecarManager {
    child: Mutex<Option<CommandChild>>,
    workdir: Mutex<Option<PathBuf>>,
}

#[derive(Serialize)]
struct SidecarStatus {
    running: bool,
    base_url: Option<String>,
    working_dir: String,
}

fn ensure_workdir(
    app: &AppHandle,
    state: &SidecarManager,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut guard = state.workdir.lock().unwrap();
    if let Some(existing) = guard.clone() {
        return Ok(existing);
    }

    let resolver = app.path();
    let base = resolver.app_data_dir().unwrap_or(std::env::current_dir()?);

    fs::create_dir_all(&base)?;
    fs::create_dir_all(base.join("log"))?;

    *guard = Some(base.clone());
    Ok(base)
}

fn read_listen_address(workdir: &Path) -> Option<String> {
    let config_path = workdir.join(CONFIG_FILE);
    if !config_path.exists() {
        return None;
    }

    let content = fs::read_to_string(config_path).ok()?;
    let parsed: toml::Value = toml::from_str(&content).ok()?;
    parsed
        .get("listen_address")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn base_url_from_listen(listen: &str) -> String {
    let mut value = listen
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();

    if let Some(port) = value.strip_prefix("0.0.0.0:") {
        value = format!("127.0.0.1:{}", port);
    }

    if value.starts_with("127.0.0.1:") || value.starts_with("localhost:") {
        format!("http://{}", value)
    } else if value.contains("://") {
        value
    } else {
        format!("http://{}", value)
    }
}

fn build_status(state: &SidecarManager, workdir: &Path) -> SidecarStatus {
    let listen = read_listen_address(workdir).unwrap_or_else(|| DEFAULT_LISTEN.to_string());
    let base_url = Some(base_url_from_listen(&listen));

    let child_guard = state.child.lock().unwrap();
    let running = child_guard.is_some();

    SidecarStatus {
        running,
        base_url,
        working_dir: workdir.display().to_string(),
    }
}

fn write_log(path: &Path, msg: &str) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{:?}] {}", SystemTime::now(), msg);
    }
}

fn bytes_to_line(bytes: Vec<u8>) -> String {
    String::from_utf8_lossy(&bytes).trim_end().to_string()
}

fn start_server_sidecar(
    app: &AppHandle,
    state: &SidecarManager,
    workdir: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    {
        let guard = state.child.lock().unwrap();
        if guard.is_some() {
            return Ok(());
        }
    }

    let extra_paths = [
        "/opt/homebrew/opt/python@3.12/Frameworks/Python.framework/Versions/3.12/lib",
        "/opt/homebrew/opt/sqlite/lib",
        "/opt/homebrew/opt/libiconv/lib",
    ];
    let default_fallbacks = ["/usr/local/lib", "/usr/lib"];
    let fallback = std::env::var("DYLD_FALLBACK_LIBRARY_PATH").unwrap_or_default();
    let mut merged: Vec<String> = fallback
        .split(':')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();
    for path in extra_paths.iter().chain(default_fallbacks.iter()) {
        if !merged.iter().any(|p| p == path) {
            merged.push(path.to_string());
        }
    }
    let merged_fallback = merged.join(":");

    let mut envs = std::collections::HashMap::new();
    envs.insert("DYLD_FALLBACK_LIBRARY_PATH".to_string(), merged_fallback);

    let sidecar_log = workdir.join("log/sidecar.log");
    write_log(
        &sidecar_log,
        &format!("Spawning server sidecar in {}", workdir.display()),
    );

    let command = app
        .shell()
        .sidecar("server")?
        .current_dir(workdir.to_path_buf())
        .envs(envs);

    let (mut rx, child) = command.spawn()?;
    write_log(
        &sidecar_log,
        &format!("Server sidecar started with pid {:?}", child.pid()),
    );

    let sidecar_log2 = sidecar_log.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Terminated(payload) => {
                    write_log(&sidecar_log2, &format!("terminated: {:?}", payload));
                }
                CommandEvent::Error(err) => {
                    write_log(&sidecar_log2, &format!("error: {}", err));
                }
                CommandEvent::Stdout(line) => {
                    write_log(&sidecar_log2, &format!("stdout: {}", bytes_to_line(line)));
                }
                CommandEvent::Stderr(line) => {
                    write_log(&sidecar_log2, &format!("stderr: {}", bytes_to_line(line)));
                }
                _ => {}
            }
        }
    });

    *state.child.lock().unwrap() = Some(child);
    Ok(())
}

#[tauri::command]
fn get_sidecar_status(
    app: AppHandle,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    Ok(build_status(&state, &workdir))
}

#[tauri::command]
fn start_sidecar(
    app: AppHandle,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    start_server_sidecar(&app, &state, &workdir).map_err(|e| e.to_string())?;
    Ok(build_status(&state, &workdir))
}

#[tauri::command]
fn stop_sidecar(state: State<'_, SidecarManager>) -> Result<(), String> {
    if let Some(child) = state.child.lock().unwrap().take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    // JS snippet that blocks Backspace navigation while allowing edits in inputs/contentEditable.
    // Runs for every webview we create.
    const PREVENT_NAV_JS: &str = r#"
      const shouldAllowBackspace = (event) => {
        const path = event.composedPath ? event.composedPath() : [event.target];
        return path.some((el) => {
          if (!el || !el.tagName) return false;
          const tag = el.tagName.toUpperCase();
          const dataset = el.dataset || {};
          if (dataset.allowBackspace === 'true') return true;
          return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA';
        });
      };

      const preventBackNavigation = (e) => {
        if (e.key !== 'Backspace') return;
        if (shouldAllowBackspace(e)) return;
        e.preventDefault();
        e.stopPropagation();
      };

      window.addEventListener('keydown', preventBackNavigation, { capture: true });
    "#;

    tauri::Builder::default()
        .manage(SidecarManager::default())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            PreventBuilder::new()
                // Block browser back/forward shortcuts
                .shortcut(KeyboardShortcut::new("Alt+Left"))
                .shortcut(KeyboardShortcut::new("Alt+Right"))
                .build(),
        )
        .on_page_load(|window, _| {
            let _ = window.eval(PREVENT_NAV_JS);
        })
        .setup(|app| {
            // Inject navigation guard script into all existing webviews and re-apply after page loads.
            for window in app.webview_windows().values() {
                let _ = window.eval(PREVENT_NAV_JS);
            }

            // Register deep link handler for OAuth callback
            #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    let _ = app_handle.emit("deep-link-opened", urls);
                });
            }

            // Start the server sidecar.
            let handle = app.handle().clone();
            let state = app.state::<SidecarManager>();
            let workdir = ensure_workdir(&handle, &state)?;
            start_server_sidecar(&handle, &state, &workdir)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sidecar_status,
            start_sidecar,
            stop_sidecar
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
