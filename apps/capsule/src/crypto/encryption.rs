use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use hkdf::Hkdf;
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

use crate::error::CapsuleError;
use crate::types::{DecryptedImage, EncryptedImage};

/// HKDF에 사용할 salt와 info
const HKDF_SALT: &[u8] = b"vessel-capsule-v1-salt";
const HKDF_INFO: &[u8] = b"vessel-capsule-v1-key";

/// 특정 비밀키로 암호화된 이미지 복호화
///
/// # 보안
/// - Shared secret은 함수 종료 시 zeroize됨
/// - 반환되는 `DecryptedImage`는 Drop 시 자동 zeroize
///
/// # 암호화 스킴
/// 1. X25519 ECDH로 shared secret 계산
/// 2. HKDF-SHA256으로 대칭키 유도
/// 3. XChaCha20-Poly1305로 복호화 (AEAD)
pub(crate) fn decrypt_with_secret(
    server_secret: &StaticSecret,
    encrypted: &EncryptedImage,
) -> Result<DecryptedImage, CapsuleError> {
    // 1. Base64 디코딩
    let ephemeral_pk_bytes = STANDARD
        .decode(&encrypted.ephemeral_public_key)
        .map_err(|_| CapsuleError::InvalidPublicKey)?;

    let nonce_bytes = STANDARD
        .decode(&encrypted.nonce)
        .map_err(|_| CapsuleError::InvalidNonce)?;

    let ciphertext = STANDARD
        .decode(&encrypted.ciphertext)
        .map_err(|_| CapsuleError::InvalidCiphertext)?;

    // 2. 공개키 파싱 (32 bytes)
    let ephemeral_pk: [u8; 32] = ephemeral_pk_bytes
        .try_into()
        .map_err(|_| CapsuleError::InvalidPublicKey)?;
    let client_public = PublicKey::from(ephemeral_pk);

    // 3. Shared Secret 계산 (X25519 ECDH)
    let mut shared_secret = server_secret.diffie_hellman(&client_public);

    // 4. HKDF로 대칭키 유도 (32 bytes for XChaCha20)
    let mut symmetric_key = [0u8; 32];
    let hkdf = Hkdf::<Sha256>::new(Some(HKDF_SALT), shared_secret.as_bytes());
    hkdf.expand(HKDF_INFO, &mut symmetric_key)
        .map_err(|_| CapsuleError::CipherInitFailed)?;

    // Shared secret 즉시 클리어
    shared_secret.zeroize();

    // 5. Nonce 파싱 (24 bytes for XChaCha20)
    let nonce: [u8; 24] = nonce_bytes
        .try_into()
        .map_err(|_| CapsuleError::InvalidNonce)?;

    // 6. XChaCha20-Poly1305로 복호화
    let cipher =
        XChaCha20Poly1305::new_from_slice(&symmetric_key).map_err(|_| CapsuleError::CipherInitFailed)?;

    // 대칭키 즉시 클리어
    symmetric_key.zeroize();

    let plaintext = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| CapsuleError::DecryptionFailed)?;

    tracing::debug!("Successfully decrypted {} bytes", plaintext.len());

    Ok(DecryptedImage::new(plaintext))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decrypt_invalid_public_key() {
        let secret = StaticSecret::random_from_rng(rand::thread_rng());

        let encrypted = EncryptedImage {
            ephemeral_public_key: "invalid".to_string(),
            nonce: STANDARD.encode([0u8; 24]),
            ciphertext: STANDARD.encode(vec![0u8; 32]),
            key_id: None,
        };

        let result = decrypt_with_secret(&secret, &encrypted);
        assert!(matches!(result, Err(CapsuleError::InvalidPublicKey)));
    }

    #[test]
    fn test_decrypt_invalid_nonce() {
        let secret = StaticSecret::random_from_rng(rand::thread_rng());

        let encrypted = EncryptedImage {
            ephemeral_public_key: STANDARD.encode([0u8; 32]),
            nonce: "invalid".to_string(),
            ciphertext: STANDARD.encode(vec![0u8; 32]),
            key_id: None,
        };

        let result = decrypt_with_secret(&secret, &encrypted);
        assert!(matches!(result, Err(CapsuleError::InvalidNonce)));
    }
}
