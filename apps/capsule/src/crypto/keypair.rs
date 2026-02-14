use base64::{engine::general_purpose::STANDARD, Engine};
use std::sync::Arc;
use tokio::sync::RwLock;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::crypto::decrypt;
use crate::error::EnclaveError;
use crate::types::{DecryptedImage, EncryptedImage};

/// 서버 키 쌍 관리자
///
/// # 보안 특성
/// - Private Key는 절대 외부로 노출되지 않음
/// - `get_private_key()` 같은 메서드 없음
/// - 복호화는 `decrypt()` 메서드를 통해서만 가능
/// - Drop 시 Private Key 자동 zeroize (StaticSecret 내장)
pub struct KeyManager {
    /// Private Key (외부 접근 불가)
    secret: Arc<RwLock<StaticSecret>>,
    /// Public Key (외부 공개용)
    public: PublicKey,
}

impl KeyManager {
    /// 새 키 쌍 생성 (컨테이너 시작 시 호출)
    ///
    /// # 보안
    /// - 키는 메모리에만 존재
    /// - 디스크에 저장되지 않음
    /// - 컨테이너 재시작 시 새 키 생성
    pub fn new() -> Self {
        let secret = StaticSecret::random_from_rng(rand::thread_rng());
        let public = PublicKey::from(&secret);

        tracing::info!(
            "New key pair generated (public key: {}...)",
            &STANDARD.encode(public.as_bytes())[..16]
        );
        // 주의: secret은 절대 로깅하지 않음

        Self {
            secret: Arc::new(RwLock::new(secret)),
            public,
        }
    }

    /// Public Key 반환 (외부 공개용)
    pub fn public_key(&self) -> &PublicKey {
        &self.public
    }

    /// Public Key를 base64로 인코딩
    pub fn public_key_base64(&self) -> String {
        STANDARD.encode(self.public.as_bytes())
    }

    /// 복호화 수행 (Private Key 직접 노출 없이)
    ///
    /// # 보안
    /// - 이 메서드만이 Private Key에 접근 가능
    /// - 복호화된 이미지는 `DecryptedImage` 타입으로 반환
    /// - `DecryptedImage`는 Debug/Clone 미구현으로 노출 방지
    pub async fn decrypt(&self, encrypted: &EncryptedImage) -> Result<DecryptedImage, EnclaveError> {
        decrypt(&self.secret, encrypted).await
    }
}

impl Default for KeyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for KeyManager {
    fn drop(&mut self) {
        tracing::info!("KeyManager dropped, secret key will be zeroized");
        // StaticSecret은 Drop 시 자동으로 zeroize됨
    }
}
