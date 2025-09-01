use std::process::Command;
use std::env;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    if let Ok(profile) = env::var("PROFILE") {
        if profile == "release" {
            let client_dir = std::path::Path::new("../../apps/client");

            println!("cargo:warning=Running 'npm run build' in ../../apps/client...");
            let output = Command::new("npm")
                .arg("run")
                .arg("build")
                .current_dir(&client_dir)
                .output()?;
            
            if !output.status.success() {
                panic!("npm run build failed: {}", String::from_utf8_lossy(&output.stderr));
            }
        }
    }

    Ok(())
}