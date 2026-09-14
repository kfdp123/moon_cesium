<script setup lang="ts">
import { Eye, EyeOff, ChevronRight, Layers3 } from "@lucide/vue";
import { useExplorer } from "../stores/explorer";

const explorer = useExplorer();
</script>

<template>
  <section class="panel-section">
    <div class="section-label">
      <Layers3 :size="14" /><span>内部圈层</span
      ><small>{{ explorer.epoch.layers.length }} 层</small>
    </div>
    <div class="layer-list">
      <div
        v-for="layer in explorer.epoch.layers"
        :key="layer.id"
        class="layer-row"
        :class="{
          selected: explorer.selectedLayer === layer.id,
          muted: explorer.hiddenLayers.includes(layer.id),
        }"
      >
        <button class="layer-select" @click="explorer.selectedLayer = layer.id">
          <span class="layer-swatch" :style="{ background: layer.color }" />
          <span
            ><b>{{ layer.name }}</b
            ><small>{{ layer.english }}</small></span
          >
          <ChevronRight :size="14" />
        </button>
        <button
          class="icon-button layer-eye"
          :aria-label="`${explorer.hiddenLayers.includes(layer.id) ? '显示' : '隐藏'}${layer.name}`"
          :aria-pressed="!explorer.hiddenLayers.includes(layer.id)"
          @click="explorer.toggleLayer(layer.id)"
        >
          <EyeOff
            v-if="explorer.hiddenLayers.includes(layer.id)"
            :size="15"
          /><Eye v-else :size="15" />
        </button>
      </div>
    </div>
    <p class="panel-note">点击圈层阅读说明，也可以直接点击三维切面。</p>
  </section>
</template>
