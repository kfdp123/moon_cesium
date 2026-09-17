import { Matrix4, Model, Viewer } from "cesium";

/** A small textured surface around equipment; it follows the same DEM anchor. */
export class PointModelEnvironment {
  private model?: Model;
  private disposed = false;

  constructor(
    private viewer: Viewer,
    private matrix: Matrix4,
  ) {
    void this.load().catch((error) => console.warn("月壤环境加载失败", error));
  }

  private async load() {
    const model = await Model.fromGltfAsync({
      url: "/assets/point-models/regolith.glb",
      modelMatrix: this.matrix,
      scale: 10,
      cull: false,
      // The surroundings must not intercept a click on the equipment.
      allowPicking: false,
    });
    if (this.disposed) {
      model.destroy();
      return;
    }
    model.modelMatrix = this.matrix;
    this.model = this.viewer.scene.primitives.add(model);
    this.viewer.scene.requestRender();
  }

  update(matrix: Matrix4) {
    this.matrix = matrix;
    if (this.model) this.model.modelMatrix = matrix;
  }

  dispose() {
    this.disposed = true;
    if (this.model) this.viewer.scene.primitives.remove(this.model);
  }
}
