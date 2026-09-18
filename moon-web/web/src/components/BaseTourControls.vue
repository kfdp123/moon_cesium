<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import {
  ChevronDown,
  Compass,
  Hand,
  House,
  Pause,
  Play,
  RadioTower,
  Rocket,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sun,
} from "@lucide/vue";
import { baseStops } from "../data/lunarBase";
import { useBaseTour } from "../stores/baseTour";

const tour = useBaseTour();
const container = ref<HTMLElement>();
let observer: ResizeObserver;
function updateFraming() {
  const bounds = container.value!.parentElement!.getBoundingClientRect();
  if (bounds.width) tour.panelRight = bounds.right;
}
onMounted(() => {
  observer = new ResizeObserver(updateFraming);
  observer.observe(container.value!.parentElement!);
  window.addEventListener("resize", updateFraming);
  updateFraming();
});
onBeforeUnmount(() => {
  observer.disconnect();
  window.removeEventListener("resize", updateFraming);
  tour.panelRight = 0;
});
const current = computed(() => baseStops[tour.index]!);
const stopIcons = {
  overview: Compass,
  habitat: House,
  power: Sun,
  communications: RadioTower,
  landing: Rocket,
};

function togglePlayback() {
  if (tour.mode === "free") tour.setMode("guided");
  else tour.playing = !tour.playing;
}
</script>

<template>
  <section
    ref="container"
    class="base-tour-controls"
    aria-label="月面基地巡视控制"
  >
    <div class="base-tour-modes" role="group" aria-label="基地观察方式">
      <button
        :aria-pressed="tour.mode === 'guided'"
        @click="tour.setMode('guided')"
      >
        <Compass :size="18" aria-hidden="true" />自动巡视
      </button>
      <button
        :aria-pressed="tour.mode === 'free'"
        @click="tour.setMode('free')"
      >
        <Hand :size="18" aria-hidden="true" />自由观察
      </button>
    </div>

    <nav class="base-tour-stops" aria-label="基地巡视区域">
      <button
        v-for="(stop, index) in baseStops"
        :key="stop.id"
        :class="{ 'base-tour-overview': index === 0 }"
        :aria-pressed="tour.index === index"
        :aria-label="`定位${stop.title}`"
        @click="tour.select(index)"
      >
        <component :is="stopIcons[stop.icon]" :size="19" aria-hidden="true" />
        <span>{{ stop.title }}</span>
        <span class="base-tour-stop-number" aria-hidden="true">{{
          String(index + 1).padStart(2, "0")
        }}</span>
      </button>
    </nav>

    <div class="base-tour-current">
      <div class="base-tour-current-heading">
        <h3>{{ current.title }}</h3>
        <span>{{ tour.index + 1 }} / {{ baseStops.length }}</span>
      </div>
      <span class="base-tour-kicker">{{ current.kicker }}</span>
      <p>{{ current.description }}</p>
      <div
        class="base-tour-progress"
        role="progressbar"
        aria-label="当前区域巡视进度"
        :aria-valuenow="Math.round(tour.progress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ transform: `scaleX(${tour.progress})` }"></span>
      </div>
    </div>

    <div class="base-tour-playback">
      <button
        class="secondary-button"
        aria-label="上一站"
        @click="tour.step(-1)"
      >
        <SkipBack :size="19" aria-hidden="true" />
      </button>
      <button class="primary-button" @click="togglePlayback">
        <Pause v-if="tour.playing" :size="19" aria-hidden="true" />
        <Play v-else :size="19" aria-hidden="true" />
        {{ tour.playing ? "暂停巡视" : "继续巡视" }}
      </button>
      <button
        class="secondary-button"
        aria-label="下一站"
        @click="tour.step(1)"
      >
        <SkipForward :size="19" aria-hidden="true" />
      </button>
    </div>
    <p v-if="tour.mode === 'free'" class="base-tour-free-hint">
      鼠标拖动旋转 · 滚轮缩放
    </p>

    <details class="base-tour-settings">
      <summary>巡视设置<ChevronDown :size="17" aria-hidden="true" /></summary>
      <div class="base-tour-settings-content">
        <label class="base-tour-speed">
          <span
            >巡视速度<output>{{ tour.speed }}×</output></span
          >
          <input
            v-model.number="tour.speed"
            type="range"
            min="0.5"
            max="2"
            step="0.25"
            aria-label="基地巡视速度"
          />
        </label>
        <label class="base-tour-label-toggle">
          <input v-model="tour.showLabels" type="checkbox" />区域标注
        </label>
        <button class="secondary-button" @click="tour.restart()">
          <RotateCcw :size="17" aria-hidden="true" />重新巡视
        </button>
      </div>
    </details>
  </section>
</template>
