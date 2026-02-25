use serde::{Deserialize, Serialize};

use crate::error::CapsuleError;

/// 최대 히스토리 메시지 수
const MAX_HISTORY_MESSAGES: usize = 50;

/// 최대 히스토리 총 문자 수 (~25k 토큰)
const MAX_HISTORY_CHARS: usize = 100_000;

/// 허용되는 메시지 역할
const ALLOWED_ROLES: &[&str] = &["user", "assistant", "system"];

/// 클라이언트에서 전송된 암호화된 이미지
/// 이 타입은 안전하게 로깅 가능 (민감 데이터 없음 - 복호화 불가)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedImage {
    /// 클라이언트의 임시 공개키 (32 bytes, base64)
    pub ephemeral_public_key: String,
    /// Nonce (24 bytes, base64)
    pub nonce: String,
    /// 암호화된 이미지 데이터 (base64)
    pub ciphertext: String,
    /// 암호화에 사용된 서버 키 ID (하위 호환을 위해 선택사항)
    #[serde(default)]
    pub key_id: Option<String>,
}

/// 대화 히스토리의 단일 메시지
///
/// 클라이언트가 관리하며, 서버는 저장하지 않음 (zero-knowledge)
/// 이미지는 텍스트 요약으로만 포함 가능
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryMessage {
    /// 메시지 역할: "user", "assistant", 또는 "system"
    pub role: String,
    /// 텍스트 내용
    pub content: String,
}

/// 채팅 요청
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    /// 사용자 메시지
    pub message: String,
    /// 암호화된 이미지 (선택사항)
    #[serde(default)]
    pub encrypted_image: Option<EncryptedImage>,
    /// 대화 히스토리 (선택사항, 오래된 순서)
    #[serde(default)]
    pub history: Option<Vec<HistoryMessage>>,
    /// 시스템 프롬프트 (선택사항)
    #[serde(default)]
    pub system_prompt: Option<String>,
}

impl ChatRequest {
    /// 히스토리 유효성 검사
    pub fn validate_history(&self) -> Result<(), CapsuleError> {
        if let Some(history) = &self.history {
            if history.len() > MAX_HISTORY_MESSAGES {
                return Err(CapsuleError::HistoryTooLarge(format!(
                    "History contains {} messages, maximum is {}",
                    history.len(),
                    MAX_HISTORY_MESSAGES
                )));
            }

            let total_chars: usize = history.iter().map(|m| m.content.len()).sum();
            if total_chars > MAX_HISTORY_CHARS {
                return Err(CapsuleError::HistoryTooLarge(format!(
                    "History total size is {} characters, maximum is {}",
                    total_chars, MAX_HISTORY_CHARS
                )));
            }

            for msg in history {
                if !ALLOWED_ROLES.contains(&msg.role.as_str()) {
                    return Err(CapsuleError::HistoryTooLarge(format!(
                        "Invalid role '{}', allowed: {:?}",
                        msg.role, ALLOWED_ROLES
                    )));
                }
            }
        }
        Ok(())
    }
}

/// 채팅 응답
#[derive(Debug, Serialize)]
pub struct ChatResponse {
    /// AI 응답 텍스트
    pub response: String,
}

/// Public Key 응답
#[derive(Debug, Serialize)]
pub struct PublicKeyResponse {
    /// 서버 공개키 (base64)
    pub public_key: String,
    /// 키 고유 식별자
    pub key_id: String,
    /// 키 만료 예상 시각 (RFC 3339) - 클라이언트 캐시 갱신 힌트
    pub expires_at: String,
}

/// 스트리밍 청크
#[derive(Debug, Serialize)]
pub struct StreamChunk {
    /// 응답 텍스트 조각
    pub content: String,
    /// 완료 여부
    pub done: bool,
}
