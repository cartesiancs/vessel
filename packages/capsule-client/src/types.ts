/**
 * A single message in conversation history
 *
 * Used for multi-turn conversations. The client manages history
 * and includes it in each request.
 */
export interface HistoryMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Text content */
  content: string;
  /** Tool call ID (required when role is "tool") */
  tool_call_id?: string;
  /** Tool calls (when role is "assistant" and responding with tool calls) */
  tool_calls?: ToolCallResult[];
}

/**
 * OpenAI function calling tool definition
 */
export interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * OpenAI tool definition
 */
export interface Tool {
  type: 'function';
  function: ToolFunction;
}

/**
 * Tool call result returned by the LLM
 */
export interface ToolCallResult {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * Tool call received callback
 */
export type ToolCallCallback = (toolCalls: ToolCallResult[]) => void;

/**
 * Conversation history and system prompt options
 */
export interface ChatOptions {
  /** System prompt */
  systemPrompt?: string;
  /** Conversation history (oldest first) */
  history?: HistoryMessage[];
  /** OpenAI tools definition (function calling) */
  tools?: Tool[];
  /** OpenAI tool_choice ("auto" | "required" | "none") */
  toolChoice?: 'auto' | 'required' | 'none';
  /** Tool call received callback */
  onToolCall?: ToolCallCallback;
}

/**
 * Encrypted image data
 */
export interface EncryptedImage {
  /** Client ephemeral public key (base64) */
  ephemeral_public_key: string;
  /** Nonce (base64) */
  nonce: string;
  /** Encrypted data (base64) */
  ciphertext: string;
}

/**
 * Chat request
 */
export interface ChatRequest {
  /** User message */
  message: string;
  /** Encrypted image (optional) */
  encrypted_image?: EncryptedImage;
  /** Conversation history (optional, oldest first) */
  history?: HistoryMessage[];
  /** System prompt (optional) */
  system_prompt?: string;
  /** OpenAI tools definition (optional, function calling) */
  tools?: Tool[];
  /** OpenAI tool_choice (optional) */
  tool_choice?: string;
}

/**
 * Chat response
 */
export interface ChatResponse {
  /** AI response */
  response: string;
}

/**
 * Public Key response
 */
export interface PublicKeyResponse {
  /** Server public key (base64) */
  public_key: string;
}

/**
 * Capsule client options
 */
export interface CapsuleClientOptions {
  /** Capsule server URL */
  baseUrl: string;
  /** Request timeout (ms) */
  timeout?: number;
  /**
   * Access token provider
   *
   * Function that provides Supabase session tokens.
   * Automatically added to the Authorization header for authenticated API calls.
   *
   * @example
   * ```typescript
   * const client = new CapsuleClient({
   *   baseUrl: 'https://capsule.example.com',
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
 * Image analysis request options
 */
export interface AnalyzeImageOptions {
  /** Image to analyze (File, Blob, or Uint8Array) */
  image: File | Blob | Uint8Array;
  /** Analysis request message */
  message: string;
}

/**
 * Streaming event callback
 */
export type StreamCallback = (chunk: string, done: boolean) => void;
