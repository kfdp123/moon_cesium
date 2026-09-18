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
import { LunarBaseModel } from "./LunarBaseModel";
import { BaseTourNavigation } from "./BaseTourNavigation";

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
  private base?: LunarBaseModel;
  private baseTour?: BaseTourNavigation;
  private returnView?: {
    destination: Cartesian3;
    orientation: { direction: Cartesian3; up: Cartesian3 };
  };
  private removeTick: () => void;
  private readonly focusCanvas = () => {
    if (this.mode !== "orbit")
      this.viewer.canvas.focus({ preventScroll: true });
  };
  private readonly keydown = (event: KeyboardEvent) => {
    if (this.mode === "orbit") return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "input, textarea, select, [contenteditable], [role=slider]",
      )
    )
      return;
    const onCanvas = document.activeElement === this.viewer.canvas;
    const roverControls =
      this.mode === "rover" && Boolean(target.closest(".rover-controls"));
    if (!onCanvas && !roverControls) return;
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
    window.addEventListener("keydown", this.keydown);
    viewer.canvas.addEventListener("pointerdown", this.focusCanvas);
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
    this.base = new LunarBaseModel(
      this.viewer,
      (local) => this.world(local),
      this.sunlight,
    );
    if (mode === "third-person") this.createAvatar();
    if (mode === "base-tour")
      this.baseTour = new BaseTourNavigation(
        this.viewer,
        (local) => this.world(local),
        this.base,
      );
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
    this.base?.setLighting(enabled);
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
  selectBase(id: string) {
    this.baseTour?.select(id);
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
  private createAvatar() {
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
      elapsed = Math.min(0.25, (now - this.lastTime) / 1000),
      dt = Math.min(0.05, elapsed);
    this.lastTime = now;
    if (this.baseTour) {
      this.baseTour.tick(elapsed);
      return;
    }
    if (this.rover) {
      this.rover.tick(dt, this.keys);
      return;
    }
    let eye: Cartesian3, direction: Cartesian3;
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
    const right = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
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
    if (!this.base?.contains(next.x, next.y)) this.position = next;
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
    this.baseTour?.dispose();
    this.baseTour = undefined;
    this.base?.dispose();
    this.base = undefined;
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
    window.removeEventListener("keydown", this.keydown);
    this.viewer.canvas.removeEventListener("pointerdown", this.focusCanvas);
    this.viewer.canvas.removeEventListener("blur", this.blur);
    window.removeEventListener("keyup", this.keyup);
    window.removeEventListener("blur", this.blur);
  }
}
