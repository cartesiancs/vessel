use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let target_triple = env::var("TARGET").unwrap_or_default();
    let target_dir = manifest_dir.join("../../../target/release");
    let base_bin = target_dir.join("server");
    let suffixed_bin = target_dir.join(format!("server-{}", target_triple));

    if base_bin.exists() && !suffixed_bin.exists() {
        if let Err(err) = fs::copy(&base_bin, &suffixed_bin) {
            eprintln!("Warning: failed to copy sidecar binary: {}", err);
        }
    }

    tauri_build::build()
}
