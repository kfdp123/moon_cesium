import {
  Cartesian3,
  BoxGeometry,
  GeometryInstance,
  ColorGeometryInstanceAttribute,
  Primitive,
  PrimitiveCollection,
  PerInstanceColorAppearance,
  Color,
  Matrix4,
  Transforms,
  Viewer,
  Math as CesiumMath,
  ShadowMode,
} from "cesium";
import type { NavigationMode } from "../types";
import { terrainHeightAt } from "./lunarTerrain";
import { regolithMaterial } from "./regolithMaterial";
import { sunColorFragment } from "./sunAppearance";
import { RoverNavigation } from "./RoverNavigation";

/** Walk on the lunar globe. Only the base and astronaut are schematic geometry. */
export class SurfaceNavigation {
  private mode: NavigationMode = "orbit";
  private frame = Matrix4.clone(Matrix4.IDENTITY);
  private readonly models = new PrimitiveCollection();
  private avatar: { primitive: Primitive; offset: Cartesian3 }[] = [];
  private keys = new Set<string>();
  private position = new Cartesian3(90, -160, 0);
  private heading = 0;
  private pitch = 0;
  private lastTime = performance.now();
  private originalNear = 1;
  private sunlight = false;
  private rover?: RoverNavigation;
  private returnView?: {
    destination: Cartesian3;
    orientation: { direction: Cartesian3; up: Cartesian3 };
  };
  private removeTick: () => void;
  private readonly keydown = (event: KeyboardEvent) => {
    if (this.mode === "orbit" || document.activeElement !== this.viewer.canvas)
      return;
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "ShiftLeft",
      ].includes(event.code)
    ) {
      event.preventDefault();
      this.keys.add(event.code);
    }
  };
  private readonly keyup = (event: KeyboardEvent) =>
    this.keys.delete(event.code);
  private readonly blur = () => this.keys.clear();

  constructor(private viewer: Viewer) {
    this.originalNear = viewer.camera.frustum.near;
    viewer.canvas.tabIndex = 0;
    viewer.scene.primitives.add(this.models);
    viewer.canvas.addEventListener("keydown", this.keydown);
    window.addEventListener("keyup", this.keyup);
    window.addEventListener("blur", this.blur);
    viewer.canvas.addEventListener("blur", this.blur);
    this.removeTick = viewer.scene.preUpdate.addEventListener(() =>
      this.tick(),
    );
  }

  setMode(mode: NavigationMode) {
    const camera = this.viewer.camera;
    if (this.mode === "orbit" && mode !== "orbit") {
      this.returnView = {
        destination: Cartesian3.clone(camera.positionWC),
        orientation: {
          direction: Cartesian3.clone(camera.directionWC),
          up: Cartesian3.clone(camera.upWC),
        },
      };
    }
    this.clear();
    this.mode = "orbit";
    camera.cancelFlight();
    this.viewer.scene.screenSpaceCameraController.enableInputs =
      mode === "orbit";
    if (mode === "orbit") {
      camera.frustum.near = this.originalNear;
      this.viewer.scene.globe.material = undefined;
      if (this.returnView) {
        camera.setView(this.returnView);
        this.returnView = undefined;
        this.viewer.scene.requestRender();
      }
      return;
    }
    camera.frustum.near = 0.1;
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    this.mode = mode;
    this.frame = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromDegrees(-20, 10, 0, ellipsoid),
      ellipsoid,
    );
    this.position = new Cartesian3(90, -160, 0);
    this.viewer.scene.globe.material = regolithMaterial(this.frame);
    this.heading = -0.48;
    this.pitch = 0.02;
    this.createBase();
    if (mode === "rover")
      this.rover = new RoverNavigation(this.viewer, (local) =>
        this.world(local),
      );
    this.lastTime = performance.now();
    this.viewer.canvas.focus();
    this.viewer.scene.requestRender();
  }

  setLighting(enabled: boolean) {
    if (this.sunlight === enabled) return;
    this.sunlight = enabled;
    for (let i = 0; i < this.models.length; i++)
      this.models.get(i).appearance = new PerInstanceColorAppearance({
        translucent: false,
        closed: true,
        fragmentShaderSource: enabled ? sunColorFragment : undefined,
      });
  }
  inspectBase() {
    this.position = new Cartesian3(-45, -65, 0);
    this.heading = 0.5;
    this.pitch = -0.1;
  }
  private world(local: Cartesian3) {
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const flat = Matrix4.multiplyByPoint(
      this.frame,
      new Cartesian3(local.x, local.y, 0),
      new Cartesian3(),
    );
    const site = ellipsoid.cartesianToCartographic(flat);
    site.height =
      terrainHeightAt(
        this.viewer.terrainProvider,
        CesiumMath.toDegrees(site.longitude),
        CesiumMath.toDegrees(site.latitude),
      ) + local.z;
    return ellipsoid.cartographicToCartesian(site);
  }
  private modelFrame(local: Cartesian3) {
    return Transforms.eastNorthUpToFixedFrame(
      this.world(local),
      this.viewer.scene.globe.ellipsoid,
    );
  }
  private box(local: Cartesian3, size: Cartesian3, color: Color) {
    return this.models.add(
      new Primitive({
        shadows: ShadowMode.CAST_ONLY,
        geometryInstances: new GeometryInstance({
          geometry: BoxGeometry.createGeometry(
            BoxGeometry.fromDimensions({
              dimensions: size,
              vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
          )!,
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(color),
          },
        }),
        modelMatrix: this.modelFrame(local),
        appearance: new PerInstanceColorAppearance({
          translucent: false,
          closed: true,
          fragmentShaderSource: this.sunlight ? sunColorFragment : undefined,
        }),
        asynchronous: false,
        cull: false,
      }),
    );
  }
  private createBase() {
    for (const x of [-20, 20]) {
      this.box(
        new Cartesian3(x, 15, 5),
        new Cartesian3(18, 28, 10),
        Color.fromCssColorString("#c3cbd0"),
      );
      this.box(
        new Cartesian3(x, 0.8, 4.5),
        new Cartesian3(12, 0.5, 4),
        Color.fromCssColorString("#244354"),
      );
      this.box(
        new Cartesian3(x, 16, 10.4),
        new Cartesian3(19, 30, 0.8),
        Color.fromCssColorString("#e8a75a"),
      );
    }
    this.box(
      new Cartesian3(0, 15, 3),
      new Cartesian3(23, 6, 6),
      Color.fromCssColorString("#8999a1"),
    );
    for (const x of [-60, 60]) {
      this.box(new Cartesian3(x, 12, 2), new Cartesian3(1, 1, 4), Color.SILVER);
      this.box(
        new Cartesian3(x, 12, 4),
        new Cartesian3(20, 30, 0.3),
        Color.fromCssColorString("#214f75"),
      );
    }
    this.box(
      new Cartesian3(0, 45, 14),
      new Cartesian3(0.5, 0.5, 28),
      Color.SILVER,
    );
    const offsets = [
      new Cartesian3(0, 0, 1.05),
      new Cartesian3(0, 0, 1.8),
      new Cartesian3(-0.18, 0, 0.35),
      new Cartesian3(0.18, 0, 0.35),
      new Cartesian3(-0.43, 0, 1.1),
      new Cartesian3(0.43, 0, 1.1),
    ];
    const sizes = [
      new Cartesian3(0.65, 0.45, 0.85),
      new Cartesian3(0.55, 0.5, 0.55),
      new Cartesian3(0.22, 0.3, 0.65),
      new Cartesian3(0.22, 0.3, 0.65),
      new Cartesian3(0.18, 0.25, 0.7),
      new Cartesian3(0.18, 0.25, 0.7),
    ];
    offsets.forEach((offset, i) => {
      const primitive = this.box(
        Cartesian3.add(this.position, offset, new Cartesian3()),
        sizes[i],
        i === 1 ? Color.GOLD : Color.WHITESMOKE,
      );
      primitive.show = this.mode === "third-person";
      this.avatar.push({ primitive, offset });
    });
  }

  private tick() {
    if (this.mode === "orbit") return;
    const now = performance.now(),
      dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.rover) {
      this.rover.tick(dt, this.keys);
      return;
    }
    let eye: Cartesian3, direction: Cartesian3;
    if (this.mode === "base-tour") {
      this.heading += dt * 0.15;
      eye = new Cartesian3(
        Math.sin(this.heading) * 180,
        Math.cos(this.heading) * 180,
        45,
      );
      direction = Cartesian3.normalize(
        Cartesian3.subtract(new Cartesian3(0, 15, 5), eye, new Cartesian3()),
        new Cartesian3(),
      );
    } else {
      this.heading +=
        ((this.keys.has("ArrowRight") ? 1 : 0) -
          (this.keys.has("ArrowLeft") ? 1 : 0)) *
        dt;
      this.pitch = Math.max(
        -1.1,
        Math.min(
          1.1,
          this.pitch +
            ((this.keys.has("ArrowUp") ? 1 : 0) -
              (this.keys.has("ArrowDown") ? 1 : 0)) *
              dt,
        ),
      );
      const forward =
        Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
      const right =
        Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
      const speed = (this.keys.has("ShiftLeft") ? 9 : 3) * dt;
      const next = new Cartesian3(
        this.position.x +
          (Math.sin(this.heading) * forward + Math.cos(this.heading) * right) *
            speed,
        this.position.y +
          (Math.cos(this.heading) * forward - Math.sin(this.heading) * right) *
            speed,
        0,
      );
      const hitsHabitat = next.y > -0.5 && next.y < 31 && Math.abs(next.x) < 31;
      if (!hitsHabitat) this.position = next;
      const third = this.mode === "third-person";
      eye = new Cartesian3(
        this.position.x - (third ? Math.sin(this.heading) * 8 : 0),
        this.position.y - (third ? Math.cos(this.heading) * 8 : 0),
        third ? 3.2 : 1.8,
      );
      const pitch = third ? this.pitch - 0.16 : this.pitch;
      direction = new Cartesian3(
        Math.sin(this.heading) * Math.cos(pitch),
        Math.cos(this.heading) * Math.cos(pitch),
        Math.sin(pitch),
      );
      for (const { primitive, offset } of this.avatar)
        primitive.modelMatrix = this.modelFrame(
          Cartesian3.add(this.position, offset, new Cartesian3()),
        );
    }
    const up = new Cartesian3(
      -direction.x * direction.z,
      -direction.y * direction.z,
      direction.x ** 2 + direction.y ** 2,
    );
    this.viewer.camera.setView({
      destination: this.world(eye),
      orientation: {
        direction: Matrix4.multiplyByPointAsVector(
          this.frame,
          direction,
          new Cartesian3(),
        ),
        up: Cartesian3.normalize(
          Matrix4.multiplyByPointAsVector(this.frame, up, new Cartesian3()),
          new Cartesian3(),
        ),
      },
    });
    this.viewer.scene.requestRender();
  }
  private clear() {
    this.rover?.dispose();
    this.rover = undefined;
    this.keys.clear();
    this.models.removeAll();
    this.avatar = [];
  }
  dispose() {
    this.clear();
    this.viewer.scene.primitives.remove(this.models);
    this.removeTick();
    this.viewer.canvas.removeEventListener("keydown", this.keydown);
    this.viewer.canvas.removeEventListener("blur", this.blur);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.blur);
  }
}
