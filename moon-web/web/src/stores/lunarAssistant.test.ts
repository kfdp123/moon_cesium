import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useLunarAssistant } from "./lunarAssistant";

function responseFromChunks(chunks: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
  );
}

describe("lunar assistant session", () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the latest twelve messages and starts history with a user", async () => {
    const requests: { messages: { role: string; content: string }[] }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return responseFromChunks([
        '{"type":"delta","content":"回答"}\n{"type":"done"}\n',
      ]);
    });
    const store = useLunarAssistant();
    for (let index = 0; index < 8; index++) await store.send(`问题${index}`);

    const history = requests.at(-1)!.messages;
    expect(history).toHaveLength(11);
    expect(history[0]).toEqual({ role: "user", content: "问题2" });
    expect(history.at(-1)).toEqual({ role: "user", content: "问题7" });
  });

  it("does not duplicate a failed question when retrying", async () => {
    let calls = 0;
    const requests: { messages: { role: string; content: string }[] }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      calls++;
      if (calls === 1)
        return new Response(JSON.stringify({ error: "暂时不可用" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      return responseFromChunks(['{"type":"done"}\n']);
    });
    const store = useLunarAssistant();
    await store.send("重试这个问题");
    expect(store.error).toBe("暂时不可用");
    await store.retry();
    expect(requests[1]!.messages).toEqual([
      { role: "user", content: "重试这个问题" },
    ]);
    expect(
      store.messages.filter((message) => message.role === "user"),
    ).toHaveLength(1);
  });

  it("keeps generated text after stop but excludes the interrupted part from history", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  '{"type":"delta","content":"已生成"}\n',
                ),
              );
            },
          }),
          { status: 200, headers: { "Content-Type": "application/x-ndjson" } },
        ),
    );
    const store = useLunarAssistant();
    const pending = store.send("停止这个问题");
    await Promise.resolve();
    await Promise.resolve();
    store.stop();
    await pending;

    expect(store.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "已生成",
      status: "interrupted",
    });
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body));
      expect(request.messages).toEqual([
        { role: "user", content: "停止这个问题" },
      ]);
      return responseFromChunks(['{"type":"done"}\n']);
    });
    await store.send("继续询问");
  });
});
