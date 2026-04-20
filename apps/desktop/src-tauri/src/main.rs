#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime},
};

use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, Wry,
};
use tauri_plugin_prevent_default::{Builder as PreventBuilder, KeyboardShortcut};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::{process::CommandEvent, ShellExt};

const DEFAULT_LISTEN: &str = "0.0.0.0:6174";
const CONFIG_FILE: &str = "config.toml";
const SETTINGS_QUERY: &str = "index.html?view=desktop_settings";

#[derive(Default)]
struct SidecarManager {
    child: Mutex<Option<CommandChild>>,
    workdir: Mutex<Option<PathBuf>>,
    restart_lock: Mutex<()>,
    terminated_flag: Arc<Mutex<bool>>,
    last_stderr: Arc<Mutex<String>>,
    status_item: Mutex<Option<MenuItem<Wry>>>,
    toggle_item: Mutex<Option<MenuItem<Wry>>>,
}

#[derive(Serialize, Clone)]
struct SidecarStatus {
    running: bool,
    base_url: Option<String>,
    listen_address: String,
    working_dir: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ServerAddress {
    host: String,
    port: u16,
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

fn write_listen_address(workdir: &Path, listen: &str) -> Result<(), String> {
    let config_path = workdir.join(CONFIG_FILE);
    let mut doc: toml::Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        toml::from_str(&content).map_err(|e| e.to_string())?
    } else {
        toml::Value::Table(toml::value::Table::new())
    };

    if let toml::Value::Table(ref mut table) = doc {
        table.insert(
            "listen_address".to_string(),
            toml::Value::String(listen.to_string()),
        );
    } else {
        return Err("Unexpected config.toml shape".into());
    }

    let serialized = toml::to_string(&doc).map_err(|e| e.to_string())?;
    let tmp = config_path.with_extension("toml.tmp");
    fs::write(&tmp, serialized).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &config_path).map_err(|e| e.to_string())?;
    Ok(())
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

fn parse_listen(listen: &str) -> ServerAddress {
    let cleaned = listen
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .to_string();

    let (host, port) = match cleaned.rsplit_once(':') {
        Some((h, p)) => (h.to_string(), p.parse::<u16>().unwrap_or(6174)),
        None => (cleaned, 6174),
    };

    ServerAddress { host, port }
}

fn build_status(state: &SidecarManager, workdir: &Path) -> SidecarStatus {
    let listen = read_listen_address(workdir).unwrap_or_else(|| DEFAULT_LISTEN.to_string());
    let base_url = Some(base_url_from_listen(&listen));

    let child_guard = state.child.lock().unwrap();
    let running = child_guard.is_some();

    SidecarStatus {
        running,
        base_url,
        listen_address: listen,
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

    *state.terminated_flag.lock().unwrap() = false;
    state.last_stderr.lock().unwrap().clear();

    // Resolve bundled library paths relative to the app bundle
    let resource_dir = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
    let libs_dir = resource_dir.join("libs");
    let gst_plugins_dir = resource_dir.join("gstreamer-1.0");
    let gst_helpers_dir = gst_plugins_dir.join("helpers");

    // Build DYLD_FALLBACK_LIBRARY_PATH: bundled libs first, then system fallbacks
    let mut dyld_paths: Vec<String> = vec![libs_dir.display().to_string()];

    // In development mode, also add Homebrew paths as fallbacks
    #[cfg(debug_assertions)]
    {
        dyld_paths.extend([
            "/opt/homebrew/opt/sqlite/lib".to_string(),
            "/opt/homebrew/opt/libiconv/lib".to_string(),
            "/opt/homebrew/lib".to_string(),
            "/usr/local/lib".to_string(),
        ]);
    }

    dyld_paths.extend(["/usr/local/lib".to_string(), "/usr/lib".to_string()]);

    let mut envs = std::collections::HashMap::new();
    envs.insert(
        "DYLD_FALLBACK_LIBRARY_PATH".to_string(),
        dyld_paths.join(":"),
    );

    // GStreamer environment: tell GStreamer where to find plugins and helpers
    envs.insert(
        "GST_PLUGIN_PATH".to_string(),
        gst_plugins_dir.display().to_string(),
    );
    envs.insert(
        "GST_PLUGIN_SYSTEM_PATH".to_string(),
        gst_plugins_dir.display().to_string(),
    );
    envs.insert(
        "GST_PLUGIN_SCANNER".to_string(),
        gst_helpers_dir
            .join("gst-plugin-scanner")
            .display()
            .to_string(),
    );
    // Write GStreamer registry cache to a writable location
    envs.insert(
        "GST_REGISTRY".to_string(),
        workdir.join("gst-registry.bin").display().to_string(),
    );

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
    let terminated_flag = state.terminated_flag.clone();
    let stderr_buf = state.last_stderr.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Terminated(payload) => {
                    write_log(&sidecar_log2, &format!("terminated: {:?}", payload));
                    *terminated_flag.lock().unwrap() = true;
                }
                CommandEvent::Error(err) => {
                    write_log(&sidecar_log2, &format!("error: {}", err));
                }
                CommandEvent::Stdout(line) => {
                    write_log(&sidecar_log2, &format!("stdout: {}", bytes_to_line(line)));
                }
                CommandEvent::Stderr(line) => {
                    let text = bytes_to_line(line);
                    write_log(&sidecar_log2, &format!("stderr: {}", text));
                    let mut buf = stderr_buf.lock().unwrap();
                    buf.push_str(&text);
                    buf.push('\n');
                }
                _ => {}
            }
        }
    });

    *state.child.lock().unwrap() = Some(child);
    Ok(())
}

fn stop_sidecar_internal(state: &SidecarManager) -> Result<(), String> {
    if let Some(child) = state.child.lock().unwrap().take() {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn update_tray_status(app: &AppHandle, status: &SidecarStatus) {
    let state = app.state::<SidecarManager>();
    let item = state.status_item.lock().unwrap().clone();
    if let Some(item) = item {
        let text = if status.running {
            format!("Server: Running ({})", status.listen_address)
        } else {
            format!("Server: Stopped ({})", status.listen_address)
        };
        let _ = item.set_text(text);
    }
}

fn update_tray_toggle(app: &AppHandle) {
    let state = app.state::<SidecarManager>();
    let item = state.toggle_item.lock().unwrap().clone();
    if let Some(item) = item {
        if let Some(window) = app.get_webview_window("main") {
            let visible = window.is_visible().unwrap_or(true);
            let _ = item.set_text(if visible { "Hide Vessel" } else { "Show Vessel" });
        }
    }
}

#[tauri::command]
fn get_sidecar_status(
    app: AppHandle,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    let status = build_status(&state, &workdir);
    update_tray_status(&app, &status);
    Ok(status)
}

#[tauri::command]
fn start_sidecar(
    app: AppHandle,
    state: State<'_, SidecarManager>,
) -> Result<SidecarStatus, String> {
    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    start_server_sidecar(&app, &state, &workdir).map_err(|e| e.to_string())?;
    let status = build_status(&state, &workdir);
    update_tray_status(&app, &status);
    Ok(status)
}

#[tauri::command]
fn stop_sidecar(app: AppHandle, state: State<'_, SidecarManager>) -> Result<(), String> {
    stop_sidecar_internal(&state)?;
    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    let status = build_status(&state, &workdir);
    update_tray_status(&app, &status);
    Ok(())
}

#[tauri::command]
fn get_server_address(
    app: AppHandle,
    state: State<'_, SidecarManager>,
) -> Result<ServerAddress, String> {
    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    let listen = read_listen_address(&workdir).unwrap_or_else(|| DEFAULT_LISTEN.to_string());
    Ok(parse_listen(&listen))
}

#[tauri::command]
fn update_server_address(
    app: AppHandle,
    state: State<'_, SidecarManager>,
    host: String,
    port: u16,
) -> Result<SidecarStatus, String> {
    let host = host.trim().to_string();
    if host.is_empty() {
        return Err("Host must not be empty".into());
    }
    if port == 0 {
        return Err("Port must be between 1 and 65535".into());
    }

    let _guard = state
        .restart_lock
        .lock()
        .map_err(|_| "restart lock poisoned".to_string())?;

    let workdir = ensure_workdir(&app, &state).map_err(|e| e.to_string())?;
    let previous = read_listen_address(&workdir).unwrap_or_else(|| DEFAULT_LISTEN.to_string());
    let new_listen = format!("{}:{}", host, port);

    if new_listen == previous {
        let status = build_status(&state, &workdir);
        update_tray_status(&app, &status);
        return Ok(status);
    }

    write_listen_address(&workdir, &new_listen)?;
    stop_sidecar_internal(&state)?;
    // Give the OS a moment to release the previous bind
    std::thread::sleep(Duration::from_millis(300));

    if let Err(err) = start_server_sidecar(&app, &state, &workdir) {
        let _ = write_listen_address(&workdir, &previous);
        let _ = start_server_sidecar(&app, &state, &workdir);
        let status = build_status(&state, &workdir);
        update_tray_status(&app, &status);
        return Err(format!("Failed to restart sidecar: {}", err));
    }

    // Wait briefly to detect bind failures
    std::thread::sleep(Duration::from_millis(900));

    let terminated = *state.terminated_flag.lock().unwrap();
    let stderr_text = state.last_stderr.lock().unwrap().clone();
    let lower = stderr_text.to_ascii_lowercase();
    let bind_failed = lower.contains("address already in use")
        || lower.contains("permission denied")
        || lower.contains("failed to bind")
        || lower.contains("cannot assign requested address");

    if terminated || bind_failed {
        let _ = stop_sidecar_internal(&state);
        let _ = write_listen_address(&workdir, &previous);
        let _ = start_server_sidecar(&app, &state, &workdir);
        let status = build_status(&state, &workdir);
        update_tray_status(&app, &status);
        let detail = if bind_failed {
            stderr_text
                .lines()
                .last()
                .unwrap_or("bind failed")
                .to_string()
        } else {
            "sidecar terminated".to_string()
        };
        return Err(format!("Failed to bind {}: {}", new_listen, detail));
    }

    let status = build_status(&state, &workdir);
    update_tray_status(&app, &status);
    let _ = app.emit("sidecar-restarted", &status);
    Ok(status)
}

#[tauri::command]
fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "settings",
        WebviewUrl::App(SETTINGS_QUERY.into()),
    )
    .title("Vessel Server Settings")
    .inner_size(440.0, 320.0)
    .min_inner_size(440.0, 320.0)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn build_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let toggle = MenuItem::with_id(app, "toggle", "Hide Vessel", true, None::<&str>)?;
    let status = MenuItem::with_id(app, "status", "Server: \u{2026}", false, None::<&str>)?;
    let settings = MenuItem::with_id(
        app,
        "settings",
        "Server Settings\u{2026}",
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit Vessel", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[&toggle, &sep1, &status, &settings, &sep2, &quit],
    )?;

    {
        let mgr = app.state::<SidecarManager>();
        *mgr.status_item.lock().unwrap() = Some(status.clone());
        *mgr.toggle_item.lock().unwrap() = Some(toggle.clone());
    }

    let icon_path = app.path().resource_dir().ok().and_then(|d| {
        let candidate = d.join("icons/tray-template.png");
        if candidate.exists() {
            Some(candidate)
        } else {
            None
        }
    });

    let icon = if let Some(path) = icon_path {
        Image::from_path(path)?
    } else {
        app.default_window_icon()
            .cloned()
            .ok_or("missing default window icon")?
    };

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle" => {
                if let Some(window) = app.get_webview_window("main") {
                    let visible = window.is_visible().unwrap_or(false);
                    if visible {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    update_tray_toggle(app);
                }
            }
            "settings" => {
                let _ = open_settings_window(app.clone());
            }
            "quit" => {
                if let Some(child) = app
                    .state::<SidecarManager>()
                    .child
                    .lock()
                    .unwrap()
                    .take()
                {
                    let _ = child.kill();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                update_tray_toggle(tray.app_handle());
            }
        })
        .build(app)?;

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
        .on_window_event(|window, event| {
            // Hide the main window instead of closing so the tray remains useful.
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                    update_tray_toggle(window.app_handle());
                }
            }
        })
        .setup(|app| {
            for window in app.webview_windows().values() {
                let _ = window.eval(PREVENT_NAV_JS);
            }

            #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let app_handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    let _ = app_handle.emit("deep-link-opened", urls);
                });
            }

            let handle = app.handle().clone();
            let state = app.state::<SidecarManager>();
            let workdir = ensure_workdir(&handle, &state)?;
            start_server_sidecar(&handle, &state, &workdir)?;

            build_tray(&handle)?;

            let status = build_status(&state, &workdir);
            update_tray_status(&handle, &status);
            update_tray_toggle(&handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sidecar_status,
            start_sidecar,
            stop_sidecar,
            get_server_address,
            update_server_address,
            open_settings_window
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(child) = app.state::<SidecarManager>().child.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
