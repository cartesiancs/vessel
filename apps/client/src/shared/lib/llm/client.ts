import type {
  ChatOptions,
  HistoryMessage,
  LlmSettings,
  StreamCallback,
  ToolCallResult,
} from "./types";

const REQUEST_TIMEOUT_MS = 120_000;
const SSE_DATA_PREFIX = "data:";
const SSE_DONE = "[DONE]";

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("No AI model is configured. Set one up in Settings → AI.");
    this.name = "LlmNotConfiguredError";
  }
}

export class LlmHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "LlmHttpError";
  }
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type RequestMessage = Omit<HistoryMessage, "content"> & {
  content: string | ContentPart[];
};

interface StreamDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

/** Collects streamed tool-call fragments, which arrive split across chunks by index. */
export class ToolCallAccumulator {
  private calls = new Map<number, ToolCallResult>();

  add(delta: StreamDelta): void {
    for (const part of delta.tool_calls ?? []) {
      const call = this.calls.get(part.index) ?? {
        id: "",
        type: "function" as const,
        function: { name: "", arguments: "" },
      };
      if (part.id) call.id = part.id;
      if (part.function?.name) call.function.name += part.function.name;
      if (part.function?.arguments)
        call.function.arguments += part.function.arguments;
      this.calls.set(part.index, call);
    }
  }

  result(): ToolCallResult[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, call]) => call);
  }
}

/** Yields the JSON payload of every `data:` line of a server-sent event stream. */
export async function* readSseData(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.startsWith(SSE_DATA_PREFIX)) {
        const data = line.slice(SSE_DATA_PREFIX.length).trim();
        if (data === SSE_DONE) return;
        if (data) yield data;
      }
      newline = buffer.indexOf("\n");
    }
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

/**
 * Talks directly to any OpenAI-compatible chat-completions endpoint the user configured
 * (OpenAI, a local Ollama or LM Studio, ...). No account or relay is involved.
 */
export class LlmClient {
  constructor(
    private readonly getSettings: () => LlmSettings,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async chatStream(
    message: string,
    onChunk: StreamCallback,
    options: ChatOptions = {},
  ) {
    await this.stream(this.buildMessages(message, options), onChunk, options);
  }

  async analyzeImageStream(
    { image, message }: { image: File; message: string },
    onChunk: StreamCallback,
    options: ChatOptions = {},
  ) {
    const url = await fileToDataUrl(image);
    const messages = this.buildMessages("", options);
    messages[messages.length - 1] = {
      role: "user",
      content: [
        { type: "text", text: message },
        { type: "image_url", image_url: { url } },
      ],
    };
    await this.stream(messages, onChunk, options);
  }

  private buildMessages(
    message: string,
    options: ChatOptions,
  ): RequestMessage[] {
    const messages: RequestMessage[] = [];
    if (options.systemPrompt)
      messages.push({ role: "system", content: options.systemPrompt });
    messages.push(...(options.history ?? []));
    messages.push({ role: "user", content: message });
    return messages;
  }

  private async stream(
    messages: RequestMessage[],
    onChunk: StreamCallback,
    options: ChatOptions,
  ) {
    const settings = this.getSettings();
    if (!settings.baseUrl.trim() || !settings.model.trim()) {
      throw new LlmNotConfiguredError();
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (settings.apiKey.trim())
      headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(
        `${settings.baseUrl.trim().replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: settings.model.trim(),
            messages,
            stream: true,
            ...(options.tools?.length && {
              tools: options.tools,
              tool_choice: options.toolChoice ?? "auto",
            }),
          }),
        },
      );
      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        throw new LlmHttpError(
          response.status,
          `AI request failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        );
      }

      const toolCalls = new ToolCallAccumulator();
      for await (const data of readSseData(response.body)) {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: StreamDelta }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) onChunk(delta.content, false);
        toolCalls.add(delta);
      }
      const calls = toolCalls.result();
      if (calls.length > 0) options.onToolCall?.(calls);
      onChunk("", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
