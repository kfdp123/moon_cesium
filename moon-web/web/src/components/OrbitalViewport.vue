<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAstronomy } from "../stores/astronomy";
import { OrbitalScene } from "../scene/OrbitalScene";
import { loadEarthResources } from "../scene/earth";
const emit = defineEmits<{ ready: []; interact: [] }>();
const astronomy = useAstronomy();
const host = ref<HTMLElement>();
const error = ref("");
let scene: OrbitalScene | undefined;
const loading = ref(true);
let disposed = false;
async function initialize() {
  error.value = "";
  loading.value = true;
  try {
    const earthImage = await loadEarthResources();
    if (disposed) return;
    scene = new OrbitalScene(
      host.value!,
      astronomy.clock,
      (message) => (error.value = message),
      earthImage,
    );
    scene.configure(
      astronomy.trueScale,
      astronomy.lighting,
      astronomy.earthAtmosphere,
    );
    emit("ready");
  } catch (cause) {
    error.value = String(cause);
  } finally {
    loading.value = false;
  }
}
function retry() {
  scene?.dispose();
  scene = undefined;
  initialize();
}
watch(
  () => [astronomy.trueScale, astronomy.lighting, astronomy.earthAtmosphere],
  () =>
    scene?.configure(
      astronomy.trueScale,
      astronomy.lighting,
      astronomy.earthAtmosphere,
    ),
);
onMounted(initialize);
onBeforeUnmount(() => {
  disposed = true;
  scene?.dispose();
});
defineExpose({
  reset: () => scene?.reset(),
  focusEarth: () => scene?.focusEarth(),
  focusMoon: () => scene?.focusMoon(),
  zoom: (direction: "in" | "out") => scene?.zoom(direction),
  capture: () => scene?.capture(),
});
</script>
<template>
  <div class="viewport" @pointerdown="emit('interact')">
    <div ref="host" class="cesium-surface" aria-label="地月公转三维场景" />
    <div v-if="loading" class="scene-message" role="status">
      <span class="loading-orbit" /><strong>正在准备地球影像与地月场景</strong>
    </div>
    <div v-if="error" class="scene-message" role="alert">
      <strong>地月场景加载失败</strong>
      <p>{{ error }}</p>
      <button class="primary-button" @click="retry">重新加载</button>
    </div>
  </div>
</template>
