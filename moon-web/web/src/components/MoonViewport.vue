<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useExplorer } from "../stores/explorer";
import { useCatalog } from "../stores/catalog";
import { useAstronomy } from "../stores/astronomy";
import type { LunarPoint, NavigationMode } from "../types";
import type { PointModelState } from "../scene/PointModelLayer";
import { MoonScene } from "../scene/MoonScene";
import type { PointHover } from "../scene/PointFeatureLayer";
import { pointStories } from "../data/pointStories";

const emit = defineEmits<{
  ready: [];
  interact: [];
  pointModel: [state: PointModelState | null];
}>();
const explorer = useExplorer();
const catalog = useCatalog();
const astronomy = useAstronomy();
const lightOptions = () => ({
  lighting: astronomy.lighting,
  shadows: astronomy.shadows,
  inertialCamera: astronomy.inertialCamera,
});
const container = ref<HTMLElement>();
const status = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const hover = ref<PointHover | null>(null);
const hoveredPoint = computed(() =>
  catalog.points.find((point) => point.id === hover.value?.id),
);
const hoverPosition = computed(() => ({
  left: `${Math.min(hover.value?.x ?? 0, (container.value?.clientWidth ?? 1000) - 300) + 18}px`,
  top: `${Math.max(110, Math.min((hover.value?.y ?? 0) + 22, (container.value?.clientHeight ?? 800) - 240))}px`,
}));
let scene: MoonScene | undefined;

async function initialize() {
  status.value = "loading";
  try {
    scene = new MoonScene(
      container.value!,
      (selection) => {
        explorer.selectedLayer =
          selection?.kind === "layer" ? selection.id : null;
        explorer.selectedLandmark =
          selection?.kind === "landmark" ? selection.id : null;
      },
      (id, message) => {
        catalog.layerStatus[id] = message;
      },
      (message) => {
        error.value = message;
        status.value = "error";
      },
      astronomy.clock,
      (state) => emit("pointModel", state),
      (value) => {
        hover.value = value;
      },
    );
    scene.setLighting(lightOptions());
    scene.applyState({ ...explorer.sceneState, points: catalog.points });
    await scene.applyMaps(catalog.mapLayers);
    status.value = "ready";
    emit("ready");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
    status.value = "error";
  }
}

function retry() {
  scene?.dispose();
  scene = undefined;
  void initialize();
}

watch(lightOptions, (options) => scene?.setLighting(options));
watch(
  () => explorer.selectedLandmark,
  (id) => {
    hover.value = null;
    scene?.selectLandmark(id);
  },
);
watch(
  () => ({ ...explorer.sceneState, points: catalog.points }),
  (state) => scene?.applyState(state),
  { deep: true },
);
watch(
  () => catalog.mapLayers,
  (layers) => void scene?.applyMaps(layers),
  { deep: true },
);
onMounted(initialize);
onBeforeUnmount(() => scene?.dispose());
defineExpose({
  reset: () => scene?.resetCamera(),
  zoom: (direction: "in" | "out") => scene?.zoom(direction),
  flyTo: (id: string) => scene?.flyToLandmark(id),
  capture: () => scene?.capture(),
  navigate: (mode: NavigationMode) => scene?.setNavigation(mode),
  inspectBase: () => scene?.inspectBase(),
  reloadMaps: () => scene?.applyMaps(catalog.mapLayers, true),
  loadPointModel: (point: LunarPoint) => scene?.loadPointModel(point),
  focusPointModel: () => scene?.focusPointModel(),
  clearPointModel: () => scene?.clearPointModel(),
  setTheme: (ids: string[]) => scene?.setExplorationTheme(ids),
});
</script>

<template>
  <div
    class="viewport"
    @pointerleave="hover = null"
    @pointerdown="emit('interact')"
    @wheel.passive="emit('interact')"
    @keydown="emit('interact')"
  >
    <div
      ref="container"
      class="cesium-surface"
      aria-label="可旋转和缩放的月球三维场景"
    />
    <div
      v-if="hoveredPoint && hoveredPoint.id !== explorer.selectedLandmark"
      class="point-hover"
      :style="hoverPosition"
      aria-hidden="true"
    >
      <img
        v-if="hoveredPoint.images[0]"
        :src="hoveredPoint.images[0].url"
        alt=""
      />
      <div>
        <span>{{ hoveredPoint.category }}</span
        ><strong>{{ hoveredPoint.name }}</strong>
        <p v-if="pointStories[hoveredPoint.id]">
          {{ pointStories[hoveredPoint.id]!.kicker }}
        </p>
      </div>
    </div>
    <div v-if="status !== 'ready'" class="scene-message" role="status">
      <span v-if="status === 'loading'" class="loading-orbit" />
      <strong>{{
        status === "loading" ? "正在展开月球世界" : "月球场景暂时无法加载"
      }}</strong>
      <p>{{ status === "loading" ? "准备月表影像与三维场景…" : error }}</p>
      <button v-if="status === 'error'" class="primary-button" @click="retry">
        重新加载
      </button>
    </div>
  </div>
</template>
