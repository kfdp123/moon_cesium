<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useExplorer } from "../stores/explorer";
import { useCatalog } from "../stores/catalog";
import type { NavigationMode } from "../types";
import { MoonScene } from "../scene/MoonScene";

const emit = defineEmits<{ ready: []; interact: [] }>();
const explorer = useExplorer();
const catalog = useCatalog();
const container = ref<HTMLElement>();
const status = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
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
    );
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
  reloadMaps: () => scene?.applyMaps(catalog.mapLayers, true),
});
</script>

<template>
  <div
    class="viewport"
    @pointerdown="emit('interact')"
    @wheel.passive="emit('interact')"
    @keydown="emit('interact')"
  >
    <div
      ref="container"
      class="cesium-surface"
      aria-label="可旋转和缩放的月球三维场景"
    />
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
