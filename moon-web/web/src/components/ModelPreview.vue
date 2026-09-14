<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Color, HeadingPitchRange, Model, Viewer } from "cesium";
const props = defineProps<{ url: string }>();
const container = ref<HTMLElement>();
const message = ref("正在加载模型…");
let viewer: Viewer | undefined;
onMounted(async () => {
  try {
    viewer = new Viewer(container.value!, {
      globe: false,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      scene3DOnly: true,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenButton: false,
      skyBox: false,
      skyAtmosphere: false,
      requestRenderMode: true,
    });
    viewer.scene.backgroundColor = Color.fromCssColorString("#17212b");
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 0.1;
    viewer.scene.renderError.addEventListener((_scene, cause) => {
      message.value = `模型显示失败：${String(cause)}`;
    });
    const model = await Model.fromGltfAsync({ url: props.url });
    if (viewer.isDestroyed()) {
      model.destroy();
      return;
    }
    viewer.scene.primitives.add(model);
    model.readyEvent.addEventListener(() => {
      viewer!.camera.flyToBoundingSphere(model.boundingSphere, {
        duration: 0,
        offset: new HeadingPitchRange(
          0.5,
          -0.4,
          model.boundingSphere.radius * 3,
        ),
      });
      message.value = "";
    });
    viewer.scene.requestRender();
  } catch (cause) {
    message.value = `模型加载失败：${String(cause)}`;
  }
});
onBeforeUnmount(() => viewer?.destroy());
</script>
<template>
  <div class="model-preview">
    <div ref="container" class="model-canvas" />
    <p v-if="message" role="status">{{ message }}</p>
    <span v-else>拖动旋转 · 滚轮缩放</span>
  </div>
</template>
