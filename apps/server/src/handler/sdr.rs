use anyhow::anyhow;
use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

use crate::{db, error::AppError, handler::auth::AuthUser, state::{AppState, DbPool}};

// rtl_tcp command IDs
const RTL_TCP_SET_FREQ: u8 = 0x01;
const RTL_TCP_SET_SAMPLERATE: u8 = 0x02;
const RTL_TCP_SET_GAIN_MODE: u8 = 0x03;
const RTL_TCP_SET_AGC: u8 = 0x08;

const DEFAULT_SAMPLERATE: u32 = 2_048_000;
const AUDIO_SAMPLE_RATE: u32 = 48000;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

fn get_sdr_address(pool: &DbPool) -> Result<(String, u16), anyhow::Error> {
    let entity_with_config =
        db::repository::get_entity_with_config_by_entity_id(pool, "sdr.server")?
            .ok_or_else(|| anyhow!("RTL-SDR is not configured. Please register the integration first."))?;

    let config = entity_with_config
        .configuration
        .ok_or_else(|| anyhow!("RTL-SDR entity has no configuration."))?;

    let host = config
        .get("host")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("RTL-SDR host is not configured."))?;
    let port_str = config
        .get("port")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("RTL-SDR port is not configured."))?;
    let port: u16 = port_str
        .parse()
        .map_err(|_| anyhow!("Invalid RTL-SDR port: {}", port_str))?;

    Ok((host.to_string(), port))
}

// ─── rtl_tcp Protocol ───

/// Send a 5-byte rtl_tcp command: [cmd: u8, value: u32 BE]
async fn rtl_tcp_command(stream: &mut TcpStream, cmd: u8, value: u32) -> Result<(), anyhow::Error> {
    let mut buf = [0u8; 5];
    buf[0] = cmd;
    buf[1..5].copy_from_slice(&value.to_be_bytes());
    stream.write_all(&buf).await?;
    Ok(())
}

/// Read the 12-byte rtl_tcp dongle info header.
/// Returns (tuner_type, gain_count).
async fn read_rtl_tcp_header(stream: &mut TcpStream) -> Result<(u32, u32), anyhow::Error> {
    let mut header = [0u8; 12];
    timeout(CONNECT_TIMEOUT, stream.read_exact(&mut header))
        .await
        .map_err(|_| anyhow!("Timeout reading rtl_tcp header"))??;

    let magic = &header[0..4];
    if magic != b"RTL0" {
        return Err(anyhow!("Invalid rtl_tcp header magic: {:?}", magic));
    }

    let tuner_type = u32::from_be_bytes(header[4..8].try_into()?);
    let gain_count = u32::from_be_bytes(header[8..12].try_into()?);

    Ok((tuner_type, gain_count))
}

// ─── DSP Pipeline ───

/// State maintained across packets for phase-continuous FM demodulation
struct FmDemodState {
    prev_i: f32,
    prev_q: f32,
    lpf_state: f32,
}

impl FmDemodState {
    fn new() -> Self {
        Self { prev_i: 0.0, prev_q: 0.0, lpf_state: 0.0 }
    }
}

/// Convert unsigned 8-bit IQ bytes to float32 IQ samples in [-1.0, 1.0].
fn u8_iq_to_float(data: &[u8]) -> Vec<f32> {
    data.iter().map(|&b| (b as f32 - 127.5) / 127.5).collect()
}

/// FM demodulation with state for phase continuity across packet boundaries.
fn fm_demodulate(iq_samples: &[f32], state: &mut FmDemodState, lpf_alpha: f32) -> Vec<f32> {
    if iq_samples.len() < 2 {
        return Vec::new();
    }
    let num_iq = iq_samples.len() / 2;
    let mut audio = Vec::with_capacity(num_iq);

    for i in 0..num_iq {
        let idx = i * 2;
        let i_curr = iq_samples[idx];
        let q_curr = iq_samples[idx + 1];

        // Phase difference: arg(conj(prev) * curr)
        let real = i_curr * state.prev_i + q_curr * state.prev_q;
        let imag = q_curr * state.prev_i - i_curr * state.prev_q;
        let demod = imag.atan2(real);

        // Single-pole IIR low-pass filter
        state.lpf_state = lpf_alpha * demod + (1.0 - lpf_alpha) * state.lpf_state;
        audio.push(state.lpf_state);

        state.prev_i = i_curr;
        state.prev_q = q_curr;
    }
    audio
}

/// Downsample audio using block averaging (anti-aliasing) and convert to int16 PCM.
fn downsample_to_i16(samples: &[f32], src_rate: u32, dst_rate: u32) -> Vec<u8> {
    if src_rate == 0 || dst_rate == 0 || samples.is_empty() {
        return Vec::new();
    }
    let ratio = src_rate as usize / dst_rate.max(1) as usize;
    if ratio == 0 {
        return Vec::new();
    }
    let out_len = samples.len() / ratio;
    let mut output = Vec::with_capacity(out_len * 2);

    for i in 0..out_len {
        let start = i * ratio;
        let end = (start + ratio).min(samples.len());
        let count = (end - start) as f32;
        let sum: f32 = samples[start..end].iter().sum();
        let avg = sum / count;
        let sample = (avg * 24000.0).clamp(-32768.0, 32767.0) as i16;
        output.extend_from_slice(&sample.to_le_bytes());
    }
    output
}

// ─── REST API Handlers ───

#[derive(Deserialize)]
pub struct SetFrequencyPayload {
    pub frequency: u64,
}

pub async fn set_frequency(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<SetFrequencyPayload>,
) -> Result<Json<Value>, AppError> {
    let (host, port) = get_sdr_address(&state.pool)?;
    let addr = format!("{}:{}", host, port);

    let mut stream = timeout(CONNECT_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| anyhow!("Connection to rtl_tcp timed out"))?
        .map_err(|e| anyhow!("Failed to connect to rtl_tcp at {}: {}", addr, e))?;

    // Read header (required before sending commands)
    read_rtl_tcp_header(&mut stream).await?;

    // Set frequency
    rtl_tcp_command(&mut stream, RTL_TCP_SET_FREQ, payload.frequency as u32).await?;

    Ok(Json(json!({ "status": "success", "frequency": payload.frequency })))
}

pub async fn get_samplerate(
    State(_state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "samplerate": DEFAULT_SAMPLERATE })))
}

pub async fn start_stream(
    State(_state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "status": "streaming", "note": "Use WebSocket /sdr/audio endpoint" })))
}

pub async fn stop_stream(
    State(_state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Value>, AppError> {
    Ok(Json(json!({ "status": "stopped" })))
}

// ─── WebSocket Audio Streaming Handler ───

pub async fn sdr_audio_ws(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_sdr_audio(socket, state))
}

async fn handle_sdr_audio(mut ws: WebSocket, state: Arc<AppState>) {
    let (host, port) = match get_sdr_address(&state.pool) {
        Ok(addr) => addr,
        Err(e) => {
            let _ = ws.send(Message::Text(json!({"error": e.to_string()}).to_string().into())).await;
            return;
        }
    };

    let addr = format!("{}:{}", host, port);
    let mut tcp_stream = match timeout(CONNECT_TIMEOUT, TcpStream::connect(&addr)).await {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            error!("Failed to connect to rtl_tcp: {}", e);
            let _ = ws.send(Message::Text(json!({"error": format!("Connection failed: {}", e)}).to_string().into())).await;
            return;
        }
        Err(_) => {
            error!("Connection to rtl_tcp timed out");
            let _ = ws.send(Message::Text(json!({"error": "Connection timed out"}).to_string().into())).await;
            return;
        }
    };

    if let Err(e) = tcp_stream.set_nodelay(true) {
        warn!("Failed to set TCP_NODELAY: {}", e);
    }

    info!("Connected to rtl_tcp at {}", addr);

    // Read 12-byte dongle info header
    let (tuner_type, gain_count) = match read_rtl_tcp_header(&mut tcp_stream).await {
        Ok(h) => h,
        Err(e) => {
            error!("Failed to read rtl_tcp header: {}", e);
            let _ = ws.send(Message::Text(json!({"error": format!("Header read failed: {}", e)}).to_string().into())).await;
            return;
        }
    };
    info!("rtl_tcp dongle: tuner_type={}, gain_count={}", tuner_type, gain_count);

    // Configure device
    let sdr_samplerate = DEFAULT_SAMPLERATE;

    if let Err(e) = rtl_tcp_command(&mut tcp_stream, RTL_TCP_SET_SAMPLERATE, sdr_samplerate).await {
        warn!("Failed to set sample rate: {}", e);
    }
    if let Err(e) = rtl_tcp_command(&mut tcp_stream, RTL_TCP_SET_GAIN_MODE, 0).await {
        warn!("Failed to set gain mode: {}", e);
    }
    if let Err(e) = rtl_tcp_command(&mut tcp_stream, RTL_TCP_SET_AGC, 1).await {
        warn!("Failed to enable AGC: {}", e);
    }

    // Send info to frontend
    let _ = ws.send(Message::Text(
        json!({"type": "info", "samplerate": sdr_samplerate, "audio_rate": AUDIO_SAMPLE_RATE}).to_string().into()
    )).await;

    info!("rtl_tcp streaming started (sample rate: {} Hz)", sdr_samplerate);

    // LPF alpha: ~15kHz cutoff, adjusted to actual sample rate
    let lpf_alpha = (2.0 * std::f32::consts::PI * 15000.0 / sdr_samplerate as f32)
        .clamp(0.01, 1.0);

    let mut demod_state = FmDemodState::new();
    let mut first_packet = true;

    // Read buffer for IQ data (16K samples = 32K bytes at uint8 IQ)
    let mut iq_buf = vec![0u8; 32768];

    // Main loop: read IQ data from rtl_tcp and handle WebSocket messages
    loop {
        tokio::select! {
            // Read from WebSocket (client control messages)
            ws_msg = ws.recv() => {
                match ws_msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<Value>(&text) {
                            if parsed.get("type").and_then(|t| t.as_str()) == Some("set_frequency") {
                                if let Some(freq) = parsed.get("value").and_then(|v| v.as_f64()) {
                                    let _ = rtl_tcp_command(&mut tcp_stream, RTL_TCP_SET_FREQ, freq as u32).await;
                                }
                            } else if parsed.get("type").and_then(|t| t.as_str()) == Some("stop") {
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            // Read IQ data from rtl_tcp (continuous stream, no packet headers)
            tcp_result = tcp_stream.read(&mut iq_buf) => {
                let n = match tcp_result {
                    Ok(0) => break,   // Connection closed
                    Ok(n) => n,
                    Err(_) => {
                        warn!("TCP read error from rtl_tcp");
                        break;
                    }
                };

                // Ensure even number of bytes (IQ pairs)
                let n = n & !1;
                if n < 2 {
                    continue;
                }

                // Log first packet for debugging
                if first_packet {
                    first_packet = false;
                    info!("rtl_tcp first data: {} bytes, first 8 bytes: {:?}",
                        n, &iq_buf[..8.min(n)]);
                }

                // Convert uint8 IQ to float32
                let iq_samples = u8_iq_to_float(&iq_buf[..n]);

                // FM demodulate
                let audio = fm_demodulate(&iq_samples, &mut demod_state, lpf_alpha);
                if audio.is_empty() {
                    continue;
                }

                // Downsample to 48kHz and convert to int16
                let pcm_bytes = downsample_to_i16(&audio, sdr_samplerate, AUDIO_SAMPLE_RATE);
                if pcm_bytes.is_empty() {
                    continue;
                }

                // Send as binary WebSocket frame
                if ws.send(Message::Binary(pcm_bytes.into())).await.is_err() {
                    break;
                }
            }
        }
    }

    info!("rtl_tcp audio streaming ended");
}
