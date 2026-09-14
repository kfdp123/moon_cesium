<script setup lang="ts">
import { ref } from "vue";
import { useExplorer } from "../stores/explorer";
const explorer = useExplorer();
const error = ref("");
function apply(action: () => void) {
  try {
    action();
    error.value = "";
  } catch (cause) {
    error.value = String(cause);
  }
}
function number(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}
</script>

<template>
  <section class="panel-section parameter-panel">
    <div class="section-label">模型参数 <small>教学示意</small></div>
    <label class="field"
      >总半径 / km<input
        aria-label="总半径"
        type="number"
        min="100"
        max="10000"
        step="10"
        :value="explorer.radiusKm.toFixed(1)"
        @change="apply(() => explorer.setRadius(number($event)))"
    /></label>
    <p class="panel-note">
      调整总半径会同比缩放圈层；修改厚度会重新计算总半径。由外向内排列。
    </p>
    <div
      v-for="layer in explorer.layers"
      :key="layer.id"
      class="parameter-layer"
    >
      <div class="compact-row">
        <input
          class="color-input"
          type="color"
          v-model="layer.color"
          :aria-label="`${layer.name}颜色`"
        />
        <input
          v-model="layer.name"
          :aria-label="`${layer.name}名称`"
          maxlength="40"
        />
        <button
          :aria-label="`删除${layer.name}`"
          @click="apply(() => explorer.removeLayer(layer.id))"
        >
          ×
        </button>
      </div>
      <label class="field horizontal"
        >厚度 / km<input
          type="number"
          min="1"
          max="5000"
          step="1"
          :aria-label="`${layer.name}厚度`"
          :value="(layer.outerRadiusKm - layer.innerRadiusKm).toFixed(1)"
          @change="
            apply(() => explorer.setThickness(layer.id, number($event)))
          "
      /></label>
      <button
        class="text-button"
        :aria-pressed="!explorer.hiddenLayers.includes(layer.id)"
        @click="explorer.toggleLayer(layer.id)"
      >
        {{ explorer.hiddenLayers.includes(layer.id) ? "显示圈层" : "隐藏圈层" }}
      </button>
      <button
        class="text-button"
        @click="
          explorer.selectedLayer = layer.id;
          explorer.selectedLandmark = null;
        "
      >
        查看说明
      </button>
    </div>
    <button class="secondary-button" @click="apply(explorer.addLayer)">
      ＋ 新增外部圈层
    </button>
    <button class="secondary-button" @click="apply(explorer.saveModel)">
      保存当前年代参数
    </button>
    <p class="panel-note">保存后，切换年代或刷新将载入该年代的保存参数。</p>
    <button class="text-button" @click="apply(explorer.restoreModel)">
      恢复阶段默认参数
    </button>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </section>
</template>
