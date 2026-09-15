import {
  Cartesian3,
  Color,
  Matrix3,
  Matrix4,
  Model,
  PolylineCollection,
  Material,
  ShadowMode,
  Transforms,
  Viewer,
} from "cesium";
import { useRover } from "../stores/rover";
import { ROVER_ROUTE_LENGTH, roverRoute } from "./roverRoute";

export class RoverNavigation {
  private model?: Model;
  private route: PolylineCollection;
  private disposed = false;
  private lastView = "";
  private lastRestart = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private controls = useRover();
  constructor(
    private viewer: Viewer,
    private world: (local: Cartesian3) => Cartesian3,
  ) {
    this.controls.distance = 0;
    this.controls.playing = true;
    this.controls.status = "正在加载月球车模型…";
    this.lastRestart = this.controls.restart;
    this.route = viewer.scene.primitives.add(new PolylineCollection());
    this.route.add({
      positions: Array.from({ length: 257 }, (_, i) => {
        const p = roverRoute((i / 256) * ROVER_ROUTE_LENGTH);
        return world(new Cartesian3(p.x, p.y, 0.12));
      }),
      width: 2,
      material: Material.fromType("Color", {
        color: Color.fromCssColorString("#d6b675"),
      }),
    });
    void this.load();
  }
  private async load() {
    try {
      const model = await Model.fromGltfAsync({
        url: "/月球车_写实贴图.glb",
        scale: 0.005,
        shadows: ShadowMode.CAST_ONLY,
      });
      if (this.disposed) {
        model.destroy();
        return;
      }
      this.model = this.viewer.scene.primitives.add(model);
      model.readyEvent.addEventListener(() => {
        this.controls.status = "月球车已就绪";
      });
      model.errorEvent.addEventListener((error) => {
        this.controls.status = `月球车加载失败：${error.message}`;
        this.controls.playing = false;
      });
      this.viewer.scene.requestRender();
    } catch (error) {
      if (!this.disposed) {
        this.controls.status = `月球车加载失败：${String(error)}`;
        this.controls.playing = false;
      }
    }
  }
  tick(dt: number, keys: ReadonlySet<string>) {
    const c = this.controls;
    if (c.view !== this.lastView) {
      this.lookYaw = 0;
      this.lookPitch = 0;
    }
    if (c.view !== "free") {
      const right =
        Number(keys.has("ArrowRight") || keys.has("KeyD")) -
        Number(keys.has("ArrowLeft") || keys.has("KeyA"));
      const up =
        Number(keys.has("ArrowUp") || keys.has("KeyW")) -
        Number(keys.has("ArrowDown") || keys.has("KeyS"));
      this.lookYaw += right * dt;
      this.lookPitch = Math.max(-0.9, Math.min(0.9, this.lookPitch + up * dt));
    }
    if (c.restart !== this.lastRestart) {
      c.distance = 0;
      this.lastRestart = c.restart;
    }
    if (this.model?.ready && c.playing)
      c.distance = (c.distance + c.speed * dt) % ROVER_ROUTE_LENGTH;
    const p = roverRoute(c.distance);
    const position = this.world(new Cartesian3(p.x, p.y, 0.03));
    const frame = Transforms.eastNorthUpToFixedFrame(
      position,
      this.viewer.scene.globe.ellipsoid,
    );
    const vehicle = Matrix4.multiply(
      frame,
      Matrix4.fromRotationTranslation(Matrix3.fromRotationZ(-p.heading)),
      new Matrix4(),
    );
    if (this.model) {
      this.model.modelMatrix = vehicle;
      this.model.show = c.view !== "first" || !this.model.ready;
    }
    const camera = this.viewer.camera;
    this.viewer.scene.screenSpaceCameraController.enableInputs =
      c.view === "free";
    if (c.view === "free") {
      const offset =
        this.lastView === "free"
          ? Cartesian3.clone(camera.position)
          : new Cartesian3(12, -18, 10);
      camera.lookAtTransform(frame, offset);
    } else if (c.view === "follow") {
      camera.lookAtTransform(vehicle, new Cartesian3(0, -12, 6));
    } else {
      camera.lookAtTransform(Matrix4.IDENTITY);
      camera.setView({
        destination: Matrix4.multiplyByPoint(
          vehicle,
          new Cartesian3(0, 2.7, 2.2),
          new Cartesian3(),
        ),
        orientation: {
          direction: Matrix4.multiplyByPointAsVector(
            vehicle,
            new Cartesian3(0, 1, -0.08),
            new Cartesian3(),
          ),
          up: Matrix4.multiplyByPointAsVector(
            vehicle,
            Cartesian3.UNIT_Z,
            new Cartesian3(),
          ),
        },
      });
    }
    // Reapply look offsets after the vehicle-relative camera pose each frame.
    if (c.view !== "free") {
      camera.lookRight(this.lookYaw);
      camera.lookUp(this.lookPitch);
    }
    this.lastView = c.view;
    this.viewer.scene.requestRender();
  }
  dispose() {
    this.disposed = true;
    if (this.model) this.viewer.scene.primitives.remove(this.model);
    this.viewer.scene.primitives.remove(this.route);
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  }
}
