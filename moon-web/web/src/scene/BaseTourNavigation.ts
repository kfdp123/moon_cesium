import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  LabelCollection,
  LabelStyle,
  Matrix4,
  PerspectiveFrustum,
  Transforms,
  VerticalOrigin,
  Viewer,
} from "cesium";
import { baseStops } from "../data/lunarBase";
import { useBaseTour } from "../stores/baseTour";
import type { LunarBaseModel } from "./LunarBaseModel";

const blend = (t: number) => t * t * (3 - 2 * t);

/** A guided camera and a local orbit camera share the same facility targets. */
export class BaseTourNavigation {
  private controls = useBaseTour();
  private labels: LabelCollection;
  private lastCommand = -1;
  private transition = 0;
  private startEye = new Cartesian3();
  private startTarget = new Cartesian3();
  private target = new Cartesian3();
  private readonly originalControls;

  constructor(
    private viewer: Viewer,
    private world: (local: Cartesian3) => Cartesian3,
    private model: LunarBaseModel,
  ) {
    const controller = viewer.scene.screenSpaceCameraController;
    this.originalControls = {
      enableTranslate: controller.enableTranslate,
      minimumZoomDistance: controller.minimumZoomDistance,
      maximumZoomDistance: controller.maximumZoomDistance,
    };
    this.controls.reset();
    this.labels = viewer.scene.primitives.add(new LabelCollection());
    for (const stop of baseStops.slice(1)) {
      this.labels.add({
        id: `base:${stop.id}`,
        position: world(
          new Cartesian3(stop.target[0], stop.target[1], stop.target[2] + 9),
        ),
        text: stop.title,
        font: "600 16px sans-serif",
        fillColor: Color.fromCssColorString("#dcebf1"),
        outlineColor: Color.fromCssColorString("#0b1720"),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#10212de6"),
        backgroundPadding: new Cartesian2(12, 8),
        pixelOffset: new Cartesian2(0, -25),
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        distanceDisplayCondition: new DistanceDisplayCondition(0, 1600),
      });
    }
    // Enter from a wider overview, then ease down to the opening shot.
    const stop = baseStops[0];
    this.target = world(new Cartesian3(...stop.target));
    this.startTarget = Cartesian3.clone(this.target);
    this.startEye = world(
      new Cartesian3(
        stop.target[0] + Math.sin(stop.azimuth) * stop.radius * 1.3,
        stop.target[1] + Math.cos(stop.azimuth) * stop.radius * 1.3,
        stop.height * 1.4,
      ),
    );
    this.setCamera(this.startEye, this.target);
  }

  select(id: string) {
    const index = baseStops.findIndex((stop) => stop.id === id);
    if (index >= 0) this.controls.select(index);
  }

  private setCamera(eye: Cartesian3, target: Cartesian3) {
    const direction = Cartesian3.normalize(
      Cartesian3.subtract(target, eye, new Cartesian3()),
      new Cartesian3(),
    );
    const surfaceUp = this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(
      target,
      new Cartesian3(),
    );
    const right = Cartesian3.normalize(
      Cartesian3.cross(direction, surfaceUp, new Cartesian3()),
      new Cartesian3(),
    );
    const up = Cartesian3.cross(right, direction, new Cartesian3());
    this.viewer.camera.setView({
      destination: eye,
      orientation: { direction, up },
    });
  }

  /** Aim beside the facility so it fills the canvas area clear of the panel. */
  private frameTarget(eye: Cartesian3, target: Cartesian3) {
    const direction = Cartesian3.subtract(target, eye, new Cartesian3());
    const surfaceUp = this.viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(
      target,
      new Cartesian3(),
    );
    const right = Cartesian3.normalize(
      Cartesian3.cross(direction, surfaceUp, new Cartesian3()),
      new Cartesian3(),
    );
    const frustum = this.viewer.camera.frustum as PerspectiveFrustum;
    const inset = Math.min(
      0.55,
      this.controls.panelRight / this.viewer.canvas.clientWidth,
    );
    const shift =
      Cartesian3.magnitude(direction) *
      Math.tan(frustum.fovy! / 2) *
      frustum.aspectRatio! *
      inset;
    return Cartesian3.subtract(
      target,
      Cartesian3.multiplyByScalar(right, shift, right),
      new Cartesian3(),
    );
  }

  private beginShot() {
    const camera = this.viewer.camera;
    this.startEye = Cartesian3.clone(camera.positionWC);
    this.startTarget = Cartesian3.clone(this.target);
    camera.lookAtTransform(Matrix4.IDENTITY);
    this.transition = 0;
    this.lastCommand = this.controls.command;
    const stop = baseStops[this.controls.index];
    this.model.setHighlighted(stop.id === "overview" ? null : stop.id);
    if (this.controls.mode === "free") {
      const frame = Transforms.eastNorthUpToFixedFrame(
        this.target,
        this.viewer.scene.globe.ellipsoid,
      );
      const offset = Matrix4.multiplyByPoint(
        Matrix4.inverseTransformation(frame, new Matrix4()),
        this.startEye,
        new Cartesian3(),
      );
      camera.lookAtTransform(frame, offset);
    }
  }

  tick(dt: number) {
    const c = this.controls;
    if (c.command !== this.lastCommand) this.beginShot();
    const controller = this.viewer.scene.screenSpaceCameraController;
    controller.enableInputs = c.mode === "free";
    controller.enableTranslate = false;
    controller.minimumZoomDistance = Math.max(
      22,
      baseStops[c.index].radius * 0.35,
    );
    controller.maximumZoomDistance = 550;
    for (let i = 0; i < this.labels.length; i++) {
      const selected = c.index === i + 1;
      const label = this.labels.get(i);
      label.show = c.showLabels && (c.index === 0 || selected);
      label.fillColor = Color.fromCssColorString(
        selected ? "#f4ce87" : "#dcebf1",
      );
    }
    if (c.mode === "free") {
      this.viewer.scene.requestRender();
      return;
    }
    const stop = baseStops[c.index];
    this.transition = Math.min(1, this.transition + dt / 2.2);
    if (c.playing && this.transition === 1)
      c.progress = Math.min(1, c.progress + (dt * c.speed) / stop.duration);
    const angle =
      stop.azimuth + blend(c.progress) * (c.index === 0 ? 0.95 : 0.55);
    const eye = this.world(
      new Cartesian3(
        stop.target[0] + Math.sin(angle) * stop.radius,
        stop.target[1] + Math.cos(angle) * stop.radius,
        stop.height + Math.sin(c.progress * Math.PI) * 3,
      ),
    );
    const destination = Cartesian3.lerp(
      this.startEye,
      eye,
      blend(this.transition),
      new Cartesian3(),
    );
    this.target = Cartesian3.lerp(
      this.startTarget,
      this.frameTarget(eye, this.world(new Cartesian3(...stop.target))),
      blend(this.transition),
      new Cartesian3(),
    );
    this.setCamera(destination, this.target);
    if (c.progress === 1) {
      c.index = (c.index + 1) % baseStops.length;
      c.progress = 0;
      c.command++;
    }
    this.viewer.scene.requestRender();
  }

  dispose() {
    this.controls.playing = false;
    this.model.setHighlighted(null);
    this.viewer.scene.primitives.remove(this.labels);
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    Object.assign(
      this.viewer.scene.screenSpaceCameraController,
      this.originalControls,
    );
  }
}
