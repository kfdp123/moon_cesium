<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import {
  ChevronDown,
  Link,
  RotateCcw,
  Send,
  Square,
  Trash2,
  UserRound,
} from "@lucide/vue";
import { useLunarAssistant } from "../stores/lunarAssistant";
import type { LunarChatSource } from "../services/lunarChat";

const props = withDefaults(
  defineProps<{ context?: Record<string, unknown> }>(),
  { context: () => ({}) },
);

const assistant = useLunarAssistant();
const question = ref("");
const composing = ref(false);
const messageList = ref<HTMLElement | null>(null);

function scrollToLatest() {
  void nextTick(() => {
    const element = messageList.value;
    if (element) element.scrollTop = element.scrollHeight;
  });
}

watch(
  () =>
    assistant.messages.map(
      (message) => `${message.id}:${message.content.length}`,
    ),
  scrollToLatest,
  { flush: "post" },
);

async function submit() {
  const content = question.value.trim();
  if (!content || assistant.streaming) return;
  question.value = "";
  await assistant.send(content, props.context);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.isComposing || composing.value) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void submit();
  }
}

function sourceHref(source: LunarChatSource) {
  return source.url && /^https?:\/\//i.test(source.url)
    ? source.url
    : undefined;
}
</script>

<template>
  <section class="lunar-assistant" aria-label="问答内容">
    <header class="assistant-heading">
      <div class="assistant-actions">
        <button
          v-if="assistant.streaming"
          class="assistant-action"
          type="button"
          aria-label="停止回答"
          title="停止回答"
          @click="assistant.stop"
        >
          <Square :size="16" />
        </button>
        <button
          v-else
          class="assistant-action"
          type="button"
          aria-label="清空对话"
          title="清空对话"
          :disabled="!assistant.hasMessages"
          @click="assistant.clear"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </header>

    <div ref="messageList" class="assistant-messages">
      <div
        v-if="!assistant.hasMessages && !assistant.error"
        class="assistant-welcome"
      >
        <p>可以询问月球地形、重力、内部结构和探测任务。</p>
        <div class="assistant-suggestions">
          <button
            v-for="suggestion in assistant.suggestions"
            :key="suggestion"
            type="button"
            @click="
              question = suggestion;
              void submit();
            "
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <article
        v-for="message in assistant.messages"
        :key="message.id"
        class="assistant-message"
        :class="message.role"
        data-testid="assistant-message"
      >
        <span class="message-avatar">
          <UserRound v-if="message.role === 'user'" :size="16" />
          <span v-else class="assistant-avatar-mark">月</span>
        </span>
        <div class="message-body">
          <div class="message-label">
            {{ message.role === "user" ? "你" : "月球智能体" }}
          </div>
          <p v-if="message.content" class="message-content">
            {{ message.content }}
          </p>
          <span
            v-else-if="message.status === 'streaming'"
            class="assistant-loading"
            data-testid="assistant-loading"
          >
            正在思考<span>.</span><span>.</span><span>.</span>
          </span>
          <details
            v-if="message.sources.length"
            class="assistant-sources"
            data-testid="assistant-sources"
          >
            <summary>
              <ChevronDown :size="14" />参考资料（{{ message.sources.length }}）
            </summary>
            <ul>
              <li v-for="source in message.sources" :key="source.id">
                <a
                  v-if="sourceHref(source)"
                  :href="sourceHref(source)"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Link :size="13" />[{{ source.id }}] {{ source.title }}
                </a>
                <span v-else>[{{ source.id }}] {{ source.title }}</span>
              </li>
            </ul>
          </details>
        </div>
      </article>

      <div
        v-if="assistant.error"
        class="assistant-error"
        role="alert"
        data-testid="assistant-error"
      >
        <span>{{ assistant.error }}</span>
        <button type="button" @click="assistant.retry">
          <RotateCcw :size="15" />重试
        </button>
      </div>
    </div>

    <form class="assistant-composer" @submit.prevent="submit">
      <textarea
        v-model="question"
        aria-label="向月球智能体提问"
        placeholder="输入你想了解的月球问题"
        rows="2"
        :disabled="assistant.streaming"
        @keydown="handleKeydown"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <button
        class="assistant-send"
        type="submit"
        aria-label="发送提问"
        :disabled="assistant.streaming || !question.trim()"
      >
        <Send :size="17" />
      </button>
      <span class="assistant-hint">Enter 发送 · Shift + Enter 换行</span>
    </form>
  </section>
</template>

<style scoped>
.lunar-assistant {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  color: #edf3f8;
}

.assistant-heading {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.message-avatar {
  display: grid;
  place-items: center;
  color: var(--accent);
  background: #1b3c4c;
  border: 1px solid #386074;
}

.assistant-actions {
  display: flex;
  gap: 4px;
}

.assistant-action {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--muted);
}

.assistant-action:hover:not(:disabled) {
  color: #fff;
  background: var(--control-hover);
}

.assistant-messages {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  padding: 16px 3px 18px 1px;
  scrollbar-width: thin;
}

.assistant-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
  padding: 18px 7px 7px;
  color: #b9d0d4;
  text-align: center;
}

.assistant-welcome p {
  margin: 0;
  line-height: 1.65;
}

.assistant-suggestions {
  display: grid;
  width: 100%;
  gap: 8px;
}

.assistant-suggestions button {
  padding: 9px 11px;
  border: 1px solid var(--control-border);
  border-radius: 8px;
  color: #c7d9df;
  background: #172938;
  text-align: left;
  line-height: 1.5;
}

.assistant-suggestions button:hover {
  border-color: var(--accent);
  background: var(--selected-bg);
}

.assistant-message {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  max-width: 96%;
}

.assistant-message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-avatar {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #c6d3df;
  background: #243446;
  border-color: #40546b;
}

.assistant-avatar-mark {
  font-size: 0.8125rem;
  font-weight: 600;
}

.assistant-message.assistant .message-avatar {
  color: var(--accent);
  background: #1b3c4c;
  border-color: #386074;
}

.message-body {
  min-width: 0;
}

.message-label {
  margin: 3px 0 4px;
  color: var(--muted);
  font-size: 0.8125rem;
}

.assistant-message.user .message-label {
  text-align: right;
}

.message-content {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #30475a;
  border-radius: 4px 12px 12px;
  color: #e6eff2;
  background: #172a3a;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.assistant-message.user .message-content {
  border-color: #356176;
  border-radius: 12px 4px 12px 12px;
  background: #1b4355;
}

.assistant-loading {
  display: inline-block;
  padding: 10px 12px;
  color: #a9c4cb;
  border: 1px solid #30475a;
  border-radius: 4px 12px 12px;
  background: #172a3a;
}

.assistant-loading span {
  animation: assistant-dot 1.2s infinite;
  opacity: 0.25;
}

.assistant-loading span:nth-child(2) {
  animation-delay: 0.2s;
}
.assistant-loading span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes assistant-dot {
  45%,
  100% {
    opacity: 0.25;
  }
  20% {
    opacity: 1;
  }
}

.assistant-sources {
  margin-top: 8px;
  color: var(--muted);
  font-size: 0.8125rem;
}

.assistant-sources summary {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  list-style: none;
}

.assistant-sources summary::-webkit-details-marker {
  display: none;
}
.assistant-sources[open] summary svg {
  transform: rotate(180deg);
}

.assistant-sources ul {
  display: grid;
  gap: 4px;
  margin: 7px 0 0;
  padding-left: 5px;
  list-style: none;
}

.assistant-sources li,
.assistant-sources a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  line-height: 1.5;
}

.assistant-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #765744;
  border-radius: 8px;
  color: #f0d7ba;
  background: #382b24;
  line-height: 1.5;
}

.assistant-error button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  color: #ffd6a8;
}

.assistant-composer {
  position: relative;
  flex: 0 0 auto;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.assistant-composer textarea {
  display: block;
  width: 100%;
  min-height: 70px;
  resize: vertical;
  padding: 10px 48px 27px 12px;
  border: 1px solid var(--control-border);
  border-radius: 9px;
  outline: none;
  color: #edf3f8;
  background: #111f2d;
  line-height: 1.55;
}

.assistant-composer textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px #73d9e733;
}

.assistant-composer textarea::placeholder {
  color: #849aaa;
}

.assistant-send {
  position: absolute;
  right: 8px;
  bottom: 29px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--accent-ink);
  background: var(--accent);
}

.assistant-send:hover:not(:disabled) {
  background: var(--accent-hover);
}
.assistant-send:disabled {
  color: #6b7d87;
  background: #2c3d48;
}

.assistant-hint {
  position: absolute;
  left: 12px;
  bottom: 14px;
  color: #8294a1;
  font-size: 0.75rem;
  pointer-events: none;
}
</style>
