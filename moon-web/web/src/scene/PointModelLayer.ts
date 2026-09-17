import {
  Cartesian3,
  Cartographic,
  HeadingPitchRange,
  Matrix4,
  Model,
  Transforms,
  Viewer,
} from "cesium";
import type { LunarPoint } from "../types";
import { pointModel } from "../data/pointModels";
import { terrainHeightAt } from "./lunarTerrain";
import { PointModelEnvironment } from "./PointModelEnvironment";

export interface PointModelState {
  pointId: string;
  title: string;
  status: "loading" | "ready" | "error";
  error?: string;
}

/** 主地图上的单个点位模型；切换模型时释放旧资源。 */
export class PointModelLayer {
  private model?: Model;
  private point?: LunarPoint;
  private request = 0;
  private focused = false;
  private ground = NaN;
  private environment?: PointModelEnvironment;
  private removeGroundListener: () => void;

  constructor(
    private viewer: Viewer,
    private report: (state: PointModelState | null) => void,
  ) {
    this.removeGroundListener = viewer.scene.postRender.addEventListener(() =>
      this.updateGround(),
    );
  }

  async load(point: LunarPoint) {
    const resource = pointModel(point);
    if (!resource) return;
    if (this.point?.id === point.id && this.model?.ready) {
      this.focus();
      return;
    }
    this.clear();
    const request = ++this.request;
    this.point = point;
    this.report({ pointId: point.id, title: point.name, status: "loading" });
    try {
      const model = await Model.fromGltfAsync({
        url: resource.url,
        id: `landmark:${point.id}`,
        modelMatrix: this.placement(point, resource.scale, resource.baseHeight),
        scale: resource.scale,
        // 实际月面可低于参考椭球，不能据参考椭球把地表模型剔除。
        cull: false,
      });
      if (request !== this.request) {
        model.destroy();
        return;
      }
      this.model = this.viewer.scene.primitives.add(model);
      if (resource.environment === "surface")
        this.environment = new PointModelEnvironment(
          this.viewer,
          this.surfaceFrame(),
        );
      model.readyEvent.addEventListener(() => {
        this.updateGround();
        this.focus();
        this.report({ pointId: point.id, title: point.name, status: "ready" });
      });
      model.errorEvent.addEventListener((error) =>
        this.report({
          pointId: point.id,
          title: point.name,
          status: "error",
          error: error.message,
        }),
      );
      const marker = this.viewer.entities.getById(`landmark:${point.id}`);
      if (marker) marker.show = false;
      this.viewer.scene.requestRender();
    } catch (error) {
      if (request !== this.request) return;
      this.report({
        pointId: point.id,
        title: point.name,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private placement(point: LunarPoint, scale: number, baseHeight: number) {
    const { globe } = this.viewer.scene;
    const site = Cartographic.fromDegrees(point.longitude, point.latitude);
    this.ground = Math.max(
      terrainHeightAt(
        this.viewer.terrainProvider,
        point.longitude,
        point.latitude,
      ),
      globe.getHeight(site) ?? -Infinity,
    );
    site.height = this.ground - baseHeight * scale + 0.08;
    return Transforms.eastNorthUpToFixedFrame(
      globe.ellipsoid.cartographicToCartesian(site),
      globe.ellipsoid,
    );
  }

  updateGround() {
    if (!this.model || !this.point) return;
    const resource = pointModel(this.point)!;
    const previous = this.ground;
    const matrix = this.placement(
      this.point,
      resource.scale,
      resource.baseHeight,
    );
    if (Math.abs(previous - this.ground) < 0.01) return;
    this.model.modelMatrix = matrix;
    this.environment?.update(this.surfaceFrame());
    if (this.focused && this.model.ready) {
      const offset = Cartesian3.clone(this.viewer.camera.position);
      this.viewer.camera.lookAtTransform(this.cameraFrame(), offset);
    }
    this.viewer.scene.requestRender();
  }

  private surfaceFrame() {
    const { globe } = this.viewer.scene;
    const site = Cartographic.fromDegrees(
      this.point!.longitude,
      this.point!.latitude,
      this.ground,
    );
    return Transforms.eastNorthUpToFixedFrame(
      globe.ellipsoid.cartographicToCartesian(site),
      globe.ellipsoid,
    );
  }

  private cameraFrame() {
    return Transforms.eastNorthUpToFixedFrame(
      this.model!.boundingSphere.center,
      this.viewer.scene.globe.ellipsoid,
    );
  }
  focus() {
    if (!this.model?.ready) return;
    this.viewer.camera.cancelFlight();
    this.focused = true;
    const radius = this.model.boundingSphere.radius;
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance =
      Math.max(0.4, radius * 0.5);
    this.viewer.camera.lookAtTransform(
      this.cameraFrame(),
      new HeadingPitchRange(0.5, pointModel(this.point!)!.pitch, radius * 3.6),
    );
    this.viewer.scene.requestRender();
  }
  releaseCamera() {
    if (!this.focused) return;
    this.focused = false;
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2;
  }
  clear() {
    ++this.request;
    this.releaseCamera();
    if (this.model) this.viewer.scene.primitives.remove(this.model);
    this.environment?.dispose();
    this.environment = undefined;
    if (this.point) {
      const marker = this.viewer.entities.getById(`landmark:${this.point.id}`);
      if (marker) marker.show = true;
    }
    this.model = undefined;
    this.point = undefined;
    this.ground = NaN;
    this.report(null);
    this.viewer.scene.requestRender();
  }
  dispose() {
    this.removeGroundListener();
    this.clear();
  }
}
