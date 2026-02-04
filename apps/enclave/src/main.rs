mod api;
mod config;
mod crypto;
mod error;
mod services;
mod types;

use std::sync::Arc;

use config::Config;
use crypto::KeyManager;
use services::OpenAIService;

/// 애플리케이션 상태
///
/// # 보안
/// - `KeyManager`는 Private Key를 내부에 보관
/// - Private Key는 외부로 노출되지 않음
pub struct AppState {
    /// 키 관리자 (암호화/복호화)
    pub key_manager: KeyManager,
    /// OpenAI 서비스
    pub openai: OpenAIService,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 로깅 초기화
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("enclave=debug".parse().unwrap()),
        )
        .init();

    tracing::info!("Starting Enclave server...");

    // 설정 로드 (API 키는 로드 후 환경 변수에서 제거됨)
    let config = Config::from_env()?;
    tracing::info!("Configuration loaded (port: {})", config.port);
    tracing::info!("CORS allowed origins: {:?}", config.allowed_origins);

    // 라우터 생성에 필요한 설정 추출 (openai_api_key 이동 전)
    let app_config = api::RouterConfig {
        allowed_origins: config.allowed_origins.clone(),
    };

    // 애플리케이션 상태 생성
    // KeyManager는 여기서 새 키 쌍을 생성함 (메모리에만 존재)
    let openai_model = config.openai_model.clone();
    let state = Arc::new(AppState {
        key_manager: KeyManager::new(),
        openai: OpenAIService::new(config.openai_api_key).with_model(openai_model),
    });

    tracing::info!(
        "Key pair generated (public key: {}...)",
        &state.key_manager.public_key_base64()[..20]
    );

    // 라우터 생성
    let app = api::create_router(state, &app_config);

    // 서버 시작
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Enclave server listening on {}", addr);
    tracing::info!("Security: Private key exists only in memory");
    tracing::info!("Security: Decrypted images are zeroized after use");
    tracing::info!("Security: API key protected with Zeroizing<String>");
    tracing::info!("Security: Request body limit: 100MB");

    axum::serve(listener, app).await?;

    Ok(())
}
