import { encryptImage, fileToBytes } from './crypto';
import type {
  AnalyzeImageOptions,
  ChatRequest,
  ChatResponse,
  EnclaveClientOptions,
  PublicKeyResponse,
  StreamCallback,
} from './types';

/**
 * Authentication error
 *
 * 인증 토큰이 없거나 만료된 경우 발생
 */
export class EnclaveAuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'EnclaveAuthError';
  }
}

/**
 * Rate limit error
 *
 * 일일 사용량 제한을 초과한 경우 발생
 */
export class EnclaveRateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'EnclaveRateLimitError';
  }
}

/**
 * Subscription required error
 *
 * Pro 구독이 필요한 기능을 비구독자가 사용하려 할 때 발생
 */
export class EnclaveSubscriptionError extends Error {
  constructor(message: string = 'Pro subscription required') {
    super(message);
    this.name = 'EnclaveSubscriptionError';
  }
}

/**
 * Enclave 클라이언트
 *
 * 보안 이미지 분석을 위한 클라이언트 SDK
 *
 * @example
 * ```typescript
 * const client = new EnclaveClient({
 *   baseUrl: 'https://enclave.example.com',
 * });
 *
 * // 이미지 분석
 * const response = await client.analyzeImage({
 *   image: imageFile,
 *   message: '이 이미지를 분석해주세요',
 * });
 *
 * console.log(response.response);
 * ```
 */
export class EnclaveClient {
  private baseUrl: string;
  private timeout: number;
  private serverPublicKey: string | null = null;
  private getAccessToken?: () => Promise<string | null>;

  constructor(options: EnclaveClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // trailing slash 제거
    this.timeout = options.timeout ?? 60000;
    this.getAccessToken = options.getAccessToken;
  }

  /**
   * 서버 공개키 획득
   *
   * 캐싱됨 - 한 번 획득하면 재사용
   * 서버 재시작 시 새로 획득 필요
   */
  async getPublicKey(): Promise<string> {
    if (this.serverPublicKey) {
      return this.serverPublicKey;
    }

    const response = await this.fetch<PublicKeyResponse>('/api/public-key', {
      method: 'GET',
    });

    this.serverPublicKey = response.public_key;
    return this.serverPublicKey;
  }

  /**
   * 캐시된 공개키 무효화
   *
   * 서버 재시작 후 호출 필요
   */
  clearPublicKeyCache(): void {
    this.serverPublicKey = null;
  }

  /**
   * 텍스트 전용 채팅
   */
  async chat(message: string): Promise<ChatResponse> {
    const request: ChatRequest = { message };

    return this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * 이미지 분석
   *
   * @param options - 분석 옵션
   * @returns AI 응답
   *
   * ## 보안 데이터 흐름
   * 1. 서버 공개키 획득 (캐시됨)
   * 2. 이미지를 공개키로 암호화 (X25519 + XChaCha20-Poly1305)
   * 3. 암호화된 이미지를 서버로 전송
   * 4. 서버에서 복호화 후 AI 분석
   * 5. 응답 수신
   */
  async analyzeImage(options: AnalyzeImageOptions): Promise<ChatResponse> {
    // 1. 서버 공개키 획득
    const publicKey = await this.getPublicKey();

    // 2. 이미지를 바이트 배열로 변환
    let imageBytes: Uint8Array;
    if (options.image instanceof Uint8Array) {
      imageBytes = options.image;
    } else {
      imageBytes = await fileToBytes(options.image);
    }

    // 3. 이미지 암호화
    const encryptedImage = await encryptImage(imageBytes, publicKey);

    // 4. 요청 전송
    const request: ChatRequest = {
      message: options.message,
      encrypted_image: encryptedImage,
    };

    return this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * 스트리밍 채팅
   */
  async chatStream(message: string, onChunk: StreamCallback): Promise<void> {
    const request: ChatRequest = { message };

    await this.fetchStream('/api/chat/stream', request, onChunk);
  }

  /**
   * 스트리밍 이미지 분석
   */
  async analyzeImageStream(
    options: AnalyzeImageOptions,
    onChunk: StreamCallback
  ): Promise<void> {
    // 1. 서버 공개키 획득
    const publicKey = await this.getPublicKey();

    // 2. 이미지를 바이트 배열로 변환
    let imageBytes: Uint8Array;
    if (options.image instanceof Uint8Array) {
      imageBytes = options.image;
    } else {
      imageBytes = await fileToBytes(options.image);
    }

    // 3. 이미지 암호화
    const encryptedImage = await encryptImage(imageBytes, publicKey);

    // 4. 스트리밍 요청
    const request: ChatRequest = {
      message: options.message,
      encrypted_image: encryptedImage,
    };

    await this.fetchStream('/api/chat/stream', request, onChunk);
  }

  /**
   * HTTP 요청
   */
  private async fetch<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      };

      // Add Authorization header if token provider is configured
      if (this.getAccessToken) {
        const token = await this.getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });

      // Handle auth-related errors
      if (response.status === 401) {
        throw new EnclaveAuthError('Authentication required. Please sign in.');
      }
      if (response.status === 403) {
        throw new EnclaveSubscriptionError(
          'Pro subscription required. Please upgrade at vessel.land/pricing'
        );
      }
      if (response.status === 429) {
        const errorText = await response.text();
        throw new EnclaveRateLimitError(errorText || 'Rate limit exceeded. Try again later.');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Request failed: ${response.status} ${error}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * SSE 스트리밍 요청
   */
  private async fetchStream(
    path: string,
    request: ChatRequest,
    onChunk: StreamCallback
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if token provider is configured
      if (this.getAccessToken) {
        const token = await this.getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Handle auth-related errors
      if (response.status === 401) {
        throw new EnclaveAuthError('Authentication required. Please sign in.');
      }
      if (response.status === 403) {
        throw new EnclaveSubscriptionError(
          'Pro subscription required. Please upgrade at vessel.land/pricing'
        );
      }
      if (response.status === 429) {
        const errorText = await response.text();
        throw new EnclaveRateLimitError(errorText || 'Rate limit exceeded. Try again later.');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Request failed: ${response.status} ${error}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onChunk('', true);
          break;
        }

        const text = decoder.decode(value, { stream: true });

        // SSE 이벤트 파싱
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              onChunk('', true);
              return;
            }

            onChunk(data, false);
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
