<script setup lang="ts">
import { ref } from "vue";
import { useCatalog } from "../stores/catalog";
import { validUrl } from "../data/pointFiles";
const catalog = useCatalog();
const emit = defineEmits<{ retry: [] }>();
const name = ref("");
const url = ref("");
const kind = ref<"image" | "xyz">("xyz");
const error = ref("");
function saveConfig() {
  try {
    catalog.saveMaps();
    error.value = "";
  } catch (cause) {
    error.value = `保存失败：${String(cause)}`;
  }
}
function add() {
  if (!name.value.trim() || !url.value || !validUrl(url.value)) {
    error.value = "请输入名称和 HTTP(S) 资源地址";
    return;
  }
  if (
    kind.value === "xyz" &&
    !["{x}", "{y}", "{z}"].every((part) => url.value.includes(part))
  ) {
    error.value = "瓦片地址需要包含 {x}、{y}、{z}";
    return;
  }
  catalog.mapLayers.push({
    id: crypto.randomUUID(),
    name: name.value,
    url: url.value,
    kind: kind.value,
    source: url.value,
    description: "自定义月球图层；需采用东经为正的等经纬度坐标。",
    visible: true,
    opacity: 1,
    maximumLevel: 8,
  });
  name.value = "";
  url.value = "";
  error.value = "";
}
function move(index: number, step: number) {
  const target = index + step;
  if (target < 0 || target >= catalog.mapLayers.length) return;
  const [layer] = catalog.mapLayers.splice(index, 1);
  catalog.mapLayers.splice(target, 0, layer);
}
</script>
<template>
  <section class="panel-section">
    <div class="compact-row">
      <button class="secondary-button" @click="saveConfig">保存图层配置</button
      ><button class="text-button" @click="catalog.restoreMaps()">
        恢复内置图层
      </button>
    </div>
    <p class="panel-note">保存后刷新可恢复，本浏览器独立保存。</p>
    <div class="section-label">
      地图与高程
      <button class="text-button" @click="emit('retry')">重试加载</button>
    </div>
    <p class="panel-note">
      下方图层覆盖上方图层。在线数据均为现今月表；早期场景叠加时仅作位置参照。
    </p>
    <div
      v-for="(layer, index) in catalog.mapLayers"
      :key="layer.id"
      class="catalog-layer"
    >
      <label class="checkbox-row"
        ><input type="checkbox" v-model="layer.visible" />{{
          layer.name
        }}</label
      >
      <p>{{ layer.description }}</p>
      <label v-if="layer.kind !== 'terrain'" class="field horizontal"
        >透明度<input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model.number="layer.opacity"
          :aria-label="`${layer.name}透明度`"
      /></label>
      <small class="layer-status">{{
        catalog.layerStatus[layer.id] || "等待加载"
      }}</small>
      <div class="compact-row">
        <a :href="layer.source" target="_blank" rel="noreferrer">来源 ↗</a
        ><button :disabled="index === 0" @click="move(index, -1)">↑</button
        ><button
          :disabled="index === catalog.mapLayers.length - 1"
          @click="move(index, 1)"
        >
          ↓</button
        ><button @click="catalog.mapLayers.splice(index, 1)">删除</button>
      </div>
    </div>
    <details>
      <summary>添加在线图层</summary>
      <label class="field">图层名称<input v-model="name" /></label>
      <label class="field"
        >资源类型<select v-model="kind">
          <option value="xyz">月球等经纬度瓦片</option>
          <option value="image">全球等经纬度图片</option>
        </select></label
      >
      <label class="field"
        >资源地址<input v-model="url" placeholder="https://…/{z}/{y}/{x}.png"
      /></label>
      <p class="panel-note">
        瓦片需为全球 2×1 起始矩阵、256 像素瓦片。地球 Web Mercator
        和极区投影不能直接加入。
      </p>
      <button class="secondary-button" @click="add">添加图层</button>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    </details>
  </section>
</template>
