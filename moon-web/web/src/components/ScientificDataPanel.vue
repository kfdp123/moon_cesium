<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ChevronDown, ChevronRight, Database, ExternalLink } from "@lucide/vue";
import {
  DEFAULT_CESIUM_DATA_BASE,
  resolveCesiumDataUrl,
  type CesiumCatalogLayer,
} from "../data/cesiumCatalog";
import { useScienceData } from "../stores/scienceData";

const props = withDefaults(
  defineProps<{
    baseUrl?: string;
    autoLoad?: boolean;
  }>(),
  { autoLoad: true },
);

const science = useScienceData();
const collapsed = ref(new Set<string>());
const selectedId = ref<string | null>(null);

const groups = computed(() => {
  const grouped = new Map<string, CesiumCatalogLayer[]>();
  for (const layer of science.layers) {
    const items = grouped.get(layer.group) ?? [];
    items.push(layer);
    grouped.set(layer.group, items);
  }
  const order = [
    ...Object.keys(science.groups),
    ...[...grouped.keys()].filter((id) => !Object.hasOwn(science.groups, id)),
  ];
  return order
    .map((id) => ({
      id,
      name: science.groups[id] ?? id,
      layers: grouped.get(id) ?? [],
    }))
    .filter((group) => group.layers.length > 0);
});

const selectedLayer = computed(() =>
  science.layers.find((layer) => layer.id === selectedId.value),
);

const selectedSourceHref = computed(() => {
  const source = selectedLayer.value?.source;
  return source && /^(?:https?:)?\//i.test(source) ? source : undefined;
});

function assetUrl(path: string) {
  return resolveCesiumDataUrl(
    path,
    science.baseUrl || DEFAULT_CESIUM_DATA_BASE,
  );
}

function toggleGroup(id: string) {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}

function groupChecked(layers: CesiumCatalogLayer[]) {
  return (
    layers.length > 0 && layers.every((layer) => science.visible[layer.id])
  );
}

function groupMixed(layers: CesiumCatalogLayer[]) {
  const count = layers.filter((layer) => science.visible[layer.id]).length;
  return count > 0 && count < layers.length;
}

function setGroupVisibility(layers: CesiumCatalogLayer[], value: boolean) {
  for (const layer of layers) science.setLayerVisible(layer.id, value);
}

function selectLayer(layer: CesiumCatalogLayer) {
  selectedId.value = selectedId.value === layer.id ? null : layer.id;
}

function retry() {
  void science.load(props.baseUrl ?? DEFAULT_CESIUM_DATA_BASE);
}

onMounted(() => {
  if (props.autoLoad && !science.catalog && !science.loading)
    void science.load(props.baseUrl ?? DEFAULT_CESIUM_DATA_BASE);
});
</script>

<template>
  <section class="scientific-panel panel-section" aria-label="科研数据图层">
    <div class="section-label scientific-panel-heading">
      <span><Database :size="17" /> 科研数据</span>
      <button
        v-if="science.error"
        class="text-button"
        type="button"
        @click="retry"
      >
        重试
      </button>
    </div>

    <p v-if="science.loading" class="scientific-panel-status">
      正在读取数据目录…
    </p>
    <p v-else-if="science.error" class="form-error" role="alert">
      {{ science.error }}
    </p>
    <p v-else-if="!science.layers.length" class="scientific-panel-status">
      暂无可用科研图层
    </p>

    <div v-else class="scientific-tree" aria-label="科研数据图层树">
      <section v-for="group in groups" :key="group.id" class="scientific-group">
        <div class="scientific-group-heading">
          <button
            type="button"
            class="scientific-group-toggle"
            :aria-expanded="!collapsed.has(group.id)"
            :aria-label="`${group.name}分组`"
            @click="toggleGroup(group.id)"
          >
            <ChevronRight v-if="collapsed.has(group.id)" :size="16" />
            <ChevronDown v-else :size="16" />
            <span>{{ group.name }}</span>
            <small>{{ group.layers.length }}</small>
          </button>
          <input
            type="checkbox"
            :checked="groupChecked(group.layers)"
            :indeterminate="groupMixed(group.layers)"
            :aria-label="`显示全部${group.name}`"
            @change="
              setGroupVisibility(
                group.layers,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
        </div>

        <div
          v-show="!collapsed.has(group.id)"
          class="scientific-group-children"
        >
          <article
            v-for="layer in group.layers"
            :key="layer.id"
            class="scientific-layer"
            :class="{ active: selectedId === layer.id }"
          >
            <div class="scientific-layer-row">
              <label class="checkbox-row scientific-layer-check">
                <input
                  type="checkbox"
                  :checked="science.visible[layer.id]"
                  :aria-label="`显示${layer.title}`"
                  @change="
                    science.setLayerVisible(
                      layer.id,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                <span>{{ layer.title }}</span>
              </label>
              <button
                type="button"
                class="icon-button scientific-info"
                :aria-expanded="selectedId === layer.id"
                :aria-label="`${layer.title}信息`"
                @click="selectLayer(layer)"
              >
                <ChevronDown v-if="selectedId === layer.id" :size="16" />
                <ChevronRight v-else :size="16" />
              </button>
            </div>
            <div v-if="selectedId === layer.id" class="scientific-layer-detail">
              <label class="scientific-opacity">
                <span
                  >透明度
                  {{
                    Math.round((science.opacity[layer.id] ?? 1) * 100)
                  }}%</span
                >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="science.opacity[layer.id] ?? 1"
                  :aria-label="`${layer.title}透明度`"
                  @input="
                    science.setLayerOpacity(
                      layer.id,
                      Number(($event.target as HTMLInputElement).value),
                    )
                  "
                />
              </label>
              <p
                v-if="science.layerLoading[layer.id]"
                class="scientific-layer-status"
              >
                正在加载图层
              </p>
              <p v-if="science.layerErrors[layer.id]" class="form-error">
                {{ science.layerErrors[layer.id] }}
              </p>
              <div class="scientific-layer-meta">
                <span v-if="layer.units">单位：{{ layer.units }}</span>
                <span v-if="layer.type">类型：{{ layer.type }}</span>
              </div>
              <p v-if="layer.note">{{ layer.note }}</p>
              <p v-if="layer.source" class="scientific-source">
                来源：{{ layer.source }}
                <a
                  v-if="
                    selectedSourceHref && selectedSourceHref === layer.source
                  "
                  :href="selectedSourceHref"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="打开数据来源"
                  ><ExternalLink :size="13"
                /></a>
              </p>
              <div v-if="layer.stats" class="scientific-stats">
                <span v-if="layer.stats.min !== undefined"
                  >最小 {{ layer.stats.min }}</span
                >
                <span v-if="layer.stats.mean !== undefined"
                  >平均 {{ layer.stats.mean }}</span
                >
                <span v-if="layer.stats.max !== undefined"
                  >最大 {{ layer.stats.max }}</span
                >
              </div>
              <figure v-if="layer.legend" class="scientific-legend">
                <img
                  :src="assetUrl(layer.legend)"
                  :alt="`${layer.title}图例`"
                />
                <figcaption>图例</figcaption>
              </figure>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.scientific-panel-heading > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.scientific-panel-status {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.scientific-tree {
  display: grid;
  gap: 8px;
}

.scientific-group {
  border: 1px solid var(--line);
  border-radius: var(--control-radius);
  background: #101d29b8;
  overflow: hidden;
}

.scientific-group-heading,
.scientific-layer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scientific-group-heading {
  min-height: 46px;
  padding: 4px 8px;
  background: #1a2b3b;
}

.scientific-group-heading > input {
  margin-left: auto;
}

.scientific-group-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  flex: 1;
  color: #e7f0f4;
  text-align: left;
  font-weight: 600;
}

.scientific-group-toggle small {
  color: var(--muted);
  font-weight: 400;
}

.scientific-group-children {
  padding: 4px 8px 8px;
}

.scientific-layer {
  border-bottom: 1px solid #2a3a4a;
}

.scientific-layer:last-child {
  border-bottom: 0;
}

.scientific-layer-row {
  min-height: 44px;
}

.scientific-layer-check {
  min-width: 0;
  flex: 1;
  line-height: 1.45;
}

.scientific-layer-check span {
  overflow-wrap: anywhere;
}

.scientific-info {
  min-width: 36px;
  min-height: 36px;
  padding: 7px;
}

.scientific-layer-detail {
  padding: 2px 36px 12px 28px;
  color: #c7d5de;
  font-size: 0.875rem;
  line-height: 1.65;
}

.scientific-layer-detail p {
  margin: 6px 0;
}

.scientific-opacity {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 10px;
  color: var(--muted);
}

.scientific-opacity span {
  min-width: 112px;
}

.scientific-opacity input[type="range"] {
  flex: 1;
  width: auto;
}

.scientific-layer-status {
  color: #c3ae87;
}

.scientific-layer-meta,
.scientific-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  color: var(--muted);
}

.scientific-source {
  overflow-wrap: anywhere;
}

.scientific-source a {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 4px;
}

.scientific-legend {
  margin: 9px 0 0;
}

.scientific-legend img {
  display: block;
  max-width: min(100%, 280px);
  max-height: 72px;
  object-fit: contain;
  object-position: left center;
  border: 1px solid var(--line);
  background: #0d1721;
}

.scientific-legend figcaption {
  margin-top: 3px;
  color: var(--muted);
  font-size: 0.8125rem;
}
</style>
