export class CompletionError extends Error {}

/** Decode SSE frames without assuming that a network chunk ends at a line. */
export async function* completionText(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedText = false;
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      if (data === "[DONE]") {
        if (!receivedText)
          throw new CompletionError("服务未返回回答，请重试。");
        return;
      }
      const event = JSON.parse(data);
      if (event.error) throw new CompletionError("回答生成中断，请重试。");
      const choice = event.choices?.[0];
      if (choice?.delta?.content) {
        receivedText = true;
        yield choice.delta.content;
      }
      if (choice?.finish_reason && choice.finish_reason !== "stop")
        throw new CompletionError(
          choice.finish_reason === "length"
            ? "回答达到长度上限，请缩小问题范围后重试。"
            : "回答生成中断，请重试。",
        );
    }
  }
  throw new CompletionError("连接已中断，请重试。");
}
