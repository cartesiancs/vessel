import { describe, expect, it, vi } from "vitest";
import {
  LlmClient,
  LlmHttpError,
  LlmNotConfiguredError,
  readSseData,
} from "./client";
import type { LlmSettings } from "./types";

const settings: LlmSettings = {
  baseUrl: "http://localhost:11434/v1/",
  model: "llama3.2",
  apiKey: "",
};

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const event = (delta: object) =>
  `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;

function fakeFetch(body: ReadableStream<Uint8Array>, status = 200) {
  return vi.fn(async () => new Response(body, { status }));
}

describe("readSseData", () => {
  it("joins lines split across network chunks and stops at [DONE]", async () => {
    const out: string[] = [];
    for await (const data of readSseData(
      sseBody([
        'data: {"a"',
        ':1}\n\ndata: {"b":2}\n',
        '\ndata: [DONE]\n\ndata: {"c":3}\n',
      ]),
    )) {
      out.push(data);
    }
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });
});

describe("LlmClient", () => {
  it("streams content chunks to an OpenAI-compatible endpoint", async () => {
    const fetchImpl = fakeFetch(
      sseBody([
        event({ content: "Hel" }),
        event({ content: "lo" }),
        "data: [DONE]\n\n",
      ]),
    );
    const client = new LlmClient(() => settings, fetchImpl);
    const chunks: Array<[string, boolean]> = [];

    await client.chatStream("hi", (c, done) => chunks.push([c, done]), {
      systemPrompt: "be brief",
      history: [{ role: "assistant", content: "earlier" }],
    });

    expect(chunks).toEqual([
      ["Hel", false],
      ["lo", false],
      ["", true],
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "llama3.2", stream: true });
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      "system",
      "assistant",
      "user",
    ]);
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("sends the API key only when one is configured", async () => {
    const fetchImpl = fakeFetch(sseBody(["data: [DONE]\n\n"]));
    const client = new LlmClient(
      () => ({ ...settings, apiKey: " sk-test " }),
      fetchImpl,
    );
    await client.chatStream("hi", () => {});
    const init = (
      fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test",
    );
  });

  it("assembles tool calls streamed in fragments", async () => {
    const fetchImpl = fakeFetch(
      sseBody([
        event({
          tool_calls: [
            {
              index: 0,
              id: "call_1",
              type: "function",
              function: { name: "add_", arguments: '{"ty' },
            },
          ],
        }),
        event({
          tool_calls: [
            { index: 0, function: { name: "node", arguments: 'pe":"log"}' } },
          ],
        }),
        event({
          tool_calls: [
            {
              index: 1,
              id: "call_2",
              function: { name: "connect", arguments: "{}" },
            },
          ],
        }),
        "data: [DONE]\n\n",
      ]),
    );
    const client = new LlmClient(() => settings, fetchImpl);
    const onToolCall = vi.fn();

    await client.chatStream("build a flow", () => {}, {
      tools: [
        {
          type: "function",
          function: { name: "add_node", description: "", parameters: {} },
        },
      ],
      onToolCall,
    });

    expect(onToolCall).toHaveBeenCalledWith([
      {
        id: "call_1",
        type: "function",
        function: { name: "add_node", arguments: '{"type":"log"}' },
      },
      {
        id: "call_2",
        type: "function",
        function: { name: "connect", arguments: "{}" },
      },
    ]);
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.tool_choice).toBe("auto");
  });

  it("refuses to send anything until a model is configured", async () => {
    const fetchImpl = fakeFetch(sseBody([]));
    const client = new LlmClient(
      () => ({ ...settings, model: " " }),
      fetchImpl,
    );
    await expect(client.chatStream("hi", () => {})).rejects.toBeInstanceOf(
      LlmNotConfiguredError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces HTTP errors with their status", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("invalid api key", { status: 401 }),
    );
    const client = new LlmClient(() => settings, fetchImpl);
    const error = await client.chatStream("hi", () => {}).catch((e) => e);
    expect(error).toBeInstanceOf(LlmHttpError);
    expect(error.status).toBe(401);
    expect(error.message).toContain("invalid api key");
  });

  it("sends an image as a data URL content part", async () => {
    const fetchImpl = fakeFetch(sseBody(["data: [DONE]\n\n"]));
    const client = new LlmClient(() => settings, fetchImpl);
    const image = new File([new Uint8Array([1, 2, 3])], "a.png", {
      type: "image/png",
    });

    await client.analyzeImageStream(
      { image, message: "what is this" },
      () => {},
    );

    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.messages.at(-1).content).toEqual([
      { type: "text", text: "what is this" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AQID" } },
    ]);
  });
});
