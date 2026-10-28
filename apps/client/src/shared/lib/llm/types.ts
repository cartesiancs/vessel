/** OpenAI chat-completions shapes shared by the chat panel and the flow tools. */

export interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Tool {
  type: "function";
  function: ToolFunction;
}

export interface ToolCallResult {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface HistoryMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCallResult[];
}

export type StreamCallback = (chunk: string, done: boolean) => void;

export interface ChatOptions {
  systemPrompt?: string;
  history?: HistoryMessage[];
  tools?: Tool[];
  toolChoice?: "auto" | "required" | "none";
  onToolCall?: (toolCalls: ToolCallResult[]) => void;
}

/** Where chat requests go. Stored locally; nothing is sent anywhere else. */
export interface LlmSettings {
  /** OpenAI-compatible API root, e.g. http://localhost:11434/v1 (Ollama) */
  baseUrl: string;
  model: string;
  /** Optional; local servers usually need none */
  apiKey: string;
}
