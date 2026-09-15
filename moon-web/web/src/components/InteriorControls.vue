<script setup lang="ts">
import { useExplorer } from "../stores/explorer";
import { nextTick } from "vue";
import { useEvolutionTour } from "../stores/evolutionTour";
const tour = useEvolutionTour();
const explorer = useExplorer();
const emit = defineEmits<{ overview: [] }>();
function overview() {
  tour.pause();
  explorer.selectedLayer = null;
  emit("overview");
}
async function expand() {
  tour.pause();
  explorer.selectedLayer = null;
  if (explorer.cutaway === "full") explorer.cutaway = "quarter";
  explorer.expanded = !explorer.expanded;
  await nextTick();
  emit("overview");
}
</script>
<template>
  <section class="interior-controls" aria-label="剖面展台">
    <div class="exhibit-actions">
      <button :aria-pressed="explorer.expanded" @click="expand">
        {{ explorer.expanded ? "合拢圈层" : "分层展开" }}
      </button>
      <button @click="overview">整体观察</button>
      <select
        aria-label="展台剖切"
        v-model="explorer.cutaway"
        @change="
          explorer.expanded = false;
          overview();
        "
      >
        <option value="quarter">四分之一剖面</option>
        <option value="half">半球剖面</option>
        <option value="full">完整球体</option>
      </select>
    </div>
    <div class="exhibit-layers">
      <button
        v-for="layer in explorer.layers"
        :key="layer.id"
        :aria-label="`聚焦${layer.name}`"
        :aria-pressed="explorer.selectedLayer === layer.id"
        @click="
          tour.pause();
          explorer.selectedLayer =
            explorer.selectedLayer === layer.id ? null : layer.id;
        "
      >
        <span :style="{ background: layer.color }" />{{ layer.name }}
      </button>
      <small v-if="explorer.expanded">展开视图</small>
    </div>
    <div v-if="explorer.epochIndex < 3" class="stage-motion">
      <button
        @click="
          explorer.evolutionRunning
            ? tour.pause()
            : (explorer.evolutionRunning = true)
        "
      >
        {{ explorer.evolutionRunning ? "暂停过程" : "播放过程" }}
      </button>
      <small
        >{{ ["岩浆流动", "物质分异", "撞击与散热"][explorer.epochIndex] }} ·
        示意</small
      >
    </div>
  </section>
</template>
