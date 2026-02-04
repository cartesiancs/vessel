use zeroize::Zeroizing;

use crate::error::EnclaveError;

/// 애플리케이션 설정
pub struct Config {
    /// 서버 포트
    pub port: u16,
    /// OpenAI API 키 (Zeroizing으로 메모리 보호)
    pub openai_api_key: Zeroizing<String>,
    /// OpenAI 모델 (기본값: gpt-4o)
    pub openai_model: String,
    /// 허용된 CORS Origin 목록
    pub allowed_origins: Vec<String>,
}

impl Config {
    /// 환경 변수에서 설정 로드
    ///
    /// # 보안
    /// - API 키는 `Zeroizing<String>`으로 보호됨
    /// - 로드 후 환경 변수에서 민감 정보 제거
    pub fn from_env() -> Result<Self, EnclaveError> {
        dotenvy::dotenv().ok();

        // OpenAI API 키 로드
        let openai_api_key = std::env::var("OPENAI_API_KEY").map_err(|_| {
            EnclaveError::ConfigError("OPENAI_API_KEY environment variable is required".to_string())
        })?;

        // 보안: 환경 변수에서 API 키 제거
        std::env::remove_var("OPENAI_API_KEY");
        tracing::debug!("Removed OPENAI_API_KEY from environment");

        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .unwrap_or(3000);

        let openai_model =
            std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".to_string());

        // CORS 허용 Origin (쉼표로 구분)
        // 예: ALLOWED_ORIGINS=https://example.com,https://app.example.com
        // "*"는 모든 Origin 허용 (개발용)
        let allowed_origins = std::env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "*".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Self {
            port,
            openai_api_key: Zeroizing::new(openai_api_key),
            openai_model,
            allowed_origins,
        })
    }
}
