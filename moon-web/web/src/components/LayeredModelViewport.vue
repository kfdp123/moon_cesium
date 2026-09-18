<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ArrowLeft, Eye, RotateCcw, ExternalLink } from "@lucide/vue";
import {
  geologyModelGroups,
  geologyModels,
  type GeologyModelAsset,
} from "../data/geologyModels";
import {
  LayeredModelScene,
  type LayeredModelStatus,
  type LayeredModelView,
} from "../scene/LayeredModelScene";

const props = withDefaults(
  defineProps<{ initialId?: string }>(),
  { initialId: "interior-layer-block" },
);
const emit = defineEmits<{ close: []; ready: [id: string] }>();

const container = ref<HTMLElement>();
const selectedId = ref(
  geologyModels.some((model) => model.id === props.initialId)
    ? props.initialId
    : geologyModels[0]?.id ?? "",
);
const error = ref("");
const status = ref<LayeredModelStatus>({ state: "loading" });
const view = ref<LayeredModelView>("oblique");
const scene = ref<LayeredModelScene>();
const selected = computed<GeologyModelAsset | undefined>(() =>
  geologyModels.find((model) => model.id === selectedId.value),
);

function modelsIn(group: (typeof geologyModelGroups)[number]["id"]) {
  return geologyModels.filter((model) => model.group === group);
}
function choose(model: GeologyModelAsset) {
  if (selectedId.value === model.id) return;
  selectedId.value = model.id;
  view.value = "oblique";
}
function reset(nextView: LayeredModelView = "oblique") {
  view.value = nextView;
  scene.value?.reset(nextView);
}
function onStatus(next: LayeredModelStatus) {
  status.value = next;
  error.value = next.state === "error" ? next.message : "";
  if (next.state === "ready" && selected.value) emit("ready", selected.value.id);
}
onMounted(() => {
  scene.value = new LayeredModelScene(container.value!, onStatus);
  void scene.value.load(selected.value!.url);
});
watch(selectedId, async () => {
  error.value = "";
  await nextTick();
  if (selected.value) void scene.value?.load(selected.value.url);
});
onBeforeUnmount(() => scene.value?.dispose());
defineExpose({ reset, capture: () => scene.value?.capture() });
</script>

<template>
  <div class="layered-model-viewport" aria-label="分层模型展台">
    <div ref="container" class="layered-model-canvas" />
    <aside class="layered-model-panel">
      <div class="layered-model-toolbar">
        <button class="text-button" @click="emit('close')">
          <ArrowLeft :size="18" />内部与演化
        </button>
        <span class="layered-model-status" :data-state="status.state">
          <i />{{ status.state === "loading" ? "加载中" : status.state === "ready" ? "" : "无法加载" }}
        </span>
      </div>
      <h2>分层模型</h2>
      <div class="layered-model-views" role="group" aria-label="模型视角">
        <button :aria-pressed="view === 'oblique'" @click="reset('oblique')">透视</button>
        <button :aria-pressed="view === 'front'" @click="reset('front')">正面</button>
        <button :aria-pressed="view === 'side'" @click="reset('side')">侧面</button>
        <button :aria-pressed="view === 'top'" @click="reset('top')">俯视</button>
        <button class="icon-button" aria-label="复位视角" title="复位视角" @click="reset()">
          <RotateCcw :size="17" />
        </button>
      </div>
      <div class="layered-model-tree" aria-label="模型目录">
        <section v-for="group in geologyModelGroups" :key="group.id">
          <h3>{{ group.name }}</h3>
          <button
            v-for="model in modelsIn(group.id)"
            :key="model.id"
            class="layered-model-item"
            :aria-pressed="selectedId === model.id"
            @click="choose(model)"
          >
            <Eye :size="16" />
            <span>{{ model.name }}</span>
          </button>
        </section>
      </div>
      <div v-if="selected" class="layered-model-info">
        <h3>{{ selected.name }}</h3>
        <p>{{ selected.description }}</p>
        <div class="layered-model-layers">
          <span v-for="layer in selected.layers" :key="layer.name">
            <i :style="{ background: layer.color }" />{{ layer.name }}
          </span>
        </div>
        <details v-if="selected.sources.length">
          <summary>来源</summary>
          <a
            v-for="source in selected.sources"
            :key="source.title"
            :href="source.url || undefined"
            :aria-disabled="!source.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ source.title }}<ExternalLink :size="14" />
          </a>
        </details>
      </div>
      <div v-if="error" class="layered-model-error" role="alert">
        {{ error }}
      </div>
    </aside>
    <div v-if="status.state === 'loading'" class="layered-model-loading" role="status">
      正在加载模型…
    </div>
  </div>
</template>

<style scoped>
.layered-model-viewport,
.layered-model-canvas {
  position: absolute;
  inset: 0;
}
.layered-model-panel {
  position: absolute;
  z-index: 3;
  top: var(--header-bottom);
  left: calc(var(--edge) + var(--tool-offset));
  width: 340px;
  max-height: calc(100% - var(--header-bottom) - 32px);
  overflow: auto;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--glass);
  box-shadow: 0 16px 48px #0005;
  backdrop-filter: blur(16px);
}
.layered-model-toolbar,
.layered-model-views { display: flex; align-items: center; gap: 8px; }
.layered-model-toolbar { justify-content: space-between; }
.layered-model-toolbar .text-button { display: flex; align-items: center; gap: 8px; padding: 0; }
.layered-model-panel h2 { margin: 14px 0 12px; font-size: 1.35rem; }
.layered-model-views { flex-wrap: wrap; margin-bottom: 16px; }
.layered-model-views button:not(.icon-button) { padding: 8px 11px; border: 1px solid var(--control-border); border-radius: 8px; background: #ffffff08; }
.layered-model-views button[aria-pressed="true"] { border-color: var(--accent); background: var(--selected-bg); }
.layered-model-status { color: var(--muted); font-size: .8rem; }
.layered-model-status i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: var(--accent); }
.layered-model-status[data-state="error"] i { background: #ef7663; }
.layered-model-tree { border-top: 1px solid var(--line); }
.layered-model-tree section { padding: 12px 0 4px; }
.layered-model-tree h3 { margin: 0 0 7px; color: var(--muted); font-size: .85rem; font-weight: 600; }
.layered-model-item { display: flex; align-items: center; width: 100%; gap: 9px; padding: 9px 8px; border: 1px solid transparent; border-radius: 8px; color: inherit; background: transparent; text-align: left; }
.layered-model-item:hover { background: var(--control-hover); }
.layered-model-item[aria-pressed="true"] { border-color: var(--accent); background: var(--selected-bg); }
.layered-model-info { margin-top: 12px; padding-top: 14px; border-top: 1px solid var(--line); }
.layered-model-info h3 { margin: 0 0 7px; }
.layered-model-info p { margin: 0 0 12px; color: var(--muted); line-height: 1.6; }
.layered-model-layers { display: grid; gap: 7px; }
.layered-model-layers span { display: flex; align-items: center; gap: 8px; font-size: .9rem; }
.layered-model-layers i { width: 11px; height: 18px; border-radius: 3px; }
.layered-model-info details { margin-top: 14px; color: var(--muted); }
.layered-model-info summary { cursor: pointer; color: var(--accent); }
.layered-model-info a { display: flex; align-items: center; gap: 5px; margin-top: 8px; color: var(--accent); }
.layered-model-info a[aria-disabled="true"] { pointer-events: none; }
.layered-model-error { margin-top: 14px; color: #ef9a8b; overflow-wrap: anywhere; }
.layered-model-loading { position: absolute; z-index: 2; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 14px 18px; border-radius: 10px; background: #0b1421c9; }
@media (max-width: 700px) { .layered-model-panel { width: min(340px, calc(100% - 32px)); left: 16px; } }
</style>
