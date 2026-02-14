/**
 * @vessel/capsule-client
 *
 * 보안 이미지 분석을 위한 클라이언트 SDK
 *
 * ## 설치
 * ```bash
 * npm install @vessel/capsule-client
 * ```
 *
 * ## 사용법
 * ```typescript
 * import { CapsuleClient } from '@vessel/capsule-client';
 *
 * const client = new CapsuleClient({
 *   baseUrl: 'https://capsule.example.com',
 * });
 *
 * // 이미지 분석
 * const response = await client.analyzeImage({
 *   image: imageFile,  // File, Blob, 또는 Uint8Array
 *   message: '이 이미지를 분석해주세요',
 * });
 *
 * console.log(response.response);
 * ```
 *
 * ## 보안
 * - 이미지는 서버 공개키로 암호화됨 (X25519 + XChaCha20-Poly1305)
 * - 서버에서만 복호화 가능 (Private Key는 서버 메모리에만 존재)
 * - 호스팅 제공자도 이미지에 접근 불가
 *
 * @packageDocumentation
 */

export {
  CapsuleClient,
  CapsuleAuthError,
  CapsuleRateLimitError,
  CapsuleSubscriptionError,
} from './client';
export { encryptImage, fileToBytes } from './crypto';
export type {
  EncryptedImage,
  ChatRequest,
  ChatResponse,
  PublicKeyResponse,
  CapsuleClientOptions,
  AnalyzeImageOptions,
  StreamCallback,
} from './types';
