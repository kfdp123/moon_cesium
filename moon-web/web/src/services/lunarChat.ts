export type LunarChatRole = "user" | "assistant";

export interface LunarChatMessage {
  role: LunarChatRole;
  content: string;
}

export interface LunarChatSource {
  id: string;
  title: string;
  url?: string;
}

export type LunarChatEvent =
  | { type: "sources"; sources: LunarChatSource[] }
  | { type: "delta"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface LunarChatRequest {
  messages: LunarChatMessage[];
  context: Record<string, unknown>;
}

export class LunarChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LunarChatError";
  }
}

/**
 * Parses complete NDJSON lines and returns the unconsumed tail. Keeping this
 * function separate makes the fetch stream independent from the transport.
 */
export function parseLunarChatLines(
  buffer: string,
  flush = false,
): { events: LunarChatEvent[]; remainder: string } {
  const lines = buffer.split("\n");
  const remainder = flush ? "" : (lines.pop() ?? "");
  const events: LunarChatEvent[] = [];
  for (const line of flush
    ? lines.concat(remainder ? [remainder] : [])
    : lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      throw new LunarChatError("智能体返回的数据格式不完整，请稍后重试");
    }
    events.push(validateLunarChatEvent(value));
  }
  return { events, remainder };
}

function validateLunarChatEvent(value: unknown): LunarChatEvent {
  if (!value || typeof value !== "object")
    throw new LunarChatError("智能体返回了无法识别的数据");
  const event = value as Record<string, unknown>;
  if (event.type === "delta" && typeof event.content === "string")
    return { type: "delta", content: event.content };
  if (event.type === "sources" && Array.isArray(event.sources)) {
    const sources = event.sources
      .filter(
        (source): source is Record<string, unknown> =>
          !!source && typeof source === "object",
      )
      .filter(
        (source) =>
          typeof source.id === "string" && typeof source.title === "string",
      )
      .map((source) => ({
        id: source.id as string,
        title: source.title as string,
        ...(typeof source.url === "string" ? { url: source.url } : {}),
      }));
    return { type: "sources", sources };
  }
  if (event.type === "done") return { type: "done" };
  if (event.type === "error" && typeof event.message === "string")
    return { type: "error", message: event.message };
  throw new LunarChatError("智能体返回了无法识别的数据");
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim())
      return payload.error;
  } catch {
    // The status text below is more useful than a JSON parse error.
  }
  return `智能体服务暂时不可用（${response.status}）`;
}

export async function streamLunarChat(
  request: LunarChatRequest,
  handlers: {
    onEvent: (event: LunarChatEvent) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/lunar-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: handlers.signal,
    });
  } catch (cause) {
    if (handlers.signal?.aborted) throw cause;
    throw new LunarChatError("暂时无法连接月球智能体，请检查网络后重试");
  }

  if (!response.ok) throw new LunarChatError(await readErrorMessage(response));
  if (!response.body) throw new LunarChatError("智能体连接未建立，请稍后重试");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  handlers.signal?.addEventListener("abort", cancelReader, { once: true });
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = parseLunarChatLines(buffer);
      buffer = parsed.remainder;
      for (const event of parsed.events) {
        handlers.onEvent(event);
        if (event.type === "done") done = true;
        if (event.type === "error") throw new LunarChatError(event.message);
      }
    }
    buffer += decoder.decode();
    const parsed = parseLunarChatLines(buffer, true);
    for (const event of parsed.events) {
      handlers.onEvent(event);
      if (event.type === "done") done = true;
      if (event.type === "error") throw new LunarChatError(event.message);
    }
  } finally {
    handlers.signal?.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
  if (!done) throw new LunarChatError("智能体连接中断，请重试");
}
