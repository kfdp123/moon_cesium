import {
  Cartesian3,
  Color,
  DirectionalLight,
  HeadingPitchRange,
  Matrix4,
  Model,
  Viewer,
} from "cesium";

export type LayeredModelView = "oblique" | "front" | "side" | "top";
export type LayeredModelStatus =
  | { state: "loading" }
  | { state: "ready" }
  | { state: "error"; message: string };

/** 本地模型展台：按包围球取景，切换和退出时释放当前模型。 */
export class LayeredModelScene {
  readonly viewer: Viewer;
  private model?: Model;
  private request = 0;

  constructor(
    container: HTMLElement,
    private report: (status: LayeredModelStatus) => void,
  ) {
    this.viewer = new Viewer(container, {
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
    const scene = this.viewer.scene;
    scene.backgroundColor = Color.fromCssColorString("#0b1421");
    scene.light = new DirectionalLight({
      direction: new Cartesian3(-0.35, 0.5, -0.8),
      intensity: 1.8,
    });
    scene.highDynamicRange = false;
    scene.screenSpaceCameraController.enableTranslate = false;
    scene.screenSpaceCameraController.enableCollisionDetection = false;
    scene.renderError.addEventListener((_scene, error) => {
      this.report({ state: "error", message: String(error) });
    });
  }

  async load(url: string) {
    const request = ++this.request;
    this.releaseModel();
    this.report({ state: "loading" });
    try {
      const model = await Model.fromGltfAsync({ url });
      // 大文件尚在解析时允许继续切换；迟到的结果不再进入场景。
      if (request !== this.request) {
        model.destroy();
        return;
      }
      this.model = model;
      model.readyEvent.addEventListener(() => {
        this.reset();
        this.report({ state: "ready" });
      });
      model.errorEvent.addEventListener((error) => {
        this.report({ state: "error", message: error.message });
      });
      this.viewer.scene.primitives.add(model);
      this.viewer.useDefaultRenderLoop = true;
      this.viewer.scene.requestRender();
    } catch (error) {
      if (request !== this.request) return;
      this.report({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  reset(view: LayeredModelView = "oblique") {
    if (!this.model?.ready) return;
    const sphere = this.model.boundingSphere;
    const range = sphere.radius * 3.2;
    const pose =
      view === "front"
        ? new HeadingPitchRange(0, -0.015, range)
        : view === "side"
          ? new HeadingPitchRange(Math.PI / 2, -0.015, range)
          : view === "top"
            ? new HeadingPitchRange(0, -Math.PI / 2, range)
            : new HeadingPitchRange(0.45, -0.4, range);
    const controls = this.viewer.scene.screenSpaceCameraController;
    controls.minimumZoomDistance = sphere.radius * 0.4;
    controls.maximumZoomDistance = sphere.radius * 15;
    this.viewer.camera.frustum.near = sphere.radius * 0.005;
    this.viewer.camera.cancelFlight();
    this.viewer.camera.lookAtTransform(
      Matrix4.fromTranslation(sphere.center),
      pose,
    );
    this.viewer.scene.requestRender();
  }

  capture() {
    this.viewer.render();
    return this.viewer.canvas.toDataURL("image/png");
  }

  private releaseModel() {
    if (this.model) this.viewer.scene.primitives.remove(this.model);
    this.model = undefined;
    this.viewer.scene.requestRender();
  }

  dispose() {
    ++this.request;
    this.viewer.destroy();
    this.model = undefined;
  }
}
