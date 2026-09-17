<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { JulianDate, Timeline } from "cesium";
import { Pause, Play, SkipBack, SkipForward } from "@lucide/vue";
import { useAstronomy } from "../stores/astronomy";
const astronomy = useAstronomy();
defineProps<{ expanded: boolean }>();
defineEmits<{ toggle: [] }>();
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
  // Cesium 1.132 formats ticks through this untyped instance hook. Keep it
  // local to this widget; zooming and resizing still measure the actual labels.
  Object.assign(timeline, {
    makeLabel(this: { _timeBarSecondsSpan: number }, time: JulianDate) {
      const d = JulianDate.toGregorianDate(time);
      const day = `${d.year}年${d.month}月${d.day}日`;
      if (this._timeBarSecondsSpan >= 172800) return day;
      const pad = (value: number) => String(value).padStart(2, "0");
      const fraction =
        this._timeBarSecondsSpan < 3600 ? Math.floor(d.millisecond) : 0;
      const seconds =
        pad(d.second) +
        (fraction ? `.${String(fraction).padStart(3, "0")}` : "");
      return `${day} ${pad(d.hour)}:${pad(d.minute)}:${seconds}`;
    },
  });
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
  <div class="astro-time-controls" :class="{ compact: !expanded }">
    <div class="astro-playback">
      <button
        class="icon-button"
        aria-label="后退一天"
        v-show="expanded"
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
        v-show="expanded"
        @click="astronomy.shift(1)"
      >
        <SkipForward :size="20" />
      </button>
      <span v-if="!expanded" class="compact-date"
        >{{ date.replace("T", " ") }} <small>UTC</small></span
      >
      <button
        class="text-button time-toggle"
        :aria-expanded="expanded"
        @click="$emit('toggle')"
      >
        {{ expanded ? "收起时间轴" : "展开时间轴" }}
      </button>
      <label v-show="expanded"
        >世界时<input
          title="协调世界时（UTC）"
          ref="dateInput"
          type="datetime-local"
          aria-label="模拟日期 UTC"
          v-model="date"
          min="2000-01-01T00:00"
          max="2100-01-01T00:00"
          @change="setDate"
      /></label>
      <select
        v-show="expanded"
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
        v-show="expanded"
        class="text-button"
        @click="
          astronomy.seek(new Date().toISOString());
          fit();
        "
      >
        现在
      </button>
      <select
        v-show="expanded"
        aria-label="时间轴跨度"
        v-model.number="span"
        @change="fit"
      >
        <option :value="1">1 天</option>
        <option :value="7">7 天</option>
        <option :value="30">30 天</option>
        <option :value="365">1 年</option>
      </select>
      <button v-show="expanded" class="text-button" @click="fit">
        定位当前
      </button>
    </div>
    <div
      v-show="expanded"
      ref="host"
      class="native-timeline"
      aria-label="Cesium 日期时间轴"
    />
  </div>
</template>
