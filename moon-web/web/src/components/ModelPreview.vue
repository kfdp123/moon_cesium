<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  Cartesian3,
  Color,
  DirectionalLight,
  HeadingPitchRange,
  Matrix4,
  Model,
  Viewer,
} from "cesium";
const props = defineProps<{ url: string }>();
const emit = defineEmits<{ thumbnail: [image: string] }>();
const container = ref<HTMLElement>();
const message = ref("正在加载模型…");
const failed = ref(false);
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
      maximumRenderTimeChange: Infinity,
      showRenderLoopErrors: false,
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    });
    viewer.scene.backgroundColor = Color.fromCssColorString("#17212b");
    viewer.scene.light = new DirectionalLight({
      direction: new Cartesian3(-0.4, 0.4, -0.8),
      intensity: 1.25,
    });
    viewer.scene.renderError.addEventListener((_scene, cause) => {
      message.value = `模型显示失败：${String(cause)}`;
      failed.value = true;
    });
    const model = await Model.fromGltfAsync({ url: props.url });
    if (viewer.isDestroyed()) {
      model.destroy();
      return;
    }
    viewer.scene.primitives.add(model);
    model.readyEvent.addEventListener(() => {
      const sphere = model.boundingSphere;
      const controls = viewer!.scene.screenSpaceCameraController;
      controls.minimumZoomDistance = sphere.radius * 0.8;
      controls.maximumZoomDistance = sphere.radius * 15;
      controls.enableTranslate = false;
      viewer!.camera.frustum.near = sphere.radius * 0.01;
      viewer!.camera.lookAtTransform(
        Matrix4.fromTranslation(sphere.center),
        new HeadingPitchRange(0.5, -0.5, sphere.radius * 2.7),
      );
      let renderedFrames = 0;
      const remove = viewer!.scene.postRender.addEventListener(() => {
        // readyEvent 后还需提交绘制命令，不能把第一帧背景截成封面。
        if (++renderedFrames < 3) {
          viewer!.scene.requestRender();
          return;
        }
        remove();
        message.value = "";
        emit("thumbnail", viewer!.canvas.toDataURL("image/png"));
      });
      viewer!.scene.requestRender();
    });
    viewer.scene.requestRender();
  } catch (cause) {
    if (viewer?.isDestroyed()) return;
    message.value = `模型加载失败：${String(cause)}`;
    failed.value = true;
  }
});
onBeforeUnmount(() => viewer?.destroy());
</script>
<template>
  <div class="model-preview">
    <div ref="container" class="model-canvas" />
    <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
  </div>
</template>
