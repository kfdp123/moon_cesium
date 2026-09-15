import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  Matrix4,
  LabelCollection,
  Cartesian2,
  type Primitive,
  type Viewer,
} from "cesium";
import type { SceneState } from "../types";

/** Animates existing meshes; expansion never rebuilds the sphere geometry. */
export class InteriorExhibit {
  private state?: SceneState;
  private amount = 0;
  private lastTime = performance.now();
  private focus: string | null = null;
  private removeTick: () => void;
  private labels: LabelCollection;
  private offsets: number[] = [];
  private needsUpdate = true;
  constructor(
    private viewer: Viewer,
    private layers: Map<string, Primitive[]>,
  ) {
    this.labels = viewer.scene.primitives.add(new LabelCollection());
    this.removeTick = viewer.scene.preUpdate.addEventListener(() =>
      this.tick(),
    );
  }
  configure(state: SceneState) {
    this.state = state;
    this.needsUpdate = true;
    this.offsets = [0];
    for (let i = 1; i < state.layers.length; i++) {
      this.offsets.push(
        this.offsets[i - 1] +
          (state.layers[i - 1].outerRadiusKm +
            state.layers[i].outerRadiusKm +
            state.radiusKm * 0.12) *
            1000,
      );
    }
    this.labels.removeAll();
    for (const layer of state.layers)
      this.labels.add({
        position: Cartesian3.ZERO,
        id: `layer:${layer.id}`,
        text: layer.name,
        font: "16px sans-serif",
        fillColor: Color.fromCssColorString(layer.color),
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#11222de6"),
        backgroundPadding: new Cartesian2(8, 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    const focus = state.exhibit ? state.selectedLayer : null;
    if (focus !== this.focus) {
      this.focus = focus;
      const index = state.layers.findIndex((layer) => layer.id === focus);
      if (index >= 0) {
        if (!state.exhibit?.expanded) this.amount = 0;
        const layer = state.layers[index];
        this.flyTo(
          this.offset(index),
          Math.max(layer.outerRadiusKm * 1000, state.radiusKm * 180),
        );
      } else if (state.exhibit) {
        this.overview(true);
      }
    }
    if (!state.exhibit) this.amount = 0;
  }
  private offset(index: number) {
    const distance = this.offsets[index] * this.amount;
    return new Cartesian3(
      -0.572 * distance,
      0.817 * distance,
      -0.08 * distance,
    );
  }
  overview(animate: boolean) {
    const state = this.state!;
    const last = state.layers.length - 1;
    const extent = state.exhibit?.expanded
      ? (this.offsets[last] + state.layers[last].outerRadiusKm * 1000) /
          (state.radiusKm * 1000) -
        1
      : 0;
    const radius = state.radiusKm * 1000;
    this.flyTo(
      new Cartesian3(
        (-0.574 * extent * radius) / 2,
        (0.819 * extent * radius) / 2,
        0,
      ),
      radius * Math.max(1, (extent + 2) / 3.4),
      animate,
    );
  }
  private flyTo(center: Cartesian3, radius: number, animate = true) {
    const eye = Cartesian3.normalize(
      new Cartesian3(0.78, 0.55, 0.3),
      new Cartesian3(),
    );
    const direction = Cartesian3.negate(eye, new Cartesian3());
    const right = Cartesian3.normalize(
      Cartesian3.cross(direction, Cartesian3.UNIT_Z, new Cartesian3()),
      new Cartesian3(),
    );
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.camera.flyTo({
      destination: Cartesian3.add(
        center,
        Cartesian3.multiplyByScalar(
          eye,
          radius *
            4.4 *
            Math.max(
              1,
              this.viewer.canvas.clientHeight / this.viewer.canvas.clientWidth,
            ),
          new Cartesian3(),
        ),
        new Cartesian3(),
      ),
      orientation: {
        direction,
        up: Cartesian3.cross(right, direction, new Cartesian3()),
      },
      duration: animate ? 0.85 : 0,
    });
  }
  private tick() {
    const state = this.state;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    if (!state) return;
    const target = state.exhibit?.expanded ? 1 : 0;
    const moving = Math.abs(target - this.amount) > 0.001;
    if (!moving && !this.needsUpdate && this.amount === target) return;
    this.needsUpdate = false;
    this.amount = moving
      ? this.amount + (target - this.amount) * (1 - Math.exp(-dt * 6))
      : target;
    const focusIndex = state.exhibit
      ? state.layers.findIndex((layer) => layer.id === state.selectedLayer)
      : -1;
    this.viewer.scene.globe.show =
      !state.hiddenLayers.includes(state.layers[0].id) &&
      focusIndex <= 0 &&
      !(state.exhibit && state.exhibit.epoch < 3);
    for (const [index, layer] of state.layers.entries()) {
      const label = this.labels.get(index);
      label.show =
        Boolean(state.exhibit?.expanded) &&
        focusIndex < 0 &&
        !state.hiddenLayers.includes(layer.id);
      label.position = Cartesian3.add(
        this.offset(index),
        new Cartesian3(
          0,
          0,
          -layer.outerRadiusKm * 1000 - state.radiusKm * 130,
        ),
        new Cartesian3(),
      );
      const color = Color.fromCssColorString(layer.color);
      if (focusIndex >= 0 && index !== focusIndex)
        Color.multiplyByScalar(color, 0.45, color);
      color.alpha = 1;
      for (const primitive of this.layers.get(layer.id) || []) {
        primitive.modelMatrix = Matrix4.fromTranslation(this.offset(index));
        primitive.show =
          !state.hiddenLayers.includes(layer.id) &&
          (focusIndex < 0 || index >= focusIndex);
        if (primitive.ready)
          primitive.getGeometryInstanceAttributes(`layer:${layer.id}`).color =
            ColorGeometryInstanceAttribute.toValue(color);
        else this.needsUpdate = true;
      }
    }
    if (moving) this.viewer.scene.requestRender();
  }
  dispose() {
    this.removeTick();
    this.viewer.scene.primitives.remove(this.labels);
  }
}
