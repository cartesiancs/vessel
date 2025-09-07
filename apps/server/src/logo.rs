use local_ip_address::local_ip;
use std::error::Error;

use colored::*;

const LOGO: &str = r#"
 __      __                _ 
 \ \    / /               | |
  \ \  / /__  ___ ___  ___| |
   \ \/ / _ \/ __/ __|/ _ \ |
    \  /  __/\__ \__ \  __/ |
     \/ \___||___/___/\___|_|
                             
"#;

pub fn print_header() {
    println!("{}", LOGO.truecolor(0, 150, 255).bold());
    println!("{}", "------------------------------------".yellow());
}

pub fn print_footer() {
    println!("{}", "------------------------------------".yellow());
}

pub fn print_local_ip_info(ip: &str, port: &str) {
    println!(
        "{} {}:{}",
        "Local IP:".green().bold(),
        ip.cyan(),
        port.cyan()
    );
}

pub fn print_error(message: &str) {
    println!("{} {}", "❌ Error:".red().bold(), message.red());
}

pub fn get_local_ip_address() -> Result<String, Box<dyn Error>> {
    let ip = local_ip()?.to_string();
    Ok(ip)
}

pub fn print_logo() {
    print_header();

    match get_local_ip_address() {
        Ok(ip) => print_local_ip_info(&ip, &"8080".to_string()),
        Err(e) => print_error(&format!("Could not fetch local IP: {}", e)),
    }

    print_footer();
}
