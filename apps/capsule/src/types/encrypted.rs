use serde::{Deserialize, Serialize};

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
}

/// 채팅 요청
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    /// 사용자 메시지
    pub message: String,
    /// 암호화된 이미지 (선택사항)
    #[serde(default)]
    pub encrypted_image: Option<EncryptedImage>,
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
}

/// 스트리밍 청크
#[derive(Debug, Serialize)]
pub struct StreamChunk {
    /// 응답 텍스트 조각
    pub content: String,
    /// 완료 여부
    pub done: bool,
}
