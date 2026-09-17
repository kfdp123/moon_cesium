<script setup lang="ts">
import { useRover } from "../stores/rover";
import { Pause, Play, RotateCcw } from "@lucide/vue";
import { ROVER_ROUTE_LENGTH } from "../scene/roverRoute";
const rover = useRover();
</script>
<template>
  <div class="rover-controls">
    <div class="segmented-control" role="group" aria-label="月球车视角">
      <button
        v-for="v in [
          { id: 'free', label: '自由视角' },
          { id: 'follow', label: '固定跟随' },
          { id: 'first', label: '车载第一视角' },
        ] as const"
        :key="v.id"
        :aria-pressed="rover.view === v.id"
        @click="rover.view = v.id"
      >
        {{ v.label }}
      </button>
    </div>
    <div class="compact-row">
      <button class="primary-button" @click="rover.playing = !rover.playing">
        <Pause v-if="rover.playing" :size="18" aria-hidden="true" /><Play
          v-else
          :size="18"
          aria-hidden="true"
        />
        {{ rover.playing ? "暂停行驶" : "继续行驶" }}</button
      ><button class="secondary-button" @click="rover.restart++">
        <RotateCcw :size="18" aria-hidden="true" />回到起点
      </button>
    </div>
    <label class="field"
      >行驶速度 · {{ rover.speed }} m/s<input
        aria-label="月球车行驶速度"
        type="range"
        min=".5"
        max="10"
        step=".5"
        v-model.number="rover.speed"
    /></label>
    <span class="panel-note"
      >行驶里程 · {{ rover.distance.toFixed(0) }} /
      {{ ROVER_ROUTE_LENGTH.toFixed(0) }} m</span
    >
    <span
      class="panel-note"
      :class="{ 'visually-hidden': rover.status === '月球车已就绪' }"
      role="status"
      >{{ rover.status }}</span
    >
    <details>
      <summary>操作说明</summary>
      <span class="panel-note">{{
        rover.view === "free"
          ? "鼠标拖动观察 · 滚轮缩放"
          : "按住右键上下左右转头，也可用方向键或 WASD。左键不拖移视点，切换视角回正。"
      }}</span>
    </details>
  </div>
</template>
