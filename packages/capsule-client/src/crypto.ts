import { x25519 } from '@noble/curves/ed25519';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/ciphers/webcrypto';
import type { EncryptedImage } from './types';

/** HKDF salt (서버와 동일해야 함) */
const HKDF_SALT = new TextEncoder().encode('vessel-enclave-v1-salt');
/** HKDF info (서버와 동일해야 함) */
const HKDF_INFO = new TextEncoder().encode('vessel-enclave-v1-key');

/**
 * Base64 encoding (handles large arrays)
 */
function bytesToBase64(bytes: Uint8Array): string {
  // Use chunked approach to avoid stack overflow for large images
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }

  return btoa(chunks.join(''));
}

/**
 * Base64 디코딩
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Uint8Array를 0으로 덮어씀 (메모리 클리어)
 */
function zeroize(arr: Uint8Array): void {
  arr.fill(0);
}

/**
 * 이미지를 서버 공개키로 암호화
 *
 * @param imageData - 암호화할 이미지 데이터
 * @param serverPublicKeyBase64 - 서버 공개키 (base64)
 * @returns 암호화된 이미지 데이터
 *
 * @example
 * ```typescript
 * const encrypted = await encryptImage(imageBytes, serverPublicKey);
 * // encrypted.ephemeral_public_key - 클라이언트 임시 공개키
 * // encrypted.nonce - 24바이트 nonce
 * // encrypted.ciphertext - 암호화된 데이터
 * ```
 *
 * ## 암호화 스킴
 * 1. 클라이언트 임시 키 쌍 생성 (X25519)
 * 2. ECDH로 shared secret 계산
 * 3. HKDF-SHA256으로 대칭키 유도
 * 4. XChaCha20-Poly1305로 암호화 (AEAD)
 *
 * ## 보안
 * - 임시 비밀키는 사용 후 즉시 zeroize
 * - Shared secret도 사용 후 즉시 zeroize
 */
export async function encryptImage(
  imageData: Uint8Array,
  serverPublicKeyBase64: string
): Promise<EncryptedImage> {
  // 1. 서버 공개키 디코딩
  const serverPublicKey = base64ToBytes(serverPublicKeyBase64);

  // 2. 클라이언트 임시 키 쌍 생성
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  // 3. Shared secret 계산 (X25519 ECDH)
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, serverPublicKey);

  // 4. HKDF로 대칭키 유도 (32 bytes for XChaCha20)
  const symmetricKey = hkdf(sha256, sharedSecret, HKDF_SALT, HKDF_INFO, 32);

  // Shared secret 즉시 클리어
  zeroize(sharedSecret);

  // 5. Nonce 생성 (24 bytes for XChaCha20)
  const nonce = randomBytes(24);

  // 6. XChaCha20-Poly1305로 암호화
  const cipher = xchacha20poly1305(symmetricKey, nonce);
  const ciphertext = cipher.encrypt(imageData);

  // 민감 데이터 클리어
  zeroize(ephemeralPrivateKey);
  zeroize(symmetricKey);

  return {
    ephemeral_public_key: bytesToBase64(ephemeralPublicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * File 또는 Blob을 Uint8Array로 변환
 */
export async function fileToBytes(file: File | Blob): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
