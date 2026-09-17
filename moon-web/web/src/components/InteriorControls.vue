<script setup lang="ts">
import { useExplorer } from "../stores/explorer";
import { nextTick } from "vue";
import { Check, Layers, Scan, Pause, Play } from "@lucide/vue";
import type { CutawayMode } from "../types";
import { useEvolutionTour } from "../stores/evolutionTour";
const tour = useEvolutionTour();
const explorer = useExplorer();
const emit = defineEmits<{ overview: []; local: [] }>();
const cuts: { id: CutawayMode; label: string }[] = [
  { id: "full", label: "完整球" },
  { id: "half", label: "半球" },
  { id: "quarter", label: "四分之一" },
];
function selectCut(cut: CutawayMode) {
  explorer.cutaway = cut;
  explorer.expanded = false;
  overview();
}
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
      <button
        class="primary-button"
        :aria-pressed="explorer.expanded"
        @click="expand"
      >
        <Layers :size="19" aria-hidden="true" />
        {{ explorer.expanded ? "合拢圈层" : "分层展开" }}
      </button>
      <button class="secondary-button" @click="overview">
        <Scan :size="19" aria-hidden="true" />整体观察
      </button>
    </div>
    <div
      class="segmented-control exhibit-cuts"
      role="group"
      aria-label="展台剖切"
    >
      <button
        v-for="cut in cuts"
        :key="cut.id"
        :aria-pressed="explorer.cutaway === cut.id"
        @click="selectCut(cut.id)"
      >
        {{ cut.label }}
      </button>
    </div>
    <div class="exhibit-layers">
      <button
        v-for="layer in explorer.layers"
        :key="layer.id"
        class="secondary-button layer-chip"
        :aria-label="`聚焦${layer.name}`"
        :aria-pressed="explorer.selectedLayer === layer.id"
        @click="
          tour.pause();
          explorer.selectedLayer =
            explorer.selectedLayer === layer.id ? null : layer.id;
        "
      >
        <span class="layer-dot" :style="{ background: layer.color }" />{{
          layer.name
        }}
        <Check
          class="layer-check"
          :class="{ selected: explorer.selectedLayer === layer.id }"
          :size="14"
          aria-hidden="true"
        />
      </button>
      <small v-if="explorer.expanded">展开视图</small>
    </div>
    <div v-if="explorer.epochIndex < 3" class="stage-motion">
      <button
        class="secondary-button"
        @click="
          explorer.evolutionRunning
            ? tour.pause()
            : (explorer.evolutionRunning = true)
        "
      >
        <Pause
          v-if="explorer.evolutionRunning"
          :size="18"
          aria-hidden="true"
        /><Play v-else :size="18" aria-hidden="true" />
        {{ explorer.evolutionRunning ? "暂停过程" : "播放过程" }}
      </button>
      <small>{{
        ["岩浆流动", "物质分异", "撞击与散热"][explorer.epochIndex]
      }}</small>
    </div>
    <button class="secondary-button local-geology-entry" @click="emit('local')">
      <Layers :size="19" aria-hidden="true" />局部构造
    </button>
  </section>
</template>
