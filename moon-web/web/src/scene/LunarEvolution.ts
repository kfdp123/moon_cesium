import {
  Cartesian3,
  Color,
  PointPrimitiveCollection,
  type Primitive,
  type Viewer,
} from "cesium";
import type { SceneState } from "../types";
import { evolutionParticle } from "./evolutionParticles";

export class LunarEvolution {
  private state?: SceneState;
  private elapsed = 0;
  private lastTime = performance.now();
  private dirty = true;
  private particles: PointPrimitiveCollection;
  private removeTick: () => void;
  constructor(
    private viewer: Viewer,
    private layers: Map<string, Primitive[]>,
  ) {
    this.particles = viewer.scene.primitives.add(
      new PointPrimitiveCollection(),
    );
    for (let i = 0; i < 108; i++)
      this.particles.add({ position: Cartesian3.ZERO, show: false });
    this.removeTick = viewer.scene.preUpdate.addEventListener(() =>
      this.tick(),
    );
  }
  configure(state: SceneState) {
    if (this.state?.exhibit?.epoch !== state.exhibit?.epoch) this.elapsed = 0;
    this.state = state;
    this.dirty = true;
  }
  private tick() {
    const now = performance.now(),
      dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const state = this.state;
    if (!state) return;
    const stage = state.exhibit?.epoch ?? 3;
    const animate = stage < 3 && state.exhibit?.animate;
    if (!animate && !this.dirty) return;
    if (animate) this.elapsed += dt;
    this.dirty = false;
    for (const primitives of this.layers.values())
      for (const primitive of primitives) {
        const uniforms = primitive.appearance.material!.uniforms;
        uniforms.processTime = this.elapsed;
        uniforms.processStage = stage;
      }
    this.particles.show =
      stage < 3 &&
      !state.exhibit?.expanded &&
      !state.selectedLayer &&
      state.cutaway !== "full" &&
      !state.hiddenLayers.includes("mantle");
    const radius = state.radiusKm * 1000;
    for (let i = 0; i < this.particles.length; i++) {
      const sample = evolutionParticle(stage, i, this.elapsed);
      const point = this.particles.get(i);
      point.position = new Cartesian3(
        radius * 0.004,
        sample.y * radius,
        sample.z * radius,
      );
      point.pixelSize = sample.size;
      point.color = (
        sample.rising
          ? Color.fromCssColorString("#fff1cb")
          : Color.fromCssColorString("#ffb43d")
      ).withAlpha(sample.alpha);
      point.show = sample.alpha > 0;
    }
    this.viewer.scene.requestRender();
  }
  dispose() {
    this.removeTick();
    this.viewer.scene.primitives.remove(this.particles);
  }
}
