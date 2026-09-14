<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useExplorer } from "../stores/explorer";
import { MoonScene } from "../scene/MoonScene";

const emit = defineEmits<{ ready: []; interact: [] }>();
const explorer = useExplorer();
const container = ref<HTMLElement>();
const status = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
let scene: MoonScene | undefined;

async function initialize() {
  status.value = "loading";
  try {
    scene = new MoonScene(container.value!, (selection) => {
      explorer.selectedLayer =
        selection?.kind === "layer" ? selection.id : null;
      explorer.selectedLandmark =
        selection?.kind === "landmark" ? selection.id : null;
    });
    scene.applyState(explorer.sceneState);
    await scene.loadSurface();
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
  () => explorer.sceneState,
  (state) => scene?.applyState(state),
  { deep: true },
);
onMounted(initialize);
onBeforeUnmount(() => scene?.dispose());
defineExpose({
  reset: () => scene?.resetCamera(),
  zoom: (direction: "in" | "out") => scene?.zoom(direction),
  flyTo: (id: string) => scene?.flyToLandmark(id),
  capture: () => scene?.capture(),
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
