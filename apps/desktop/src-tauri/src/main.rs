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
use tauri::api::process::{Command, CommandChild, CommandEvent};
use tauri::{AppHandle, Manager, State};

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

fn ensure_workdir(app: &AppHandle, state: &SidecarManager) -> tauri::Result<PathBuf> {
    let mut guard = state.workdir.lock().unwrap();
    if let Some(existing) = guard.clone() {
        return Ok(existing);
    }

    let resolver = app.path_resolver();
    let base = resolver
        .app_data_dir()
        .or_else(|| resolver.app_config_dir())
        .unwrap_or(std::env::current_dir()?);

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

fn start_server_sidecar(
    _app: &AppHandle,
    state: &SidecarManager,
    workdir: &Path,
) -> tauri::Result<()> {
    {
        let guard = state.child.lock().unwrap();
        if guard.is_some() {
            return Ok(());
        }
    }

    let mut command = Command::new_sidecar("server")?;

    // Ensure dynamic libs like libpython / libsqlite are discoverable when launched from the app data dir.
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
    for path in extra_paths
        .iter()
        .chain(default_fallbacks.iter())
    {
        if !merged.iter().any(|p| p == path) {
            merged.push(path.to_string());
        }
    }
    let merged_fallback = merged.join(":");

    let mut envs = std::collections::HashMap::new();
    envs.insert(
        "DYLD_FALLBACK_LIBRARY_PATH".to_string(),
        merged_fallback,
    );

    let sidecar_log = workdir.join("log/sidecar.log");
    write_log(
        &sidecar_log,
        &format!(
            "Spawning server sidecar in {}",
            workdir.display()
        ),
    );

    command = command
        .current_dir(workdir.to_path_buf())
        .envs(envs);

    let (mut rx, child) = command.spawn()?;
    write_log(
        &sidecar_log,
        &format!("Server sidecar started with pid {:?}", child.pid()),
    );

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Terminated(payload) => {
                    println!("Server sidecar terminated: {:?}", payload);
                }
                CommandEvent::Error(err) => {
                    eprintln!("Server sidecar error: {}", err);
                    write_log(&sidecar_log, &format!("Error: {}", err));
                }
                CommandEvent::Stdout(line) => {
                    write_log(&sidecar_log, &format!("stdout: {}", line));
                }
                CommandEvent::Stderr(line) => {
                    write_log(&sidecar_log, &format!("stderr: {}", line));
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
    use tauri::App;

    tauri::Builder::default()
        .manage(SidecarManager::default())
        .invoke_handler(tauri::generate_handler![
            get_sidecar_status,
            start_sidecar,
            stop_sidecar
        ])
        .setup(|app: &mut App| {
            let handle = app.handle();
            let state = app.state::<SidecarManager>();
            let workdir = ensure_workdir(&handle, &state)?;
            start_server_sidecar(&handle, &state, &workdir)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
