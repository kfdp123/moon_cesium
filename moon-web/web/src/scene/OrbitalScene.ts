import {
  Cartesian2,
  Cartesian3,
  Clock,
  ClockViewModel,
  Color,
  DirectionalLight,
  EllipsoidGeometry,
  GeometryInstance,
  HeadingPitchRange,
  JulianDate,
  LabelCollection,
  Material,
  MaterialAppearance,
  Matrix3,
  Matrix4,
  PolylineCollection,
  Primitive,
  Transforms,
  Viewer,
} from "cesium";
import { SURFACE_TEXTURE_URL } from "../data/moon";
import { lunarEphemeris } from "./lunarEphemeris";
import { sunTextureFragment } from "./sunAppearance";

/** Earth-centered inertial overview; no globe or global transform overrides. */
export class OrbitalScene {
  private viewer: Viewer;
  private clockModel: ClockViewModel;
  private earth: Primitive;
  private moon: Primitive;
  private labels: LabelCollection;
  private lines: PolylineCollection;
  private removeTick: () => void;
  private trueScale = false;
  private lastTime: JulianDate | undefined;
  private pathDate: JulianDate | undefined;
  constructor(
    container: HTMLElement,
    clock: Clock,
    reportError: (message: string) => void,
  ) {
    this.clockModel = new ClockViewModel(clock);
    this.viewer = new Viewer(container, {
      clockViewModel: this.clockModel,
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
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    });
    this.viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
    this.viewer.scene.backgroundColor = Color.fromCssColorString("#080f19");
    this.viewer.scene.light = new DirectionalLight({
      direction: new Cartesian3(-1, 0, 0),
      intensity: 2,
    });
    this.viewer.scene.renderError.addEventListener((_scene, cause) =>
      reportError(String(cause)),
    );
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4e9;
    this.earth = this.sphere(
      6378137,
      Material.fromType("Color", {
        color: Color.fromCssColorString("#397cad"),
      }),
    );
    this.moon = this.sphere(
      1737400,
      Material.fromType("Image", { image: SURFACE_TEXTURE_URL }),
    );
    this.labels = this.viewer.scene.primitives.add(new LabelCollection());
    for (const text of ["地球（示意）", "月球", "太阳方向", "0° 经线参考点"])
      this.labels.add({
        text,
        position: Cartesian3.ZERO,
        font: "16px sans-serif",
        fillColor: Color.WHITE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString("#101e2abb"),
        pixelOffset: new Cartesian2(0, -16),
      });
    this.lines = this.viewer.scene.primitives.add(new PolylineCollection());
    this.lines.add({
      positions: [],
      width: 2,
      material: Material.fromType("Color", {
        color: Color.fromCssColorString("#658eae"),
      }),
    });
    this.lines.add({
      positions: [],
      width: 3,
      material: Material.fromType("PolylineArrow", { color: Color.GOLD }),
    });
    this.removeTick = this.viewer.scene.preUpdate.addEventListener(() =>
      this.update(),
    );
    this.configure(false, true);
    this.reset();
  }
  private sphere(radius: number, material: Material) {
    return this.viewer.scene.primitives.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: EllipsoidGeometry.createGeometry(
            new EllipsoidGeometry({
              radii: new Cartesian3(radius, radius, radius),
              vertexFormat:
                MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
              stackPartitions: 64,
              slicePartitions: 64,
            }),
          )!,
        }),
        appearance: new MaterialAppearance({ material, closed: true }),
        asynchronous: false,
      }),
    );
  }
  configure(trueScale: boolean, lighting: boolean) {
    const scaleChanged = this.trueScale !== trueScale;
    this.trueScale = trueScale;
    for (const body of [this.earth, this.moon])
      body.appearance = new MaterialAppearance({
        material: (body.appearance as MaterialAppearance).material,
        closed: true,
        flat: !lighting,
        fragmentShaderSource: lighting ? sunTextureFragment : undefined,
      });
    this.pathDate = undefined;
    if (scaleChanged) this.reset();
    this.update(true);
  }
  private update(force = false) {
    const time = this.viewer.clock.currentTime;
    if (!force && this.lastTime && JulianDate.equals(time, this.lastTime))
      return;
    const state = lunarEphemeris(time);
    const distanceScale = this.trueScale ? 1 : 1 / 8;
    const moonPosition = Cartesian3.multiplyByScalar(
      state.moon,
      distanceScale,
      new Cartesian3(),
    );
    const moonScale = this.trueScale ? 1 : 3;
    this.moon.modelMatrix = Matrix4.multiplyByUniformScale(
      Matrix4.fromRotationTranslation(state.moonToInertial, moonPosition),
      moonScale,
      new Matrix4(),
    );
    // Earth orientation is only a visual reference, not an ITRF precision product.
    this.earth.modelMatrix = Matrix4.fromRotationTranslation(
      Matrix3.transpose(
        Transforms.computeTemeToPseudoFixedMatrix(time),
        new Matrix3(),
      ),
    );
    (this.viewer.scene.light as DirectionalLight).direction =
      Cartesian3.normalize(
        Cartesian3.negate(state.sun, new Cartesian3()),
        new Cartesian3(),
      );
    this.labels.get(0).position = new Cartesian3(0, 0, 7e6);
    this.labels.get(1).position = Cartesian3.add(
      moonPosition,
      new Cartesian3(0, 0, 1737400 * moonScale),
      new Cartesian3(),
    );
    const sunTip = Cartesian3.multiplyByScalar(
      Cartesian3.normalize(state.sun, new Cartesian3()),
      (this.trueScale ? 1 : 1 / 8) * 5.2e8,
      new Cartesian3(),
    );
    this.labels.get(2).position = sunTip;
    this.lines.get(1).positions = [
      Cartesian3.multiplyByScalar(sunTip, 0.78, new Cartesian3()),
      sunTip,
    ];
    this.labels.get(3).position = Cartesian3.add(
      moonPosition,
      Matrix3.multiplyByVector(
        state.moonToInertial,
        new Cartesian3(1737400 * moonScale * 1.03, 0, 0),
        new Cartesian3(),
      ),
      new Cartesian3(),
    );
    if (
      !this.pathDate ||
      Math.abs(JulianDate.daysDifference(time, this.pathDate)) > 7
    ) {
      this.lines.get(0).positions = Array.from({ length: 113 }, (_, i) =>
        Cartesian3.multiplyByScalar(
          lunarEphemeris(JulianDate.addDays(time, i / 4 - 14, new JulianDate()))
            .moon,
          distanceScale,
          new Cartesian3(),
        ),
      );
      this.pathDate = JulianDate.clone(time);
    }
    this.viewer.scene.requestRender();
    this.lastTime = JulianDate.clone(time);
  }
  reset() {
    this.viewer.camera.lookAt(
      Cartesian3.ZERO,
      new HeadingPitchRange(0, -0.75, this.trueScale ? 1.3e9 : 1.65e8),
    );
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.scene.requestRender();
  }
  zoom(direction: "in" | "out") {
    const amount = Cartesian3.magnitude(this.viewer.camera.positionWC) * 0.15;
    if (direction === "in") this.viewer.camera.zoomIn(amount);
    else this.viewer.camera.zoomOut(amount);
    this.viewer.scene.requestRender();
  }
  capture() {
    this.viewer.render();
    return this.viewer.canvas.toDataURL("image/png");
  }
  dispose() {
    this.removeTick();
    this.viewer.destroy();
    this.clockModel.destroy();
  }
}
