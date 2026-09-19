import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  LunarChatError,
  streamLunarChat,
  type LunarChatMessage,
  type LunarChatSource,
} from "../services/lunarChat";

export interface LunarAssistantMessage extends LunarChatMessage {
  id: number;
  status: "complete" | "streaming" | "interrupted";
  sources: LunarChatSource[];
}

const suggestions = [
  "月球内部有哪些主要圈层？它们是如何推断出来的？",
  "月球重力异常与月壳厚度之间有什么关系？",
  "月球南极适合开展哪些科学探测？",
];

function contextMessages(
  messages: LunarAssistantMessage[],
): LunarChatMessage[] {
  const history = messages
    .filter((message) => message.status !== "interrupted")
    .slice(-12)
    .map(({ role, content }) => ({ role, content }));
  while (history[0]?.role === "assistant") history.shift();
  return history;
}

export const useLunarAssistant = defineStore("lunarAssistant", () => {
  const messages = ref<LunarAssistantMessage[]>([]);
  const streaming = ref(false);
  const error = ref("");
  const lastQuestion = ref("");
  const lastContext = ref<Record<string, unknown>>({});
  let messageId = 0;
  let requestId = 0;
  let controller: AbortController | null = null;

  const hasMessages = computed(() => messages.value.length > 0);

  function removeMessage(id: number) {
    messages.value = messages.value.filter((message) => message.id !== id);
  }

  async function send(
    question: string,
    context: Record<string, unknown> = {},
    reuseLastUser = false,
  ): Promise<void> {
    const content = question.trim();
    if (!content || streaming.value) return;

    const currentRequest = ++requestId;
    controller?.abort();
    controller = new AbortController();
    error.value = "";
    lastQuestion.value = content;
    lastContext.value = context;

    const previous = messages.value;
    const last = previous.at(-1);
    if (!(reuseLastUser && last?.role === "user" && last.content === content)) {
      messages.value = [
        ...previous,
        {
          id: ++messageId,
          role: "user",
          content,
          status: "complete",
          sources: [],
        },
      ];
    }

    const assistant: LunarAssistantMessage = {
      id: ++messageId,
      role: "assistant",
      content: "",
      status: "streaming",
      sources: [],
    };
    messages.value = [...messages.value, assistant];
    const requestMessages = contextMessages(messages.value.slice(0, -1));
    streaming.value = true;

    try {
      await streamLunarChat(
        { messages: requestMessages, context },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (currentRequest !== requestId) return;
            const index = messages.value.findIndex(
              (item) => item.id === assistant.id,
            );
            if (index < 0) return;
            const next = [...messages.value];
            const current = next[index]!;
            if (event.type === "delta") current.content += event.content;
            if (event.type === "sources") current.sources = event.sources;
            messages.value = next;
          },
        },
      );
      if (currentRequest !== requestId) return;
      const index = messages.value.findIndex(
        (item) => item.id === assistant.id,
      );
      if (index >= 0) {
        const next = [...messages.value];
        next[index] = { ...next[index]!, status: "complete" };
        messages.value = next;
      }
    } catch (cause) {
      if (currentRequest !== requestId) return;
      if (controller.signal.aborted) return;
      removeMessage(assistant.id);
      error.value =
        cause instanceof LunarChatError
          ? cause.message
          : "智能体暂时没有回应，请稍后重试";
    } finally {
      if (currentRequest === requestId) {
        streaming.value = false;
        controller = null;
      }
    }
  }

  function stop() {
    if (!streaming.value) return;
    ++requestId;
    controller?.abort();
    controller = null;
    streaming.value = false;
    const active = messages.value.at(-1);
    if (active?.role === "assistant" && active.status === "streaming") {
      if (active.content) {
        const next = [...messages.value];
        const index = next.length - 1;
        next[index] = { ...active, status: "interrupted" };
        messages.value = next;
      } else removeMessage(active.id);
    }
  }

  function clear() {
    ++requestId;
    controller?.abort();
    controller = null;
    streaming.value = false;
    error.value = "";
    lastQuestion.value = "";
    lastContext.value = {};
    messages.value = [];
  }

  function retry() {
    if (lastQuestion.value && !streaming.value) {
      const active = messages.value.at(-1);
      if (active?.role === "assistant" && active.status === "interrupted")
        removeMessage(active.id);
      return send(lastQuestion.value, lastContext.value, true);
    }
  }

  return {
    messages,
    streaming,
    error,
    lastQuestion,
    hasMessages,
    suggestions,
    send,
    stop,
    clear,
    retry,
  };
});
