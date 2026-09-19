import { describe, expect, it, vi } from "vitest";
import {
  LunarChatError,
  parseLunarChatLines,
  streamLunarChat,
} from "./lunarChat";

describe("lunar chat NDJSON", () => {
  it("keeps an incomplete line until the next chunk", () => {
    const first = parseLunarChatLines('{"type":"delta","content":"月');
    expect(first.events).toEqual([]);
    const second = parseLunarChatLines(
      first.remainder + '球"}\n{"type":"done"}\n',
    );
    expect(second.events).toEqual([
      { type: "delta", content: "月球" },
      { type: "done" },
    ]);
    expect(second.remainder).toBe("");
  });

  it("rejects malformed events and an unterminated response", async () => {
    expect(() => parseLunarChatLines('{"type":"unknown"}\n')).toThrow(
      LunarChatError,
    );
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"type":"delta","content":"x"}\n'),
          );
          controller.close();
        },
      }),
      { status: 200 },
    );
    vi.stubGlobal("fetch", async () => response);
    await expect(
      streamLunarChat(
        { messages: [{ role: "user", content: "问题" }], context: {} },
        { onEvent: () => undefined },
      ),
    ).rejects.toThrow("中断");
    vi.unstubAllGlobals();
  });

  it("reports a server JSON error for a non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "服务暂不可用" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    );
    await expect(
      streamLunarChat(
        { messages: [{ role: "user", content: "问题" }], context: {} },
        { onEvent: () => undefined },
      ),
    ).rejects.toThrow("服务暂不可用");
    vi.unstubAllGlobals();
  });

  it("cancels an active reader cleanly when the request is aborted", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(new ReadableStream({ start() {} }), {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        }),
    );
    const controller = new AbortController();
    const pending = streamLunarChat(
      { messages: [{ role: "user", content: "问题" }], context: {} },
      { onEvent: () => undefined, signal: controller.signal },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(pending).rejects.toThrow("中断");
  });
});
