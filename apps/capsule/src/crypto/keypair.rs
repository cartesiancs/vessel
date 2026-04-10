use base64::{engine::general_purpose::STANDARD, Engine};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::crypto::decrypt_with_secret;
use crate::error::CapsuleError;
use crate::types::{DecryptedImage, EncryptedImage};

/// 버전이 지정된 키 쌍
struct VersionedKey {
    /// 키 고유 식별자 (public key base64의 앞 16자)
    key_id: String,
    /// Private Key
    secret: StaticSecret,
    /// Public Key
    public: PublicKey,
    /// 생성 시각
    created_at: std::time::Instant,
}

impl VersionedKey {
    fn new() -> Self {
        let secret = StaticSecret::random_from_rng(rand::thread_rng());
        let public = PublicKey::from(&secret);
        let key_id = STANDARD.encode(public.as_bytes())[..16].to_string();

        tracing::info!(key_id = %key_id, "New versioned key pair generated");

        Self {
            key_id,
            secret,
            public,
            created_at: std::time::Instant::now(),
        }
    }

    fn public_key_base64(&self) -> String {
        STANDARD.encode(self.public.as_bytes())
    }
}

/// 현재/이전 키 슬롯
struct KeySlots {
    /// 현재 활성 키 (새 클라이언트에게 배포)
    current: VersionedKey,
    /// 이전 키 (grace period 동안 유지)
    previous: Option<VersionedKey>,
}

/// 서버 키 쌍 관리자 (로테이션 지원)
///
/// # 보안 특성
/// - Private Key는 절대 외부로 노출되지 않음
/// - 복호화는 `decrypt()` 메서드를 통해서만 가능
/// - 키 로테이션으로 침해 범위를 로테이션 주기로 한정
/// - Drop 시 모든 Private Key 자동 zeroize (StaticSecret 내장)
///
/// # Two-Slot Key Model
/// - `current`: 새 클라이언트에게 배포, 새 요청 복호화
/// - `previous`: grace period 동안 유지, 이전 키를 캐싱한 클라이언트 지원
pub struct KeyManager {
    keys: Arc<RwLock<KeySlots>>,
    rotation_interval: Duration,
    grace_period: Duration,
}

impl KeyManager {
    /// 새 KeyManager 생성 (로테이션 설정 포함)
    ///
    /// # 보안
    /// - 키는 메모리에만 존재
    /// - 디스크에 저장되지 않음
    /// - 컨테이너 재시작 시 새 키 생성
    pub fn new(rotation_interval: Duration, grace_period: Duration) -> Self {
        let current = VersionedKey::new();
        tracing::info!(
            key_id = %current.key_id,
            rotation_interval_secs = rotation_interval.as_secs(),
            grace_period_secs = grace_period.as_secs(),
            "KeyManager initialized"
        );

        Self {
            keys: Arc::new(RwLock::new(KeySlots {
                current,
                previous: None,
            })),
            rotation_interval,
            grace_period,
        }
    }

    /// 현재 공개키 정보 반환 (key_id, expires_at 포함)
    pub async fn current_public_key(&self) -> (String, String, String) {
        let keys = self.keys.read().await;
        let elapsed = keys.current.created_at.elapsed();
        let remaining = self.rotation_interval.saturating_sub(elapsed);
        let expiry = chrono::Utc::now()
            + chrono::Duration::from_std(remaining).unwrap_or(chrono::Duration::zero());
        (
            keys.current.public_key_base64(),
            keys.current.key_id.clone(),
            expiry.to_rfc3339(),
        )
    }

    /// 복호화 수행 (key_id로 적절한 키 선택)
    ///
    /// # 키 선택 로직
    /// - `key_id` 있으면: 매칭되는 키로 복호화
    /// - `key_id` 없으면 (하위 호환): current → previous 순서로 시도
    pub async fn decrypt(&self, encrypted: &EncryptedImage) -> Result<DecryptedImage, CapsuleError> {
        let keys = self.keys.read().await;

        match &encrypted.key_id {
            Some(kid) => {
                // key_id가 명시된 경우: 정확히 매칭되는 키 사용
                if kid == &keys.current.key_id {
                    decrypt_with_secret(&keys.current.secret, encrypted)
                } else if let Some(prev) = &keys.previous {
                    if kid == &prev.key_id {
                        tracing::debug!(key_id = %kid, "Decrypting with previous key");
                        decrypt_with_secret(&prev.secret, encrypted)
                    } else {
                        tracing::warn!(
                            requested_key_id = %kid,
                            current_key_id = %keys.current.key_id,
                            "Unknown key_id requested"
                        );
                        Err(CapsuleError::DecryptionFailed)
                    }
                } else {
                    tracing::warn!(
                        requested_key_id = %kid,
                        current_key_id = %keys.current.key_id,
                        "Unknown key_id requested (no previous key)"
                    );
                    Err(CapsuleError::DecryptionFailed)
                }
            }
            None => {
                // key_id가 없는 경우 (하위 호환): current → previous 순서로 시도
                match decrypt_with_secret(&keys.current.secret, encrypted) {
                    Ok(result) => Ok(result),
                    Err(_) => {
                        if let Some(prev) = &keys.previous {
                            tracing::debug!("Retrying decryption with previous key (no key_id)");
                            decrypt_with_secret(&prev.secret, encrypted)
                        } else {
                            Err(CapsuleError::DecryptionFailed)
                        }
                    }
                }
            }
        }
    }

    /// 키 로테이션: current → previous, 새 키 → current
    async fn rotate(&self) {
        let mut keys = self.keys.write().await;
        let new_key = VersionedKey::new();

        tracing::info!(
            new_key_id = %new_key.key_id,
            old_key_id = %keys.current.key_id,
            "Key rotation: new key generated"
        );

        let old_current = std::mem::replace(&mut keys.current, new_key);
        // 이전 previous가 있으면 여기서 drop → StaticSecret zeroize
        keys.previous = Some(old_current);
    }

    /// 이전 키 제거 (grace period 만료 후 호출)
    async fn clear_previous(&self) {
        let mut keys = self.keys.write().await;
        if let Some(prev) = keys.previous.take() {
            tracing::info!(
                key_id = %prev.key_id,
                "Previous key cleared (grace period expired)"
            );
            // prev drop → StaticSecret zeroize
        }
    }

    /// 백그라운드 로테이션 태스크 시작
    pub fn start_rotation_task(self: &Arc<Self>) -> tokio::task::JoinHandle<()> {
        let manager = Arc::clone(self);
        let rotation_interval = self.rotation_interval;
        let grace_period = self.grace_period;

        tokio::spawn(async move {
            loop {
                tokio::time::sleep(rotation_interval).await;

                tracing::info!("Key rotation triggered");
                manager.rotate().await;

                // Grace period 후 이전 키 제거
                let manager_clone = Arc::clone(&manager);
                tokio::spawn(async move {
                    tokio::time::sleep(grace_period).await;
                    manager_clone.clear_previous().await;
                });
            }
        })
    }
}

impl Drop for KeyManager {
    fn drop(&mut self) {
        tracing::info!("KeyManager dropped, all secret keys will be zeroized");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::EncryptedImage;
    use base64::{engine::general_purpose::STANDARD, Engine};
    use chacha20poly1305::{
        aead::{Aead, KeyInit},
        XChaCha20Poly1305, XNonce,
    };
    use hkdf::Hkdf;
    use sha2::Sha256;

    /// 테스트용: 특정 공개키로 이미지를 암호화
    fn encrypt_for_key(public_key: &PublicKey, data: &[u8]) -> (EncryptedImage, String) {
        let ephemeral_secret = StaticSecret::random_from_rng(rand::thread_rng());
        let ephemeral_public = PublicKey::from(&ephemeral_secret);

        let shared_secret = ephemeral_secret.diffie_hellman(public_key);

        let mut symmetric_key = [0u8; 32];
        let hkdf = Hkdf::<Sha256>::new(
            Some(b"vessel-capsule-v1-salt"),
            shared_secret.as_bytes(),
        );
        hkdf.expand(b"vessel-capsule-v1-key", &mut symmetric_key)
            .unwrap();

        let cipher = XChaCha20Poly1305::new_from_slice(&symmetric_key).unwrap();
        let nonce_bytes: [u8; 24] = rand::random();
        let ciphertext = cipher
            .encrypt(XNonce::from_slice(&nonce_bytes), data)
            .unwrap();

        let key_id = STANDARD.encode(public_key.as_bytes())[..16].to_string();

        let encrypted = EncryptedImage {
            ephemeral_public_key: STANDARD.encode(ephemeral_public.as_bytes()),
            nonce: STANDARD.encode(nonce_bytes),
            ciphertext: STANDARD.encode(&ciphertext),
            key_id: Some(key_id.clone()),
        };

        (encrypted, key_id)
    }

    #[tokio::test]
    async fn test_rotation_creates_new_key() {
        let km = Arc::new(KeyManager::new(
            Duration::from_secs(3600),
            Duration::from_secs(60),
        ));
        let (_, id1, _) = km.current_public_key().await;
        km.rotate().await;
        let (_, id2, _) = km.current_public_key().await;
        assert_ne!(id1, id2);
    }

    #[tokio::test]
    async fn test_decrypt_with_current_key() {
        let km = Arc::new(KeyManager::new(
            Duration::from_secs(3600),
            Duration::from_secs(60),
        ));

        let keys = km.keys.read().await;
        let public = keys.current.public;
        drop(keys);

        let (encrypted, _) = encrypt_for_key(&public, b"test image data");
        let decrypted = km.decrypt(&encrypted).await.unwrap();
        assert_eq!(decrypted.len(), b"test image data".len());
    }

    #[tokio::test]
    async fn test_previous_key_available_after_rotation() {
        let km = Arc::new(KeyManager::new(
            Duration::from_secs(3600),
            Duration::from_secs(60),
        ));

        // 현재 키로 암호화
        let keys = km.keys.read().await;
        let old_public = keys.current.public;
        drop(keys);

        let (encrypted, _) = encrypt_for_key(&old_public, b"old key data");

        // 로테이션
        km.rotate().await;

        // 이전 키로 복호화 성공해야 함
        let decrypted = km.decrypt(&encrypted).await.unwrap();
        assert_eq!(decrypted.len(), b"old key data".len());
    }

    #[tokio::test]
    async fn test_previous_key_cleared_after_grace_period() {
        let km = Arc::new(KeyManager::new(
            Duration::from_secs(3600),
            Duration::from_secs(60),
        ));

        // 현재 키로 암호화
        let keys = km.keys.read().await;
        let old_public = keys.current.public;
        drop(keys);

        let (encrypted, _) = encrypt_for_key(&old_public, b"expired data");

        // 로테이션 + 이전 키 제거
        km.rotate().await;
        km.clear_previous().await;

        // 이전 키가 없으므로 복호화 실패해야 함
        let result = km.decrypt(&encrypted).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_no_key_id_fallback() {
        let km = Arc::new(KeyManager::new(
            Duration::from_secs(3600),
            Duration::from_secs(60),
        ));

        // 현재 키로 암호화 (key_id 없이)
        let keys = km.keys.read().await;
        let old_public = keys.current.public;
        drop(keys);

        let (mut encrypted, _) = encrypt_for_key(&old_public, b"no key id data");
        encrypted.key_id = None; // key_id 제거 (하위 호환 시뮬레이션)

        // 로테이션 후에도 fallback으로 복호화 성공
        km.rotate().await;
        let decrypted = km.decrypt(&encrypted).await.unwrap();
        assert_eq!(decrypted.len(), b"no key id data".len());
    }
}
