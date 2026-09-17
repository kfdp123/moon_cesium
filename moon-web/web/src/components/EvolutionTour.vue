<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  Pause,
  Play,
  X,
} from "@lucide/vue";
import { useEvolutionTour } from "../stores/evolutionTour";
import { evolutionDuration, evolutionSteps } from "../data/evolutionTour";
const tour = useEvolutionTour();
const panel = ref<HTMLElement>();
const position = ref<{ x: number; y: number }>();
const dragging = ref(false);
let drag: { id: number; dx: number; dy: number } | undefined;
function place(x: number, y: number) {
  const box = panel.value!.getBoundingClientRect();
  // Keep the controls above the persistent timeline, including after a resize.
  const timeSpace = parseFloat(
    getComputedStyle(panel.value!).getPropertyValue("--time-space"),
  );
  position.value = {
    x: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)),
    y: Math.max(
      8,
      Math.min(y, window.innerHeight - timeSpace - box.height - 12),
    ),
  };
}
function keepInView() {
  if (position.value && panel.value) place(position.value.x, position.value.y);
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || !event.isPrimary) return;
  const box = panel.value!.getBoundingClientRect();
  drag = {
    id: event.pointerId,
    dx: event.clientX - box.left,
    dy: event.clientY - box.top,
  };
  dragging.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}
function moveDrag(event: PointerEvent) {
  if (drag?.id === event.pointerId)
    place(event.clientX - drag.dx, event.clientY - drag.dy);
}
function endDrag() {
  drag = undefined;
  dragging.value = false;
}
const resizeObserver = new ResizeObserver(keepInView);
watch(panel, (element) => {
  resizeObserver.disconnect();
  if (element) {
    resizeObserver.observe(element);
    keepInView();
  }
});
let frame = 0,
  last = 0;
function tick(now: number) {
  if (last) tour.tick(Math.min((now - last) / 1000, 0.1));
  last = now;
  frame = requestAnimationFrame(tick);
}
onMounted(() => {
  window.addEventListener("resize", keepInView);
  frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => {
  window.removeEventListener("resize", keepInView);
  resizeObserver.disconnect();
  cancelAnimationFrame(frame);
  tour.stop();
});
</script>
<template>
  <section
    v-if="tour.active"
    ref="panel"
    class="evolution-caption"
    :class="{ 'is-dragging': dragging }"
    aria-label="演化讲解"
    :style="
      position
        ? {
            left: `${position.x}px`,
            top: `${position.y}px`,
            bottom: 'auto',
            transform: 'none',
          }
        : undefined
    "
  >
    <div class="tour-heading">
      <div
        class="tour-drag-handle"
        title="拖动标题栏移动面板"
        @pointerdown.stop="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
      >
        <GripHorizontal :size="20" aria-hidden="true" />
        <strong>{{ tour.step.title }}</strong
        ><span>{{ tour.index + 1 }} / {{ evolutionSteps.length }}</span>
      </div>
      <button class="icon-button" aria-label="结束讲解" @click="tour.stop">
        <X :size="20" aria-hidden="true" />
      </button>
    </div>
    <p>{{ tour.step.caption }}</p>
    <progress
      :value="tour.progress"
      :max="evolutionDuration"
      aria-label="讲解进度"
    />
    <div class="tour-actions">
      <button
        class="secondary-button"
        :disabled="tour.index === 0"
        @click="tour.move(-1)"
      >
        <ChevronLeft :size="18" aria-hidden="true" />
        上一步
      </button>
      <button
        class="primary-button"
        @click="tour.playing ? tour.pause() : tour.resume()"
      >
        <Pause v-if="tour.playing" :size="18" aria-hidden="true" /><Play
          v-else
          :size="18"
          aria-hidden="true"
        />
        {{
          tour.playing ? "暂停讲解" : tour.finished ? "重新讲解" : "继续讲解"
        }}
      </button>
      <button
        class="secondary-button"
        :disabled="tour.index === evolutionSteps.length - 1"
        @click="tour.move(1)"
      >
        下一步
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>
