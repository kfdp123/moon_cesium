import {
  Cartesian2,
  Cartesian3,
  Clock,
  ClockViewModel,
  Color,
  DirectionalLight,
  DynamicAtmosphereLightingType,
  Ellipsoid,
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
  SkyAtmosphere,
  SkyBox,
  Credit,
  Viewer,
} from "cesium";
import { SURFACE_TEXTURE_URL } from "../data/moon";
import { lunarEphemeris } from "./lunarEphemeris";
import { sunTextureFragment } from "./sunAppearance";
import { earthMaterial, earthToInertial, EARTH_IMAGE_CREDIT } from "./earth";

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
  private followingMoon = false;
  private lastTime: JulianDate | undefined;
  private pathDate: JulianDate | undefined;
  constructor(
    container: HTMLElement,
    clock: Clock,
    reportError: (message: string) => void,
    earthImage: HTMLImageElement | ImageBitmap,
  ) {
    this.clockModel = new ClockViewModel(clock);
    this.viewer = new Viewer(container, {
      ellipsoid: Ellipsoid.WGS84,
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
      skyAtmosphere: new SkyAtmosphere(Ellipsoid.WGS84),
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      contextOptions: { webgl: { preserveDrawingBuffer: true } },
    });
    this.viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
    // Add only the star background; the app manages celestial bodies itself.
    this.viewer.scene.skyBox = SkyBox.createEarthSkyBox();
    this.viewer.scene.backgroundColor = Color.fromCssColorString("#080f19");
    this.viewer.scene.light = new DirectionalLight({
      direction: new Cartesian3(-1, 0, 0),
      intensity: 2,
    });
    this.viewer.scene.renderError.addEventListener((_scene, cause) =>
      reportError(String(cause)),
    );
    this.viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4e9;
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 7e6;
    this.viewer.creditDisplay.addStaticCredit(new Credit(EARTH_IMAGE_CREDIT));
    this.earth = this.sphere(Ellipsoid.WGS84.radii, earthMaterial(earthImage));
    this.moon = this.sphere(
      new Cartesian3(1737400, 1737400, 1737400),
      Material.fromType("Image", { image: SURFACE_TEXTURE_URL }),
    );
    this.labels = this.viewer.scene.primitives.add(new LabelCollection());
    for (const text of ["地球", "月球", "太阳方向", "0° 经线参考点"])
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
  private sphere(radii: Cartesian3, material: Material) {
    return this.viewer.scene.primitives.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: EllipsoidGeometry.createGeometry(
            new EllipsoidGeometry({
              radii,
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
  configure(trueScale: boolean, lighting: boolean, atmosphere = true) {
    const scaleChanged = this.trueScale !== trueScale;
    this.trueScale = trueScale;
    this.viewer.scene.skyAtmosphere!.show = atmosphere;
    this.viewer.scene.atmosphere.dynamicLighting = lighting
      ? DynamicAtmosphereLightingType.SCENE_LIGHT
      : DynamicAtmosphereLightingType.NONE;
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
    if (this.followingMoon) {
      // Translate with the Moon while retaining the user's orbit and zoom.
      const camera = this.viewer.camera;
      camera.lookAtTransform(
        Matrix4.fromTranslation(moonPosition),
        Cartesian3.clone(camera.position),
      );
    }
    this.earth.modelMatrix = Matrix4.fromRotationTranslation(
      earthToInertial(time),
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
    this.releaseFocus();
    this.viewer.camera.lookAt(
      Cartesian3.ZERO,
      new HeadingPitchRange(0, -0.75, this.trueScale ? 1.3e9 : 1.65e8),
    );
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.scene.requestRender();
  }
  focusEarth() {
    this.focusBody("earth");
  }
  focusMoon() {
    this.focusBody("moon");
  }
  private focusBody(body: "earth" | "moon") {
    this.releaseFocus();
    this.update(true);
    const isMoon = body === "moon";
    const radius = isMoon
      ? 1737400 * (this.trueScale ? 1 : 3)
      : Ellipsoid.WGS84.maximumRadius;
    const sun = lunarEphemeris(this.viewer.clock.currentTime).sun;
    // Approach from the lit side, with an oblique view of the day/night edge.
    const direction = Matrix3.multiplyByVector(
      Matrix3.fromRotationZ(0.45),
      Cartesian3.normalize(sun, new Cartesian3()),
      new Cartesian3(),
    );
    direction.z += 0.2;
    Cartesian3.normalize(direction, direction);
    const offset = Cartesian3.multiplyByScalar(
      direction,
      isMoon ? radius * 3.5 : 2.25e7,
      new Cartesian3(),
    );
    const center = isMoon
      ? Matrix4.getTranslation(this.moon.modelMatrix, new Cartesian3())
      : Cartesian3.ZERO;
    const look = Cartesian3.negate(direction, new Cartesian3());
    const right = Cartesian3.normalize(
      Cartesian3.cross(look, Cartesian3.UNIT_Z, new Cartesian3()),
      new Cartesian3(),
    );
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = isMoon
      ? radius * 1.15
      : 7e6;
    this.viewer.camera.flyTo({
      destination: Cartesian3.add(center, offset, new Cartesian3()),
      orientation: {
        direction: look,
        up: Cartesian3.cross(right, look, new Cartesian3()),
      },
      duration: 0.8,
      complete: () => {
        if (!isMoon) return;
        this.followingMoon = true;
        const currentCenter = Matrix4.getTranslation(
          this.moon.modelMatrix,
          new Cartesian3(),
        );
        this.viewer.camera.lookAtTransform(
          Matrix4.fromTranslation(currentCenter),
          offset,
        );
        this.viewer.scene.requestRender();
      },
    });
    this.viewer.scene.requestRender();
  }
  private releaseFocus() {
    this.followingMoon = false;
    this.viewer.camera.cancelFlight();
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.scene.screenSpaceCameraController.minimumZoomDistance = 7e6;
  }
  zoom(direction: "in" | "out") {
    const amount = Cartesian3.magnitude(this.viewer.camera.position) * 0.15;
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
