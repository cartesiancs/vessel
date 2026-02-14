/**
 * 클라이언트 측 암호화 유틸리티
 * 서버의 암호화 스킴과 동일하게 구현
 */

import { x25519 } from '@noble/curves/ed25519';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/ciphers/webcrypto';

/** HKDF 상수 (서버와 동일해야 함) */
const HKDF_SALT = new TextEncoder().encode('vessel-capsule-v1-salt');
const HKDF_INFO = new TextEncoder().encode('vessel-capsule-v1-key');

/** Base64 인코딩 */
export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

/** Base64 디코딩 */
export function base64ToBytes(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * 이미지를 서버 공개키로 암호화
 *
 * @param {Uint8Array} imageData - 암호화할 이미지 데이터
 * @param {string} serverPublicKeyBase64 - 서버 공개키 (base64)
 * @returns {Promise<Object>} 암호화된 이미지 데이터
 */
export async function encryptImage(imageData, serverPublicKeyBase64) {
  // 1. 서버 공개키 디코딩
  const serverPublicKey = base64ToBytes(serverPublicKeyBase64);

  // 2. 클라이언트 임시 키 쌍 생성
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  // 3. Shared secret 계산 (X25519 ECDH)
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, serverPublicKey);

  // 4. HKDF로 대칭키 유도
  const symmetricKey = hkdf(sha256, sharedSecret, HKDF_SALT, HKDF_INFO, 32);

  // 5. Nonce 생성 (24 bytes)
  const nonce = randomBytes(24);

  // 6. XChaCha20-Poly1305로 암호화
  const cipher = xchacha20poly1305(symmetricKey, nonce);
  const ciphertext = cipher.encrypt(imageData);

  // 민감 데이터 클리어
  ephemeralPrivateKey.fill(0);
  sharedSecret.fill(0);
  symmetricKey.fill(0);

  return {
    ephemeral_public_key: bytesToBase64(ephemeralPublicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}
