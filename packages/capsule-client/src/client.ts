import { encryptImage, fileToBytes } from './crypto';
import type {
  AnalyzeImageOptions,
  ChatOptions,
  ChatRequest,
  ChatResponse,
  CapsuleClientOptions,
  PublicKeyResponse,
  StreamCallback,
  ToolCallCallback,
  ToolCallResult,
} from './types';

/**
 * Authentication error
 *
 * Thrown when authentication token is missing or expired
 */
export class CapsuleAuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'CapsuleAuthError';
  }
}

/**
 * Rate limit error
 *
 * Thrown when daily usage limit is exceeded
 */
export class CapsuleRateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'CapsuleRateLimitError';
  }
}

/**
 * Subscription required error
 *
 * Thrown when a non-subscriber tries to access Pro features
 */
export class CapsuleSubscriptionError extends Error {
  constructor(message: string = 'Pro subscription required') {
    super(message);
    this.name = 'CapsuleSubscriptionError';
  }
}

/**
 * Capsule Client
 *
 * Client SDK for secure image analysis
 *
 * @example
 * ```typescript
 * const client = new CapsuleClient({
 *   baseUrl: 'https://capsule.example.com',
 * });
 *
 * // Analyze image
 * const response = await client.analyzeImage({
 *   image: imageFile,
 *   message: 'Please analyze this image',
 * });
 *
 * console.log(response.response);
 * ```
 */
export class CapsuleClient {
  private baseUrl: string;
  private timeout: number;
  private serverPublicKey: string | null = null;
  private getAccessToken?: () => Promise<string | null>;

  constructor(options: CapsuleClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeout = options.timeout ?? 60000;
    this.getAccessToken = options.getAccessToken;
  }

  /**
   * Fetch server public key
   *
   * Cached - reused once fetched.
   * Requires re-fetching after server restart.
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
   * Invalidate cached public key
   *
   * Should be called after server restart.
   */
  clearPublicKeyCache(): void {
    this.serverPublicKey = null;
  }

  /**
   * Change Base URL
   *
   * Automatically clears key cache since a different server has a different key.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
    this.serverPublicKey = null;
  }

  /**
   * Text-only chat
   *
   * @param message - User message
   * @param options - Conversation history and system prompt (optional)
   */
  async chat(message: string, options?: ChatOptions): Promise<ChatResponse> {
    const request: ChatRequest = {
      message,
      ...(options?.history && { history: options.history }),
      ...(options?.systemPrompt && { system_prompt: options.systemPrompt }),
      ...(options?.tools && { tools: options.tools }),
      ...(options?.toolChoice && { tool_choice: options.toolChoice }),
    };

    return this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Image analysis
   *
   * @param options - Analysis options
   * @returns AI response
   *
   * ## Secure data flow
   * 1. Fetch server public key (cached)
   * 2. Encrypt image with public key (X25519 + XChaCha20-Poly1305)
   * 3. Send encrypted image to server
   * 4. Server decrypts and analyzes with AI
   * 5. Receive response
   */
  async analyzeImage(options: AnalyzeImageOptions, chatOptions?: ChatOptions): Promise<ChatResponse> {
    const publicKey = await this.getPublicKey();

    let imageBytes: Uint8Array;
    if (options.image instanceof Uint8Array) {
      imageBytes = options.image;
    } else {
      imageBytes = await fileToBytes(options.image);
    }

    const encryptedImage = await encryptImage(imageBytes, publicKey);

    const request: ChatRequest = {
      message: options.message,
      encrypted_image: encryptedImage,
      ...(chatOptions?.history && { history: chatOptions.history }),
      ...(chatOptions?.systemPrompt && { system_prompt: chatOptions.systemPrompt }),
      ...(chatOptions?.tools && { tools: chatOptions.tools }),
      ...(chatOptions?.toolChoice && { tool_choice: chatOptions.toolChoice }),
    };

    return this.fetch<ChatResponse>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Streaming chat
   *
   * @param message - User message
   * @param onChunk - Streaming chunk callback
   * @param options - Conversation history and system prompt (optional)
   */
  async chatStream(message: string, onChunk: StreamCallback, options?: ChatOptions): Promise<void> {
    const request: ChatRequest = {
      message,
      ...(options?.history && { history: options.history }),
      ...(options?.systemPrompt && { system_prompt: options.systemPrompt }),
      ...(options?.tools && { tools: options.tools }),
      ...(options?.toolChoice && { tool_choice: options.toolChoice }),
    };

    await this.fetchStream('/api/chat/stream', request, onChunk, options?.onToolCall);
  }

  /**
   * Streaming image analysis
   *
   * @param options - Image analysis options
   * @param onChunk - Streaming chunk callback
   * @param chatOptions - Conversation history and system prompt (optional)
   */
  async analyzeImageStream(
    options: AnalyzeImageOptions,
    onChunk: StreamCallback,
    chatOptions?: ChatOptions,
  ): Promise<void> {
    const publicKey = await this.getPublicKey();

    let imageBytes: Uint8Array;
    if (options.image instanceof Uint8Array) {
      imageBytes = options.image;
    } else {
      imageBytes = await fileToBytes(options.image);
    }

    const encryptedImage = await encryptImage(imageBytes, publicKey);

    const request: ChatRequest = {
      message: options.message,
      encrypted_image: encryptedImage,
      ...(chatOptions?.history && { history: chatOptions.history }),
      ...(chatOptions?.systemPrompt && { system_prompt: chatOptions.systemPrompt }),
      ...(chatOptions?.tools && { tools: chatOptions.tools }),
      ...(chatOptions?.toolChoice && { tool_choice: chatOptions.toolChoice }),
    };

    await this.fetchStream('/api/chat/stream', request, onChunk, chatOptions?.onToolCall);
  }

  /**
   * HTTP request
   */
  private async fetch<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      };

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

      if (response.status === 401) {
        throw new CapsuleAuthError('Authentication required. Please sign in.');
      }
      if (response.status === 403) {
        throw new CapsuleSubscriptionError(
          'Pro subscription required. Please upgrade at vessel.land/pricing'
        );
      }
      if (response.status === 429) {
        const errorText = await response.text();
        throw new CapsuleRateLimitError(errorText || 'Rate limit exceeded. Try again later.');
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
   * SSE streaming request
   */
  private async fetchStream(
    path: string,
    request: ChatRequest,
    onChunk: StreamCallback,
    onToolCall?: ToolCallCallback,
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

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

      if (response.status === 401) {
        throw new CapsuleAuthError('Authentication required. Please sign in.');
      }
      if (response.status === 403) {
        throw new CapsuleSubscriptionError(
          'Pro subscription required. Please upgrade at vessel.land/pricing'
        );
      }
      if (response.status === 429) {
        const errorText = await response.text();
        throw new CapsuleRateLimitError(errorText || 'Rate limit exceeded. Try again later.');
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
      let buffer = '';

      const processLine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6);

        if (data === '[DONE]') {
          onChunk('', true);
          return;
        }

        if (data.startsWith('[TOOL_CALLS]')) {
          if (onToolCall) {
            try {
              const toolCalls: ToolCallResult[] = JSON.parse(data.slice('[TOOL_CALLS]'.length));
              onToolCall(toolCalls);
            } catch {
              // malformed tool call JSON
            }
          }
          return;
        }

        onChunk(data, false);
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) {
            processLine(buffer.trim());
          }
          onChunk('', true);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            processLine(trimmed);
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
