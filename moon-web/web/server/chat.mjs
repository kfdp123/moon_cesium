import { chatConfig } from "./config.mjs";
import { loadKnowledge, selectKnowledge, buildMessages } from "./knowledge.mjs";
import { completionText, CompletionError } from "./deepseek.mjs";

const API_URL = "https://api.deepseek.com/chat/completions";

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

export function validateChat(value) {
  const messages = value?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 12)
    throw new Error("请提供最多 12 条对话消息。");
  if (
    messages.some(
      (message) =>
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 6000,
    ) ||
    messages[0].role !== "user" ||
    messages.at(-1).role !== "user"
  )
    throw new Error("提问格式无效，每条消息最多 6000 字。");
  const source = value.context ?? {};
  if (typeof source !== "object" || source === null || Array.isArray(source))
    throw new Error("场景上下文格式无效。");
  const context = Object.fromEntries(
    [
      "scene",
      "epoch",
      "selectedPoint",
      "selectedLayer",
      "scientificLayers",
      "query",
    ]
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
  if (
    context.scientificLayers !== undefined &&
    (!Array.isArray(context.scientificLayers) ||
      context.scientificLayers.some(
        (layer) => !layer || typeof layer.id !== "string",
      ))
  )
    throw new Error("科研图层格式无效。");
  if (JSON.stringify(context).length > 20000)
    throw new Error("当前场景资料过多，请减少选择的图层后再提问。");
  return {
    messages: messages.map(({ role, content }) => ({ role, content })),
    context,
  };
}

const upstreamError = (status) => {
  if (status === 401 || status === 403)
    return "DeepSeek 授权失败，请检查服务端密钥。";
  if (status === 402) return "DeepSeek 账户余额不足，请充值后重试。";
  if (status === 429) return "DeepSeek 请求较多，请稍后重试。";
  if (status === 400 || status === 404)
    return "DeepSeek 模型配置不可用，请检查服务端配置。";
  return "DeepSeek 服务暂时不可用，请稍后重试。";
};

export function createChatHandler({
  config = chatConfig,
  fetcher = fetch,
  knowledge = loadKnowledge,
  timeoutMs = 90000,
} = {}) {
  let active = 0;
  let started = [];
  return async function handleChat(req, res) {
    if (req.method !== "POST")
      return json(res, 405, { error: "请使用 POST 发送提问。" });
    // A cross-site browser cannot use the local server's credential.
    const origin = req.headers.origin;
    if (
      (origin &&
        ![`http://${req.headers.host}`, `https://${req.headers.host}`].includes(
          origin,
        )) ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return json(res, 403, { error: "请从本系统页面发起提问。" });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return json(res, 415, { error: "请求需要使用 JSON 格式。" });
    const settings = config();
    if (!settings.apiKey)
      return json(res, 503, { error: "尚未配置 DeepSeek 服务端密钥。" });
    let input;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 96000)
          return json(res, 413, { error: "对话过长，请开启新对话。" });
        chunks.push(chunk);
      }
      input = validateChat(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      return json(res, 400, {
        error: "提问或场景格式无效，请缩短内容后重试。",
      });
    }

    started = started.filter((time) => time > Date.now() - 60000);
    if (active >= 2 || started.length >= 12)
      return json(res, 429, { error: "提问较频繁，请稍后重试。" });
    active++;
    started.push(Date.now());
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("timeout")),
      timeoutMs,
    );
    const disconnected = () => controller.abort();
    res.on("close", disconnected);
    const send = (value) => {
      if (!res.destroyed) res.write(JSON.stringify(value) + "\n");
    };
    try {
      const documents = selectKnowledge(
        await knowledge(),
        input.messages.at(-1).content,
        input.context,
      );
      const response = await fetcher(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: buildMessages(input.messages, input.context, documents),
          stream: true,
          thinking: { type: "disabled" },
          max_tokens: 2400,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        return json(res, response.status === 429 ? 429 : 502, {
          error: upstreamError(response.status),
        });
      }
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      });
      send({
        type: "sources",
        sources: documents.map((document, index) => ({
          id: String(index + 1),
          title: document.title,
          url: document.url,
        })),
      });
      for await (const content of completionText(response.body))
        send({ type: "delta", content });
      send({ type: "done" });
      res.end();
    } catch (error) {
      if (res.destroyed) return;
      const message = controller.signal.aborted
        ? "回答超时，请稍后重试。"
        : error instanceof CompletionError
          ? error.message
          : "问答服务连接失败，请检查网络后重试。";
      if (res.headersSent) {
        send({ type: "error", message });
        res.end();
      } else json(res, 502, { error: message });
    } finally {
      clearTimeout(timeout);
      res.off("close", disconnected);
      controller.abort();
      active--;
    }
  };
}
