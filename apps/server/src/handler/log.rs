use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::{fs, io, path::PathBuf};

use crate::handler::auth::AuthUser;

const LOG_DIR: &str = "log";

#[derive(Serialize)]
struct LogContentResponse {
    filename: String,
    logs: String,
}

#[derive(Serialize)]
struct LogFileListResponse {
    files: Vec<String>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn get_log_files() -> io::Result<Vec<String>> {
    let mut files = fs::read_dir(LOG_DIR)?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() {
                path.file_name()?.to_str().map(String::from)
            } else {
                None
            }
        })
        .collect::<Vec<String>>();

    files.sort_by(|a, b| b.cmp(a));
    Ok(files)
}

fn read_log_file_content(filename: &str) -> Result<String, io::Error> {
    if filename.contains('/') || filename.contains("..") {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid filename provided.",
        ));
    }

    let path = PathBuf::from(LOG_DIR).join(filename);
    let contents = fs::read_to_string(path)?;
    Ok(contents.lines().rev().collect::<Vec<&str>>().join("\n"))
}

pub async fn get_latest_log_handler(AuthUser(_user): AuthUser) -> Response {
    match get_log_files() {
        Ok(files) => {
            if let Some(latest_file) = files.first() {
                get_log_by_filename_handler(AuthUser(_user), Path(latest_file.clone())).await
            } else {
                let error_response = ErrorResponse {
                    error: "No log files found.".to_string(),
                };
                (StatusCode::NOT_FOUND, Json(error_response)).into_response()
            }
        }
        Err(e) => {
            let error_response = ErrorResponse {
                error: format!("Could not read log directory: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
        }
    }
}

pub async fn list_log_files_handler(AuthUser(_user): AuthUser) -> Response {
    match get_log_files() {
        Ok(files) => {
            let response = LogFileListResponse { files };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            let error_response = ErrorResponse {
                error: format!("Could not read log directory: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
        }
    }
}

pub async fn get_log_by_filename_handler(
    AuthUser(_user): AuthUser,
    Path(filename): Path<String>,
) -> Response {
    match read_log_file_content(&filename) {
        Ok(logs) => {
            let response = LogContentResponse { filename, logs };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            let (status, error_message) = match e.kind() {
                io::ErrorKind::NotFound => (
                    StatusCode::NOT_FOUND,
                    format!("Log file '{}' not found.", filename),
                ),
                io::ErrorKind::InvalidInput => (StatusCode::BAD_REQUEST, e.to_string()),
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Could not read log file '{}': {}", filename, e),
                ),
            };
            let error_response = ErrorResponse {
                error: error_message,
            };
            (status, Json(error_response)).into_response()
        }
    }
}
