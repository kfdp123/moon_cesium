<script setup lang="ts">
import { ref } from "vue";
import { useExplorer } from "../stores/explorer";
import ParameterSlider from "./ParameterSlider.vue";
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
</script>

<template>
  <section class="panel-section parameter-panel">
    <div class="section-label">模型参数 <small>教学示意</small></div>
    <ParameterSlider
      label="总半径"
      :value="explorer.radiusKm"
      :min="100"
      :max="10000"
      :step="10"
      @change="(value) => apply(() => explorer.setRadius(value))"
    />
    <p class="panel-note">
      拖动滑块、松开更新模型；选中滑块后可用滚轮微调。总半径同比缩放圈层，厚度调整会重算总半径。
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
      <ParameterSlider
        :label="`${layer.name}厚度`"
        :value="layer.outerRadiusKm - layer.innerRadiusKm"
        :min="
          Math.max(
            1,
            100 - explorer.radiusKm + layer.outerRadiusKm - layer.innerRadiusKm,
          )
        "
        :max="
          Math.min(
            5000,
            10000 -
              explorer.radiusKm +
              layer.outerRadiusKm -
              layer.innerRadiusKm,
          )
        "
        :step="1"
        @change="(value) => apply(() => explorer.setThickness(layer.id, value))"
      />
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
