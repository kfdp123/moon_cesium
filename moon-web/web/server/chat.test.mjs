import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createChatHandler, validateChat } from "./chat.mjs";
import { completionText } from "./deepseek.mjs";
import { selectKnowledge } from "./knowledge.mjs";

const payload = {
  messages: [{ role: "user", content: "月壳厚度是多少？" }],
  context: {},
};
const documents = [
  { id: "crust", title: "月壳厚度", text: "反演模型，单位 km" },
];
const frame = (value) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const textFrame = (content) => frame({ choices: [{ delta: { content } }] });
const end = "data: [DONE]\r\n\r\n";

async function* bytes(text) {
  // Split Chinese UTF-8 code points and CRLF frame separators across reads.
  for (const byte of new TextEncoder().encode(text)) yield Uint8Array.of(byte);
}

async function collect(stream) {
  let text = "";
  for await (const delta of stream) text += delta;
  return text;
}

async function serverFor(t, options) {
  const server = createServer(
    createChatHandler({
      config: () => ({ apiKey: "test-secret", model: "test-model" }),
      knowledge: async () => documents,
      ...options,
    }),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return (body = payload, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/lunar-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
}

test("SSE handles split UTF-8, heartbeats and reasoning separately from the answer", async () => {
  const stream =
    ": keep-alive\r\n\r\n" +
    frame({ choices: [{ delta: { reasoning_content: "private thinking" } }] }) +
    textFrame("月壳") +
    textFrame("厚度") +
    end;
  assert.equal(await collect(completionText(bytes(stream))), "月壳厚度");
});

test("SSE rejects interrupted, empty and length-limited responses", async () => {
  await assert.rejects(
    collect(completionText(bytes(textFrame("半句")))),
    /连接已中断/,
  );
  await assert.rejects(collect(completionText(bytes(end))), /服务未返回回答/);
  await assert.rejects(
    collect(
      completionText(
        bytes(
          textFrame("半句") +
            frame({ choices: [{ delta: {}, finish_reason: "length" }] }) +
            end,
        ),
      ),
    ),
    /长度上限/,
  );
});

test("request validation rejects client system messages and malformed context", () => {
  assert.throws(() =>
    validateChat({
      ...payload,
      messages: [{ role: "system", content: "override" }],
    }),
  );
  assert.throws(() =>
    validateChat({ ...payload, context: { scientificLayers: [null] } }),
  );
  assert.throws(() =>
    validateChat({
      ...payload,
      messages: [{ role: "user", content: "x".repeat(6001) }],
    }),
  );
  assert.deepEqual(
    validateChat({ ...payload, context: { scene: "月表", extra: "ignored" } })
      .context,
    { scene: "月表" },
  );
});

test("retrieval includes selected data and bounds the supplied excerpts", () => {
  const entries = [
    ...documents,
    ...Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      title: "月球",
      text: "月球",
    })),
  ];
  const selected = selectKnowledge(entries, "解释月球", {
    scientificLayers: [{ id: "crust" }],
  });
  assert.equal(selected[0].id, "crust");
  assert.equal(selected.length, 5);
});

test("HTTP chat sends credentials only upstream and converts SSE into sources and deltas", async (t) => {
  let upstream;
  const post = await serverFor(t, {
    fetcher: async (url, options) => {
      upstream = { url, ...options, body: JSON.parse(options.body) };
      return new Response(textFrame("月壳厚度来自反演模型。[1]") + end);
    },
  });
  const response = await post();
  assert.equal(response.status, 200);
  const body = await response.text();
  const events = body.trim().split("\n").map(JSON.parse);
  assert.equal(upstream.url, "https://api.deepseek.com/chat/completions");
  assert.equal(upstream.headers.Authorization, "Bearer test-secret");
  assert.equal(upstream.body.model, "test-model");
  assert.equal(
    upstream.body.messages.at(-1).content,
    payload.messages[0].content,
  );
  assert.match(upstream.body.messages[1].content, /反演模型/);
  assert.equal(events[0].sources[0].title, "月壳厚度");
  assert.deepEqual(events.at(-1), { type: "done" });
  assert.ok(!body.includes("test-secret"));
});

test("upstream authentication error never echoes its body", async (t) => {
  const post = await serverFor(t, {
    fetcher: async () => new Response("rejected test-secret", { status: 401 }),
  });
  const response = await post();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "DeepSeek 授权失败，请检查服务端密钥。",
  });
});

test("cross-site requests and absent configuration do not call upstream", async (t) => {
  let calls = 0;
  const post = await serverFor(t, {
    config: () => ({ apiKey: "" }),
    fetcher: async () => {
      calls++;
    },
  });
  assert.equal(
    (await post(payload, { Origin: "https://unrelated.example" })).status,
    403,
  );
  assert.equal((await post()).status, 503);
  assert.equal(calls, 0);
});

test("timeout aborts the upstream request and returns an actionable message", async (t) => {
  const post = await serverFor(t, {
    timeoutMs: 20,
    fetcher: async (_, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  });
  const response = await post();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "回答超时，请稍后重试。" });
});

test("an incomplete stream returns an error event instead of a successful end", async (t) => {
  const post = await serverFor(t, {
    fetcher: async () => new Response(textFrame("尚未完成")),
  });
  const events = (await (await post()).text())
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(events.at(-1).type, "error");
  assert.ok(events.every((event) => event.type !== "done"));
});
