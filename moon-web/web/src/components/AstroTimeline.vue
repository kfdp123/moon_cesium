<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { JulianDate, Timeline } from "cesium";
import { Pause, Play, SkipBack, SkipForward } from "@lucide/vue";
import { useAstronomy } from "../stores/astronomy";
const astronomy = useAstronomy();
const host = ref<HTMLElement>();
const dateInput = ref<HTMLInputElement>();
const date = ref("");
const playing = ref(false);
const multiplier = ref(astronomy.clock.multiplier);
const span = ref(30);
let timeline: Timeline;
let observer: ResizeObserver;
let removeTick: () => void;
let lastUi = 0;
function refresh() {
  if (document.activeElement !== dateInput.value)
    date.value = JulianDate.toIso8601(astronomy.clock.currentTime, 0).slice(
      0,
      16,
    );
  playing.value = astronomy.clock.shouldAnimate;
}
function fit() {
  timeline.zoomTo(
    JulianDate.addDays(
      astronomy.clock.currentTime,
      -span.value / 2,
      new JulianDate(),
    ),
    JulianDate.addDays(
      astronomy.clock.currentTime,
      span.value / 2,
      new JulianDate(),
    ),
  );
}
function setDate() {
  if (date.value) {
    astronomy.seek(`${date.value}:00Z`);
    fit();
  }
}
function scrub(event: Event) {
  astronomy.seek(
    JulianDate.toIso8601(
      (event as Event & { timeJulian: JulianDate }).timeJulian,
    ),
  );
}
watch(() => astronomy.command, refresh);
onMounted(() => {
  timeline = new Timeline(host.value!, astronomy.clock);
  host.value!.addEventListener("settime", scrub);
  fit();
  refresh();
  observer = new ResizeObserver(() => timeline.resize());
  observer.observe(host.value!);
  removeTick = astronomy.clock.onTick.addEventListener(() => {
    if (performance.now() - lastUi < 200) return;
    lastUi = performance.now();
    refresh();
  });
});
onBeforeUnmount(() => {
  host.value!.removeEventListener("settime", scrub);
  removeTick();
  observer.disconnect();
  timeline.destroy();
});
</script>
<template>
  <div class="astro-time-controls">
    <div class="astro-playback">
      <button
        class="icon-button"
        aria-label="后退一天"
        @click="astronomy.shift(-1)"
      >
        <SkipBack :size="20" />
      </button>
      <button
        class="play-button"
        :aria-label="playing ? '暂停天体运动' : '播放天体运动'"
        @click="astronomy.togglePlayback()"
      >
        <Pause v-if="playing" :size="20" /><Play v-else :size="20" />
      </button>
      <button
        class="icon-button"
        aria-label="前进一天"
        @click="astronomy.shift(1)"
      >
        <SkipForward :size="20" />
      </button>
      <label
        >UTC<input
          ref="dateInput"
          type="datetime-local"
          aria-label="模拟日期 UTC"
          v-model="date"
          min="2000-01-01T00:00"
          max="2100-01-01T00:00"
          @change="setDate"
      /></label>
      <select
        aria-label="时间倍速"
        v-model.number="multiplier"
        @change="astronomy.clock.multiplier = multiplier"
      >
        <option :value="1">实时 ×1</option>
        <option :value="60">1 秒 = 1 分</option>
        <option :value="3600">1 秒 = 1 小时</option>
        <option :value="86400">1 秒 = 1 天</option>
        <option :value="604800">1 秒 = 7 天</option>
      </select>
      <button
        class="text-button"
        @click="
          astronomy.seek(new Date().toISOString());
          fit();
        "
      >
        现在
      </button>
      <select aria-label="时间轴跨度" v-model.number="span" @change="fit">
        <option :value="1">1 天</option>
        <option :value="7">7 天</option>
        <option :value="30">30 天</option>
        <option :value="365">1 年</option>
      </select>
      <button class="text-button" @click="fit">定位当前</button>
    </div>
    <div ref="host" class="native-timeline" aria-label="Cesium 日期时间轴" />
  </div>
</template>
