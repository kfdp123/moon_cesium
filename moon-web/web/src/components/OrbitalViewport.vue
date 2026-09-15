<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAstronomy } from "../stores/astronomy";
import { OrbitalScene } from "../scene/OrbitalScene";
const emit = defineEmits<{ ready: []; interact: [] }>();
const astronomy = useAstronomy();
const host = ref<HTMLElement>();
const error = ref("");
let scene: OrbitalScene | undefined;
function initialize() {
  error.value = "";
  try {
    scene = new OrbitalScene(
      host.value!,
      astronomy.clock,
      (message) => (error.value = message),
    );
    scene.configure(astronomy.trueScale, astronomy.lighting);
    emit("ready");
  } catch (cause) {
    error.value = String(cause);
  }
}
function retry() {
  scene?.dispose();
  scene = undefined;
  initialize();
}
watch(
  () => [astronomy.trueScale, astronomy.lighting],
  () => scene?.configure(astronomy.trueScale, astronomy.lighting),
);
onMounted(initialize);
onBeforeUnmount(() => scene?.dispose());
defineExpose({
  reset: () => scene?.reset(),
  zoom: (direction: "in" | "out") => scene?.zoom(direction),
  capture: () => scene?.capture(),
});
</script>
<template>
  <div class="viewport" @pointerdown="emit('interact')">
    <div ref="host" class="cesium-surface" aria-label="地月公转三维场景" />
    <div v-if="error" class="scene-message" role="alert">
      <strong>地月场景加载失败</strong>
      <p>{{ error }}</p>
      <button class="primary-button" @click="retry">重新加载</button>
    </div>
  </div>
</template>
