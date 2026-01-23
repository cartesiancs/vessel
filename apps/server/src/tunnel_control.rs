use std::{
    collections::HashMap,
    sync::Arc,
};

use anyhow::{anyhow, Context, Result};
use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use httparse;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
    sync::{mpsc, Mutex, oneshot},
};
use tokio_tungstenite::tungstenite;
use url::Url;

const BINARY_PREFIX: usize = 8;
const MAX_HEADER_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone)]
pub struct TunnelStatus {
    pub active: bool,
    pub session_id: Option<String>,
    pub server: Option<String>,
    pub target: Option<String>,
}

pub struct TunnelManager {
    inner: Mutex<Inner>,
}

struct Inner {
    handle: Option<tokio::task::JoinHandle<()>>,
    cancel: Option<oneshot::Sender<()>>,
    session_id: Option<String>,
    server: Option<String>,
    target: Option<String>,
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                handle: None,
                cancel: None,
                session_id: None,
                server: None,
                target: None,
            }),
        }
    }

    pub async fn start(&self, server: String, target: String, access_token: Option<String>) -> Result<String> {
        let mut guard = self.inner.lock().await;
        if let Some(session) = guard.session_id.clone() {
            return Ok(session);
        }

        let (cancel_tx, cancel_rx) = oneshot::channel();
        let (session_tx, session_rx) = oneshot::channel();
        let server_clone = server.clone();
        let target_clone = target.clone();

        let handle = tokio::spawn(async move {
            if let Err(err) = run_agent(server_clone, target_clone, access_token, session_tx, cancel_rx).await {
                tracing::warn!("tunnel agent stopped: {err:#}");
            }
        });

        let session_id = session_rx
            .await
            .map_err(|_| anyhow!("agent failed to report session id"))?;

        guard.handle = Some(handle);
        guard.cancel = Some(cancel_tx);
        guard.session_id = Some(session_id.clone());
        guard.server = Some(server);
        guard.target = Some(target);

        Ok(session_id)
    }

    pub async fn stop(&self) -> Result<()> {
        let mut guard = self.inner.lock().await;
        if let Some(cancel) = guard.cancel.take() {
            let _ = cancel.send(());
        }
        if let Some(handle) = guard.handle.take() {
            let _ = handle.await;
        }
        guard.session_id = None;
        guard.server = None;
        guard.target = None;
        Ok(())
    }

    pub async fn status(&self) -> TunnelStatus {
        let guard = self.inner.lock().await;
        TunnelStatus {
            active: guard.session_id.is_some(),
            session_id: guard.session_id.clone(),
            server: guard.server.clone(),
            target: guard.target.clone(),
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum AgentToServer {
    Register { target: String },
    ResponseHead {
        stream_id: u64,
        status: u16,
        headers: Vec<(String, String)>,
    },
    ResponseFinished { stream_id: u64 },
    Error {
        stream_id: Option<u64>,
        message: String,
    },
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum ServerToAgent {
    Registered { session_id: String },
    Open {
        stream_id: u64,
        method: String,
        path: String,
        headers: Vec<(String, String)>,
        body_len: usize,
    },
    BodyFinished { stream_id: u64 },
    Close {
        stream_id: u64,
        reason: Option<String>,
    },
}

struct AgentState {
    target: TargetInfo,
    pending: Mutex<HashMap<u64, PendingRequest>>,
    outbound: mpsc::Sender<AgentOutbound>,
}

struct PendingRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
    body_finished: bool,
    tx: mpsc::Sender<Bytes>,
    rx: Option<mpsc::Receiver<Bytes>>,
    upgrade: bool,
}

enum AgentOutbound {
    Control(AgentToServer),
    Body { stream_id: u64, chunk: Bytes },
}

#[derive(Clone)]
struct TargetInfo {
    raw: String,
    host: String,
    port: u16,
}

impl TargetInfo {
    fn parse(raw: &str) -> Result<Self> {
        let url =
            Url::parse(raw).context("target must be a full URL, e.g. http://127.0.0.1:3000")?;
        let host = url
            .host_str()
            .ok_or_else(|| anyhow!("target host missing"))?
            .to_string();
        let port = url
            .port_or_known_default()
            .ok_or_else(|| anyhow!("target port missing"))?;
        Ok(Self {
            raw: raw.to_string(),
            host,
            port,
        })
    }

    fn host_header(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

async fn run_agent(
    server: String,
    target: String,
    access_token: Option<String>,
    session_tx: oneshot::Sender<String>,
    mut cancel: oneshot::Receiver<()>,
) -> Result<()> {
    let target_info = TargetInfo::parse(&target)?;

    // Parse the server URL to extract host for the Host header
    let server_url = Url::parse(&server).context("invalid tunnel server URL")?;
    let server_host = server_url
        .host_str()
        .ok_or_else(|| anyhow!("tunnel server URL has no host"))?;
    let host_header = match server_url.port() {
        Some(port) => format!("{}:{}", server_host, port),
        None => server_host.to_string(),
    };

    // Build WebSocket request with optional Authorization header
    let mut request = http::Request::builder()
        .uri(&server)
        .header("Host", &host_header)
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header("Sec-WebSocket-Key", tungstenite::handshake::client::generate_key());

    if let Some(token) = &access_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    let request = request.body(()).context("failed to build websocket request")?;
    let (ws_stream, _) = tokio_tungstenite::connect_async(request)
        .await
        .context("failed to connect to tunnel server")?;
    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    let register = AgentToServer::Register {
        target: target.clone(),
    };
    ws_tx
        .send(tungstenite::Message::Text(
            serde_json::to_string(&register)?.into(),
        ))
        .await?;

    let session_id = wait_for_registration(&mut ws_rx).await?;
    let _ = session_tx.send(session_id.clone());
    tracing::info!(%session_id, target = %target_info.raw, "tunnel agent connected");

    let (out_tx, mut out_rx) = mpsc::channel::<AgentOutbound>(64);
    let writer = tokio::spawn(async move {
        while let Some(msg) = out_rx.recv().await {
            match msg {
                AgentOutbound::Control(ctrl) => {
                    let txt = serde_json::to_string(&ctrl)?;
                    ws_tx.send(tungstenite::Message::Text(txt.into())).await?;
                }
                AgentOutbound::Body { stream_id, chunk } => {
                    let mut data = Vec::with_capacity(BINARY_PREFIX + chunk.len());
                    data.extend_from_slice(&stream_id.to_be_bytes());
                    data.extend_from_slice(&chunk);
                    ws_tx
                        .send(tungstenite::Message::Binary(data.into()))
                        .await?;
                }
            }
        }
        Result::<_, anyhow::Error>::Ok(())
    });

    let agent = Arc::new(AgentState {
        target: target_info,
        pending: Mutex::new(HashMap::new()),
        outbound: out_tx.clone(),
    });

    let reader_agent = agent.clone();
    let reader = tokio::spawn(async move {
        while let Some(msg) = ws_rx.next().await {
            match msg {
                Ok(tungstenite::Message::Text(txt)) => {
                    let ctrl: ServerToAgent = serde_json::from_str(txt.as_ref())?;
                    handle_server_control(reader_agent.clone(), ctrl).await?;
                }
                Ok(tungstenite::Message::Binary(data)) => {
                    handle_server_body(reader_agent.clone(), data).await?;
                }
                Ok(tungstenite::Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
        Result::<_, anyhow::Error>::Ok(())
    });

    tokio::select! {
        res = writer => { res??; }
        res = reader => { res??; }
        _ = &mut cancel => {
            tracing::info!("tunnel agent stop requested");
        }
    };

    Ok(())
}

async fn wait_for_registration(
    ws_rx: &mut (impl StreamExt<Item = Result<tungstenite::Message, tungstenite::Error>> + Unpin),
) -> Result<String> {
    while let Some(msg) = ws_rx.next().await {
        let msg = msg?;
        if let tungstenite::Message::Text(txt) = msg {
            if let Ok(ServerToAgent::Registered { session_id }) = serde_json::from_str(txt.as_ref())
            {
                return Ok(session_id);
            }
        }
    }
    Err(anyhow!("server closed before registration ack"))
}

async fn handle_server_control(agent: Arc<AgentState>, msg: ServerToAgent) -> Result<()> {
    match msg {
        ServerToAgent::Open {
            stream_id,
            method,
            path,
            headers,
            body_len: _,
        } => {
            let mut pending = agent.pending.lock().await;
            let headers_clone = headers.clone();
            let (tx, rx) = mpsc::channel(64);
            pending.insert(
                stream_id,
                PendingRequest {
                    method,
                    path,
                    headers,
                    body: Vec::new(),
                    body_finished: false,
                    tx,
                    rx: Some(rx),
                    upgrade: is_upgrade(&headers_clone),
                },
            );
        }
        ServerToAgent::BodyFinished { stream_id } => {
            if let Some(pending) = agent.pending.lock().await.get_mut(&stream_id) {
                pending.body_finished = true;
                let agent_clone = agent.clone();
                if let Some(rx) = pending.rx.take() {
                    let req = PendingRequest {
                        method: pending.method.clone(),
                        path: pending.path.clone(),
                        headers: pending.headers.clone(),
                        body: std::mem::take(&mut pending.body),
                        body_finished: true,
                        tx: pending.tx.clone(),
                        rx: Some(rx),
                        upgrade: pending.upgrade,
                    };
                    tokio::spawn(async move {
                        if let Err(err) = forward_request(agent_clone.clone(), stream_id, req).await
                        {
                            let _ = agent_clone
                                .outbound
                                .send(AgentOutbound::Control(AgentToServer::Error {
                                    stream_id: Some(stream_id),
                                    message: err.to_string(),
                                }))
                                .await;
                            tracing::warn!("stream {stream_id} failed: {err:#}");
                        }
                    });
                }
            }
        }
        ServerToAgent::Close { stream_id, reason } => {
            agent.pending.lock().await.remove(&stream_id);
            if let Some(reason) = reason {
                tracing::info!(stream_id, "server closed stream: {reason}");
            }
        }
        ServerToAgent::Registered { .. } => {
            // handled in wait_for_registration
        }
    }
    Ok(())
}

async fn handle_server_body(agent: Arc<AgentState>, data: Bytes) -> Result<()> {
    if data.len() < BINARY_PREFIX {
        return Err(anyhow!("binary frame too short"));
    }
    let stream_id = u64::from_be_bytes(data[..BINARY_PREFIX].try_into()?);
    let payload = &data[BINARY_PREFIX..];
    let mut guard = agent.pending.lock().await;
    if let Some(entry) = guard.get_mut(&stream_id) {
        if entry.body_finished {
            let _ = entry.tx.send(Bytes::copy_from_slice(payload)).await;
        } else {
            entry.body.extend_from_slice(payload);
        }
    }
    Ok(())
}

async fn forward_request(
    agent: Arc<AgentState>,
    stream_id: u64,
    req: PendingRequest,
) -> Result<()> {
    let addr = format!("{}:{}", agent.target.host, agent.target.port);
    let mut stream = TcpStream::connect(addr)
        .await
        .context("failed to reach target")?;

    let mut request = Vec::new();
    use std::io::Write as _;
    write!(&mut request, "{} {} HTTP/1.1\r\n", req.method, req.path)?;

    let mut has_host = false;
    let mut has_length = false;
    for (name, value) in req.headers.iter() {
        if name.eq_ignore_ascii_case("host") {
            has_host = true;
            continue;
        }
        if name.eq_ignore_ascii_case("content-length") {
            has_length = true;
        }
        write!(&mut request, "{}: {}\r\n", name, value)?;
    }
    if !has_host {
        write!(&mut request, "Host: {}\r\n", agent.target.host_header())?;
    }
    if !has_length && !req.body.is_empty() {
        write!(&mut request, "Content-Length: {}\r\n", req.body.len())?;
    }
    request.extend_from_slice(b"\r\n");
    request.extend_from_slice(&req.body);

    stream.write_all(&request).await?;

    // Parse response head
    let mut buffer = Vec::new();
    let mut header_buf = [0u8; 4096];
    let header_len = loop {
        let n = stream.read(&mut header_buf).await?;
        if n == 0 {
            return Err(anyhow!("target closed before sending response"));
        }
        buffer.extend_from_slice(&header_buf[..n]);
        if let Some(pos) = find_header_split(&buffer) {
            break pos;
        }
        if buffer.len() > MAX_HEADER_BYTES {
            return Err(anyhow!("response headers too large"));
        }
    };

    let (header_bytes, body_start) = buffer.split_at(header_len);
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut resp = httparse::Response::new(&mut headers);
    resp.parse(header_bytes)
        .map_err(|e| anyhow!("failed to parse response headers: {e:?}"))?;
    let status = resp.code.unwrap_or(502) as u16;
    let header_pairs: Vec<(String, String)> = resp
        .headers
        .iter()
        .filter(|h| !h.name.is_empty())
        .map(|h| {
            (
                h.name.to_string(),
                String::from_utf8_lossy(h.value).to_string(),
            )
        })
        .collect();

    agent
        .outbound
        .send(AgentOutbound::Control(AgentToServer::ResponseHead {
            stream_id,
            status,
            headers: header_pairs,
        }))
        .await
        .ok();

    if req.upgrade {
        let (mut target_reader, mut target_writer) = stream.into_split();
        if !body_start.is_empty() {
            agent
                .outbound
                .send(AgentOutbound::Body {
                    stream_id,
                    chunk: Bytes::copy_from_slice(body_start),
                })
                .await
                .ok();
        }

        let mut rx = req.rx.unwrap_or_else(|| {
            let (_tx, rx) = mpsc::channel(1);
            rx
        });
        let outbound = agent.outbound.clone();
        let reader_task = tokio::spawn(async move {
            let mut buf = [0u8; 16 * 1024];
            loop {
                let n = target_reader.read(&mut buf).await?;
                if n == 0 {
                    break;
                }
                outbound
                    .send(AgentOutbound::Body {
                        stream_id,
                        chunk: Bytes::copy_from_slice(&buf[..n]),
                    })
                    .await
                    .ok();
            }
            outbound
                .send(AgentOutbound::Control(AgentToServer::ResponseFinished {
                    stream_id,
                }))
                .await
                .ok();
            Ok::<_, anyhow::Error>(())
        });

        while let Some(chunk) = rx.recv().await {
            if target_writer.write_all(&chunk).await.is_err() {
                break;
            }
        }
        let _ = reader_task.await;
    } else {
        if !body_start.is_empty() {
            agent
                .outbound
                .send(AgentOutbound::Body {
                    stream_id,
                    chunk: Bytes::copy_from_slice(body_start),
                })
                .await
                .ok();
        }

        let mut buf = [0u8; 16 * 1024];
        loop {
            let n = stream.read(&mut buf).await?;
            if n == 0 {
                break;
            }
            agent
                .outbound
                .send(AgentOutbound::Body {
                    stream_id,
                    chunk: Bytes::copy_from_slice(&buf[..n]),
                })
                .await
                .ok();
        }

        agent
            .outbound
            .send(AgentOutbound::Control(AgentToServer::ResponseFinished {
                stream_id,
            }))
            .await
            .ok();
    }

    Ok(())
}

fn find_header_split(buf: &[u8]) -> Option<usize> {
    buf.windows(4)
        .position(|w| w == b"\r\n\r\n")
        .map(|pos| pos + 4)
}

fn is_upgrade(headers: &[(String, String)]) -> bool {
    let mut connection = String::new();
    let mut upgrade = String::new();
    for (k, v) in headers {
        if k.eq_ignore_ascii_case("connection") {
            connection = v.to_ascii_lowercase();
        }
        if k.eq_ignore_ascii_case("upgrade") {
            upgrade = v.to_ascii_lowercase();
        }
    }
    connection.contains("upgrade") || !upgrade.is_empty()
}
