use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde::Serialize;
use std::fs;

const LOG_FILE_PATH: &str = "log/app.log";

#[derive(Serialize)]
struct LogResponse {
    logs: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}


pub async fn get_logs_handler() -> Response {
    match fs::read_to_string(LOG_FILE_PATH) {
        Ok(logs) => {
            let response = LogResponse { logs };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            let error_response = ErrorResponse {
                error: format!("Could not read log file: {}", e),
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error_response)).into_response()
        }
    }
}