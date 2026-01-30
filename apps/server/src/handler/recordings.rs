use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;
use tracing::{error, info, warn};

use crate::db::models::Recording;
use crate::db::repository::recordings as recordings_repo;
use crate::handler::auth::AuthUser;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct StartRecordingRequest {
    pub topic: String,
}

#[derive(Serialize)]
pub struct StartRecordingResponse {
    pub id: i32,
    pub topic: String,
    pub status: String,
}

#[derive(Deserialize)]
pub struct ListRecordingsQuery {
    pub topic: Option<String>,
    pub status: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Serialize)]
pub struct RecordingResponse {
    pub id: i32,
    pub stream_ssrc: i32,
    pub topic: String,
    pub device_id: String,
    pub media_type: String,
    pub filename: String,
    pub file_path: String,
    pub file_size: i32,
    pub duration_ms: i32,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub created_by_user_id: Option<i32>,
}

impl From<Recording> for RecordingResponse {
    fn from(r: Recording) -> Self {
        RecordingResponse {
            id: r.id,
            stream_ssrc: r.stream_ssrc,
            topic: r.topic,
            device_id: r.device_id,
            media_type: r.media_type,
            filename: r.filename,
            file_path: r.file_path,
            file_size: r.file_size,
            duration_ms: r.duration_ms,
            status: r.status,
            started_at: r.started_at.to_string(),
            ended_at: r.ended_at.map(|dt| dt.to_string()),
            created_by_user_id: r.created_by_user_id,
        }
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Serialize)]
struct ActiveRecordingInfo {
    topic: String,
    recording_id: i32,
}

pub async fn start_recording(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
    Json(payload): Json<StartRecordingRequest>,
) -> impl IntoResponse {
    info!("Starting recording for topic: {}", payload.topic);

    match state
        .recording_manager
        .start_recording(&payload.topic, Some(user.id))
    {
        Ok(recording_id) => {
            info!(
                "Recording started successfully: id={}, topic={}",
                recording_id, payload.topic
            );
            (
                StatusCode::CREATED,
                Json(StartRecordingResponse {
                    id: recording_id,
                    topic: payload.topic,
                    status: "recording".to_string(),
                }),
            )
                .into_response()
        }
        Err(e) => {
            error!("Failed to start recording: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
                .into_response()
        }
    }
}

pub async fn stop_recording(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    info!("Stopping recording: id={}", id);

    match state.recording_manager.stop_recording(id) {
        Ok(()) => {
            info!("Recording stopped successfully: id={}", id);
            (
                StatusCode::OK,
                Json(serde_json::json!({"message": "Recording stopped"})),
            )
                .into_response()
        }
        Err(e) => {
            error!("Failed to stop recording: {}", e);
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
                .into_response()
        }
    }
}

pub async fn list_recordings(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Query(query): Query<ListRecordingsQuery>,
) -> impl IntoResponse {
    let recordings = if let Some(topic) = &query.topic {
        recordings_repo::get_recordings_by_topic(&state.pool, topic)
    } else if let Some(status) = &query.status {
        recordings_repo::get_recordings_by_status(&state.pool, status)
    } else {
        recordings_repo::get_all_recordings(&state.pool)
    };

    match recordings {
        Ok(recs) => {
            let response: Vec<RecordingResponse> = recs.into_iter().map(Into::into).collect();
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!("Failed to list recordings: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
                .into_response()
        }
    }
}

pub async fn get_recording(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    match recordings_repo::get_recording_by_id(&state.pool, id) {
        Ok(recording) => {
            let response: RecordingResponse = recording.into();
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!("Failed to get recording {}: {}", id, e);
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Recording not found: {}", id),
                }),
            )
                .into_response()
        }
    }
}

pub async fn delete_recording(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> impl IntoResponse {
    // Get recording to find file path
    let recording = match recordings_repo::get_recording_by_id(&state.pool, id) {
        Ok(r) => r,
        Err(e) => {
            error!("Failed to get recording for deletion {}: {}", id, e);
            return (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Recording not found: {}", id),
                }),
            )
                .into_response();
        }
    };

    // Store file path before DB deletion
    let file_path = recording.file_path.clone();

    // Delete from database FIRST (prevents orphan records if file deletion fails)
    // An orphan file is preferable to an orphan DB record
    match recordings_repo::delete_recording(&state.pool, id) {
        Ok(_) => {
            info!("Recording deleted from database: id={}", id);

            // Delete file if exists (after DB deletion succeeded)
            if std::path::Path::new(&file_path).exists() {
                if let Err(e) = std::fs::remove_file(&file_path) {
                    // Log warning but don't fail - DB record is already gone
                    // Orphan file may remain but that's better than orphan record
                    warn!(
                        "Failed to delete recording file (orphan file left): path={}, error={}",
                        file_path, e
                    );
                }
            }

            (
                StatusCode::OK,
                Json(serde_json::json!({"message": "Recording deleted"})),
            )
                .into_response()
        }
        Err(e) => {
            error!("Failed to delete recording from database: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: e.to_string(),
                }),
            )
                .into_response()
        }
    }
}

pub async fn stream_recording(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
    headers: HeaderMap,
) -> Response {
    // Get recording metadata
    let recording = match recordings_repo::get_recording_by_id(&state.pool, id) {
        Ok(r) => r,
        Err(e) => {
            error!("Failed to get recording for streaming {}: {}", id, e);
            return (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Recording not found: {}", id),
                }),
            )
                .into_response();
        }
    };

    // Check if file exists
    let file_path = std::path::Path::new(&recording.file_path);
    if !file_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Recording file not found".to_string(),
            }),
        )
            .into_response();
    }

    // Get file metadata
    let metadata = match std::fs::metadata(file_path) {
        Ok(m) => m,
        Err(e) => {
            error!("Failed to get file metadata: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to read file".to_string(),
                }),
            )
                .into_response();
        }
    };

    let file_size = metadata.len();

    // Parse Range header for seeking support
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| parse_range_header(s, file_size));

    let content_type = "video/x-matroska";

    match range {
        Some((start, end)) => {
            // Partial content response
            let mut file = match File::open(file_path).await {
                Ok(f) => f,
                Err(e) => {
                    error!("Failed to open file: {}", e);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: "Failed to open file".to_string(),
                        }),
                    )
                        .into_response();
                }
            };

            if let Err(e) = file.seek(std::io::SeekFrom::Start(start)).await {
                error!("Failed to seek in file: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to seek in file".to_string(),
                    }),
                )
                    .into_response();
            }

            let chunk_size = end - start + 1;
            let limited_file = AsyncReadExt::take(file, chunk_size);
            let stream = ReaderStream::new(limited_file);
            let body = Body::from_stream(stream);

            Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CONTENT_LENGTH, chunk_size)
                .header(
                    header::CONTENT_RANGE,
                    format!("bytes {}-{}/{}", start, end, file_size),
                )
                .header(header::ACCEPT_RANGES, "bytes")
                .body(body)
                .unwrap()
        }
        None => {
            // Full content response
            let file = match File::open(file_path).await {
                Ok(f) => f,
                Err(e) => {
                    error!("Failed to open file: {}", e);
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: "Failed to open file".to_string(),
                        }),
                    )
                        .into_response();
                }
            };

            let stream = ReaderStream::new(file);
            let body = Body::from_stream(stream);

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CONTENT_LENGTH, file_size)
                .header(header::ACCEPT_RANGES, "bytes")
                .body(body)
                .unwrap()
        }
    }
}

fn parse_range_header(range: &str, file_size: u64) -> Option<(u64, u64)> {
    if !range.starts_with("bytes=") {
        return None;
    }

    let range = &range[6..];
    let parts: Vec<&str> = range.split('-').collect();

    if parts.len() != 2 {
        return None;
    }

    let start: u64 = parts[0].parse().ok()?;
    let end: u64 = if parts[1].is_empty() {
        file_size - 1
    } else {
        parts[1].parse().ok()?
    };

    if start > end || end >= file_size {
        return None;
    }

    Some((start, end))
}

pub async fn get_active_recordings(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> impl IntoResponse {
    let active = state.recording_manager.get_all_active_recordings();
    let response: Vec<ActiveRecordingInfo> = active
        .into_iter()
        .map(|(topic, recording_id)| ActiveRecordingInfo {
            topic,
            recording_id,
        })
        .collect();

    (StatusCode::OK, Json(response)).into_response()
}

pub async fn is_topic_recording(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(topic): Path<String>,
) -> impl IntoResponse {
    let is_recording = state.recording_manager.is_recording(&topic);
    let recording_id = state.recording_manager.get_active_recording_id(&topic);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "is_recording": is_recording,
            "recording_id": recording_id
        })),
    )
        .into_response()
}
