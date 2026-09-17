<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  FolderOpen,
} from "@lucide/vue";
import { useCatalog } from "../stores/catalog";
import { validUrl } from "../data/pointFiles";
const catalog = useCatalog();
const emit = defineEmits<{ retry: [] }>();
const name = ref("");
const url = ref("");
const kind = ref<"image" | "xyz">("xyz");
const error = ref("");
const collapsed = ref<string[]>([]);
const selected = ref<string | null>(null);
const groups = computed(() => {
  const definitions = [
    { id: "imagery", name: "月表影像", ids: ["local-lro", "wac"] },
    {
      id: "terrain",
      name: "地形与高程",
      ids: ["lola-dem", "lola-color", "lola-shade"],
    },
    { id: "geology", name: "地质专题", ids: ["geology"] },
    { id: "custom", name: "自定义图层", ids: [] as string[] },
  ];
  const builtIn = definitions.flatMap((group) => group.ids);
  return definitions
    .map((group) => ({
      ...group,
      layers: catalog.mapLayers.filter((layer) =>
        group.id === "custom"
          ? !builtIn.includes(layer.id)
          : group.ids.includes(layer.id),
      ),
    }))
    .filter((group) => group.layers.length);
});
function toggleGroup(id: string) {
  collapsed.value = collapsed.value.includes(id)
    ? collapsed.value.filter((value) => value !== id)
    : [...collapsed.value, id];
}
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
      <button class="primary-button" @click="saveConfig">保存图层配置</button
      ><button class="text-button" @click="catalog.restoreMaps()">
        恢复内置图层
      </button>
    </div>
    <div class="section-label">
      地图与高程
      <button class="text-button" @click="emit('retry')">重试加载</button>
    </div>
    <div class="layer-tree" aria-label="地图图层树">
      <section v-for="group in groups" :key="group.id" class="tree-group">
        <div class="tree-group-heading">
          <button
            :aria-label="`${group.name}分组`"
            :aria-expanded="!collapsed.includes(group.id)"
            @click="toggleGroup(group.id)"
          >
            <ChevronRight
              v-if="collapsed.includes(group.id)"
              :size="15"
            /><ChevronDown v-else :size="15" /> <FolderOpen :size="16" />{{
              group.name
            }}<small>{{ group.layers.length }}</small>
          </button>
          <input
            type="checkbox"
            :aria-label="`显示全部${group.name}`"
            :checked="group.layers.every((layer) => layer.visible)"
            :indeterminate="
              group.layers.some((layer) => layer.visible) &&
              !group.layers.every((layer) => layer.visible)
            "
            @change="
              group.layers.forEach(
                (layer) =>
                  (layer.visible = ($event.target as HTMLInputElement).checked),
              )
            "
          />
        </div>
        <div v-show="!collapsed.includes(group.id)" class="tree-children">
          <div
            v-for="layer in group.layers"
            :key="layer.id"
            class="catalog-layer tree-leaf"
          >
            <div class="tree-leaf-heading">
              <label class="checkbox-row"
                ><input type="checkbox" v-model="layer.visible" />{{
                  layer.name
                }}</label
              >
              <button
                class="tree-settings icon-button"
                :aria-label="`${layer.name}设置`"
                :aria-expanded="selected === layer.id"
                @click="selected = selected === layer.id ? null : layer.id"
              >
                <SlidersHorizontal :size="16" />
              </button>
            </div>
            <small
              class="layer-status"
              :class="{
                'visually-hidden':
                  !layer.visible ||
                  !/加载中|失败/.test(catalog.layerStatus[layer.id] || ''),
              }"
              >{{ catalog.layerStatus[layer.id] || "等待加载" }}</small
            >
            <div v-if="selected === layer.id" class="tree-layer-settings">
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
              <div class="compact-row">
                <a :href="layer.source" target="_blank" rel="noreferrer"
                  >来源 ↗</a
                ><span>叠放 {{ catalog.mapLayers.indexOf(layer) + 1 }}</span
                ><button
                  class="icon-button"
                  :aria-label="`${layer.name}下移`"
                  :disabled="catalog.mapLayers.indexOf(layer) === 0"
                  @click="move(catalog.mapLayers.indexOf(layer), -1)"
                >
                  ↓</button
                ><button
                  class="icon-button"
                  :aria-label="`${layer.name}上移`"
                  :disabled="
                    catalog.mapLayers.indexOf(layer) ===
                    catalog.mapLayers.length - 1
                  "
                  @click="move(catalog.mapLayers.indexOf(layer), 1)"
                >
                  ↑</button
                ><button
                  class="text-button danger-button"
                  @click="
                    catalog.mapLayers.splice(
                      catalog.mapLayers.indexOf(layer),
                      1,
                    )
                  "
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
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
