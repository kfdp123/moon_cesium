<script setup lang="ts">
import { useRover } from "../stores/rover";
import { ROVER_ROUTE_LENGTH } from "../scene/roverRoute";
const rover = useRover();
</script>
<template>
  <div class="rover-controls">
    <div class="compact-row">
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
      <button @click="rover.playing = !rover.playing">
        {{ rover.playing ? "暂停行驶" : "继续行驶" }}</button
      ><button @click="rover.restart++">回到起点</button>
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
      >{{ rover.distance.toFixed(0) }} / {{ ROVER_ROUTE_LENGTH.toFixed(0) }} m ·
      循环示意轨迹</span
    >
    <span class="panel-note" role="status">{{ rover.status }}</span>
  </div>
</template>
