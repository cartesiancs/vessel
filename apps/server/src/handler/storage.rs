// src/handler/storage_handler.rs

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path as StdPath, PathBuf},
    sync::Arc,
};

use crate::handler::auth::AuthUser;

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Serialize)]
struct SuccessResponse {
    message: String,
}

#[derive(Deserialize)]
pub struct UpdateContentRequest {
    content: String,
}

#[derive(Deserialize)]
pub struct RenameRequest {
    to: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    is_dir: bool,
}

#[derive(Serialize)]
pub struct ListResponse {
    path: String,
    entries: Vec<DirEntry>,
}

fn get_storage_root() -> io::Result<PathBuf> {
    let storage_path = std::env::current_dir()?.join("storage");
    fs::create_dir_all(&storage_path)?;
    Ok(storage_path)
}

fn get_safe_path(root: &StdPath, user_path: &str) -> Result<PathBuf, io::Error> {
    let path = user_path.trim_start_matches('/');
    let safe_path = root.join(path);

    if safe_path.ancestors().any(|a| a == StdPath::new("..")) || !safe_path.starts_with(root) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Path traversal attempt detected",
        ));
    }
    Ok(safe_path)
}

fn map_io_error(e: io::Error, path_str: &str) -> Response {
    let (status, msg) = match e.kind() {
        io::ErrorKind::NotFound => (
            StatusCode::NOT_FOUND,
            format!("Path not found: {}", path_str),
        ),
        io::ErrorKind::PermissionDenied => (
            StatusCode::FORBIDDEN,
            format!("Permission denied for: {}", path_str),
        ),
        io::ErrorKind::InvalidInput => (StatusCode::BAD_REQUEST, e.to_string()),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internal server error for: {}. Details: {}", path_str, e),
        ),
    };
    (status, Json(ErrorResponse { error: msg })).into_response()
}

pub async fn read_handler(AuthUser(_user): AuthUser, path: Option<Path<String>>) -> Response {
    let path_str = path.map_or(String::new(), |p| p.0);

    let storage_root = match get_storage_root() {
        Ok(r) => r,
        Err(e) => return map_io_error(e, &path_str),
    };
    let safe_path = match get_safe_path(&storage_root, &path_str) {
        Ok(p) => p,
        Err(e) => return map_io_error(e, &path_str),
    };

    if safe_path.is_dir() {
        list_dir_contents(&safe_path, &path_str).await
    } else {
        read_file_content(&safe_path, &path_str).await
    }
}

async fn list_dir_contents(path: &PathBuf, user_path: &str) -> Response {
    match fs::read_dir(path) {
        Ok(entries) => {
            let mut dir_entries = Vec::new();
            for entry in entries {
                if let Ok(entry) = entry {
                    dir_entries.push(DirEntry {
                        name: entry.file_name().to_string_lossy().to_string(),
                        is_dir: entry.path().is_dir(),
                    });
                }
            }
            (
                StatusCode::OK,
                Json(ListResponse {
                    path: user_path.to_string(),
                    entries: dir_entries,
                }),
            )
                .into_response()
        }
        Err(e) => map_io_error(e, user_path),
    }
}

async fn read_file_content(path: &PathBuf, user_path: &str) -> Response {
    match fs::read_to_string(path) {
        Ok(content) => (StatusCode::OK, content).into_response(),
        Err(e) => map_io_error(e, user_path),
    }
}

pub async fn create_or_update_file_handler(
    AuthUser(_user): AuthUser,
    Path(path): Path<String>,
    Json(payload): Json<UpdateContentRequest>,
) -> Response {
    let storage_root = match get_storage_root() {
        Ok(r) => r,
        Err(e) => return map_io_error(e, &path),
    };
    let safe_path = match get_safe_path(&storage_root, &path) {
        Ok(p) => p,
        Err(e) => return map_io_error(e, &path),
    };

    if let Some(parent) = safe_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return map_io_error(e, &path);
        }
    }

    match fs::write(&safe_path, payload.content) {
        Ok(_) => {
            let message = if safe_path.exists() {
                "File updated successfully"
            } else {
                "File created successfully"
            };
            (
                StatusCode::OK,
                Json(SuccessResponse {
                    message: message.to_string(),
                }),
            )
                .into_response()
        }
        Err(e) => map_io_error(e, &path),
    }
}

pub async fn create_dir_handler(AuthUser(_user): AuthUser, Path(path): Path<String>) -> Response {
    let storage_root = match get_storage_root() {
        Ok(r) => r,
        Err(e) => return map_io_error(e, &path),
    };
    let safe_path = match get_safe_path(&storage_root, &path) {
        Ok(p) => p,
        Err(e) => return map_io_error(e, &path),
    };

    match fs::create_dir_all(&safe_path) {
        Ok(_) => (
            StatusCode::CREATED,
            Json(SuccessResponse {
                message: "Directory created successfully".to_string(),
            }),
        )
            .into_response(),
        Err(e) => map_io_error(e, &path),
    }
}

pub async fn delete_handler(AuthUser(_user): AuthUser, Path(path): Path<String>) -> Response {
    let storage_root = match get_storage_root() {
        Ok(r) => r,
        Err(e) => return map_io_error(e, &path),
    };
    let safe_path = match get_safe_path(&storage_root, &path) {
        Ok(p) => p,
        Err(e) => return map_io_error(e, &path),
    };

    let result = if safe_path.is_dir() {
        fs::remove_dir_all(&safe_path)
    } else {
        fs::remove_file(&safe_path)
    };

    match result {
        Ok(_) => (
            StatusCode::OK,
            Json(SuccessResponse {
                message: "Item deleted successfully".to_string(),
            }),
        )
            .into_response(),
        Err(e) => map_io_error(e, &path),
    }
}

pub async fn rename_handler(
    AuthUser(_user): AuthUser,
    Path(from_path): Path<String>,
    Json(payload): Json<RenameRequest>,
) -> Response {
    let storage_root = match get_storage_root() {
        Ok(r) => r,
        Err(e) => return map_io_error(e, &from_path),
    };
    let safe_from_path = match get_safe_path(&storage_root, &from_path) {
        Ok(p) => p,
        Err(e) => return map_io_error(e, &from_path),
    };
    let safe_to_path = match get_safe_path(&storage_root, &payload.to) {
        Ok(p) => p,
        Err(e) => return map_io_error(e, &payload.to),
    };

    if !safe_from_path.exists() {
        return map_io_error(
            io::Error::new(io::ErrorKind::NotFound, "Source path does not exist"),
            &from_path,
        );
    }

    match fs::rename(&safe_from_path, &safe_to_path) {
        Ok(_) => (
            StatusCode::OK,
            Json(SuccessResponse {
                message: "Item renamed successfully".to_string(),
            }),
        )
            .into_response(),
        Err(e) => map_io_error(e, &from_path),
    }
}
