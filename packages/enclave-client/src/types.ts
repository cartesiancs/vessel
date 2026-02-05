/**
 * 암호화된 이미지 데이터
 */
export interface EncryptedImage {
  /** 클라이언트 임시 공개키 (base64) */
  ephemeral_public_key: string;
  /** Nonce (base64) */
  nonce: string;
  /** 암호화된 데이터 (base64) */
  ciphertext: string;
}

/**
 * 채팅 요청
 */
export interface ChatRequest {
  /** 사용자 메시지 */
  message: string;
  /** 암호화된 이미지 (선택사항) */
  encrypted_image?: EncryptedImage;
}

/**
 * 채팅 응답
 */
export interface ChatResponse {
  /** AI 응답 */
  response: string;
}

/**
 * Public Key 응답
 */
export interface PublicKeyResponse {
  /** 서버 공개키 (base64) */
  public_key: string;
}

/**
 * Enclave 클라이언트 옵션
 */
export interface EnclaveClientOptions {
  /** Enclave 서버 URL */
  baseUrl: string;
  /** 요청 타임아웃 (ms) */
  timeout?: number;
  /**
   * Access token provider
   *
   * Supabase 세션 토큰을 제공하는 함수
   * 인증이 필요한 API 호출 시 자동으로 Authorization 헤더에 추가됨
   *
   * @example
   * ```typescript
   * const client = new EnclaveClient({
   *   baseUrl: 'https://enclave.example.com',
   *   getAccessToken: async () => {
   *     const { data: { session } } = await supabase.auth.getSession();
   *     return session?.access_token ?? null;
   *   },
   * });
   * ```
   */
  getAccessToken?: () => Promise<string | null>;
}

/**
 * 이미지 분석 요청 옵션
 */
export interface AnalyzeImageOptions {
  /** 분석할 이미지 (File, Blob, 또는 Uint8Array) */
  image: File | Blob | Uint8Array;
  /** 분석 요청 메시지 */
  message: string;
}

/**
 * 스트리밍 이벤트 콜백
 */
export type StreamCallback = (chunk: string, done: boolean) => void;
