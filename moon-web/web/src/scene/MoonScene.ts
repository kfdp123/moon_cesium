import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  ClippingPlane,
  ClippingPlaneCollection,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  DirectionalLight,
  Ellipsoid,
  EllipsoidTerrainProvider,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  Globe,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  ScreenSpaceEventType,
  Viewer,
  VerticalOrigin,
  DistanceDisplayCondition,
  Clock,
  ClockViewModel,
} from "cesium";
import { MOON_RADIUS_M } from "../data/moon";
import type {
  MapLayer,
  NavigationMode,
  SceneSelection,
  SceneState,
} from "../types";
import { buildShell, type ShellMesh } from "./shellGeometry";
import { MapLayers } from "./MapLayers";
import { SurfaceNavigation } from "./SurfaceNavigation";
import { LunarLighting, type LightingOptions } from "./LunarLighting";

function geometry(mesh: ShellMesh): Geometry {
  const attributes = new GeometryAttributes();
  Object.assign(attributes, {
    position: new GeometryAttribute({
      componentDatatype: ComponentDatatype.DOUBLE,
      componentsPerAttribute: 3,
      values: new Float64Array(mesh.positions),
    }),
    normal: new GeometryAttribute({
      componentDatatype: ComponentDatatype.FLOAT,
      componentsPerAttribute: 3,
      values: new Float32Array(mesh.normals),
    }),
  });
  return new Geometry({
    attributes,
    indices: new Uint32Array(mesh.indices),
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(mesh.positions),
  });
}

export class MoonScene {
  private readonly viewer: Viewer;
  private readonly clockModel: ClockViewModel;
  private readonly lighting: LunarLighting;
  private readonly interior = new PrimitiveCollection();
  private readonly mapLayers: MapLayers;
  private readonly navigation: SurfaceNavigation;
  private radius = MOON_RADIUS_M;
  private geometryKey = "";
  private overlaysKey = "";
  private state?: SceneState;
  private navigationMode: NavigationMode = "orbit";
  private maps: MapLayer[] = [];
  private readonly layerPrimitives = new Map<string, Primitive[]>();
  private readonly overlayIds: string[] = [];

  constructor(
    container: HTMLElement,
    onSelection: (selection: SceneSelection) => void,
    reportLayer: (id: string, status: string) => void,
    reportError: (message: string) => void,
    clock: Clock,
  ) {
    Ellipsoid.default = Ellipsoid.MOON;
    this.clockModel = new ClockViewModel(clock);
    this.viewer = new Viewer(container, {
      clockViewModel: this.clockModel,
      globe: new Globe(Ellipsoid.MOON),
      terrainProvider: new EllipsoidTerrainProvider({
        ellipsoid: Ellipsoid.MOON,
      }),
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
    const { scene } = this.viewer;
    scene.backgroundColor = Color.fromCssColorString("#090e15");
    scene.light = new DirectionalLight({
      direction: new Cartesian3(-1, -0.5, -0.35),
      intensity: 1.8,
    });
    scene.primitives.add(this.interior);
    scene.renderError.addEventListener((_scene, cause) =>
      reportError(String(cause)),
    );
    this.configureGlobe();
    this.viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
    this.mapLayers = new MapLayers(this.viewer, reportLayer);
    this.navigation = new SurfaceNavigation(this.viewer);
    this.lighting = new LunarLighting(this.viewer);
    this.viewer.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    this.viewer.screenSpaceEventHandler.setInputAction(
      ({ position }: { position: Cartesian2 }) => {
        const hit = scene.pick(position);
        const id: unknown = hit?.id?.id ?? hit?.id;
        if (typeof id !== "string") {
          onSelection(null);
          return;
        }
        if (id.startsWith("layer:"))
          onSelection({ kind: "layer", id: id.slice(6) });
        else if (id.startsWith("landmark:"))
          onSelection({ kind: "landmark", id: id.slice(9) });
        else onSelection(null);
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.resetCamera(false);
  }

  private configureGlobe() {
    const { scene } = this.viewer;
    scene.globe.baseColor = Color.fromCssColorString("#767982");
    scene.globe.enableLighting = false;
    scene.globe.showGroundAtmosphere = false;
    // Use the clipped surface depth; Cesium's default whole-ellipsoid depth plane hides cutaways.
    scene.globe.depthTestAgainstTerrain = true;
    scene.screenSpaceCameraController.minimumZoomDistance = 2;
    scene.screenSpaceCameraController.maximumZoomDistance = this.radius * 12;
  }

  async applyMaps(layers: MapLayer[], force = false) {
    this.maps = layers;
    await this.mapLayers.apply(layers, force);
  }

  applyState(state: SceneState) {
    const radiusChanged = this.radius !== state.radiusKm * 1000;
    this.state = state;
    if (radiusChanged) {
      this.navigation.setMode("orbit");
      this.radius = state.radiusKm * 1000;
      this.viewer.scene.globe = new Globe(
        new Ellipsoid(this.radius, this.radius, this.radius),
      );
      this.configureGlobe();
      void this.applyMaps(this.maps, true);
      this.resetCamera(false);
    }
    const key = JSON.stringify([state.cutaway, state.layers]);
    if (key !== this.geometryKey) {
      this.buildInterior(state);
      const planes =
        state.cutaway === "full"
          ? []
          : [new ClippingPlane(new Cartesian3(-1, 0, 0), 0)];
      if (state.cutaway === "quarter")
        planes.push(new ClippingPlane(new Cartesian3(0, -1, 0), 0));
      this.viewer.scene.globe.clippingPlanes = new ClippingPlaneCollection({
        planes,
        unionClippingRegions: false,
      });
      this.geometryKey = key;
    }
    this.viewer.scene.globe.show = !state.hiddenLayers.includes(
      state.layers[0].id,
    );
    for (const [id, primitives] of this.layerPrimitives) {
      for (const primitive of primitives)
        primitive.show = !state.hiddenLayers.includes(id);
    }
    const overlaysKey = JSON.stringify([
      state.radiusKm,
      state.cutaway,
      state.showGrid,
      state.showLandmarks,
      state.points,
      state.hiddenLayers,
    ]);
    if (overlaysKey !== this.overlaysKey) {
      this.addOverlays(state);
      this.overlaysKey = overlaysKey;
    }
    this.viewer.scene.requestRender();
  }

  resetCamera(animate = true) {
    if (this.lighting) this.lighting.roaming = false;
    this.navigation?.setMode("orbit");
    const longitude = this.state?.cutaway === "full" ? 0 : 35;
    const destination = Cartesian3.fromDegrees(
      longitude,
      18,
      this.radius * 2.7,
      new Ellipsoid(this.radius, this.radius, this.radius),
    );
    const direction = Cartesian3.normalize(
      Cartesian3.negate(destination, new Cartesian3()),
      new Cartesian3(),
    );
    const right = Cartesian3.normalize(
      Cartesian3.cross(direction, Cartesian3.UNIT_Z, new Cartesian3()),
      new Cartesian3(),
    );
    const up = Cartesian3.cross(right, direction, new Cartesian3());
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.viewer.camera.flyTo({
      destination,
      orientation: { direction, up },
      duration: animate ? 0.7 : 0,
    });
  }
  flyToLandmark(id: string) {
    const landmark = this.state?.points.find((item) => item.id === id);
    if (!landmark) return;
    this.navigation.setMode("orbit");
    this.viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        landmark.longitude,
        landmark.latitude,
        this.radius * 0.65,
        this.viewer.scene.globe.ellipsoid,
      ),
      duration: 1.2,
    });
  }
  setNavigation(mode: NavigationMode) {
    this.lighting.roaming = mode !== "orbit";
    this.navigationMode = mode;
    for (const id of this.overlayIds)
      this.viewer.entities.getById(id)!.show = mode === "orbit";
    this.navigation.setMode(mode);
  }
  zoom(direction: "in" | "out") {
    const distance = Math.max(
      10,
      (Cartesian3.magnitude(this.viewer.camera.position) - this.radius) * 0.2,
    );
    if (direction === "in") this.viewer.camera.zoomIn(distance);
    else this.viewer.camera.zoomOut(distance);
    this.viewer.scene.requestRender();
  }
  capture() {
    this.viewer.render();
    return this.viewer.canvas.toDataURL("image/png");
  }
  setLighting(options: LightingOptions) {
    this.lighting.configure(options);
    this.navigation.setLighting(options.lighting);
  }
  inspectBase() {
    this.navigation.inspectBase();
  }
  dispose() {
    this.lighting.dispose();
    this.navigation.dispose();
    this.mapLayers.dispose();
    this.viewer.destroy();
    this.clockModel.destroy();
  }

  private buildInterior(state: SceneState) {
    this.interior.removeAll();
    this.layerPrimitives.clear();
    for (const [index, layer] of state.layers.entries()) {
      // Keep mesh calculations normalized to avoid degenerate triangles at poles.
      const meshes = buildShell(
        layer.innerRadiusKm / state.radiusKm,
        layer.outerRadiusKm / state.radiusKm,
        state.cutaway,
        96,
        index !== 0,
      );
      const primitives = meshes
        .filter((mesh) => mesh.indices.length > 0)
        .map((mesh) => {
          const color = Color.fromCssColorString(layer.color);
          if (mesh.surface === "cap")
            Color.lerp(color, Color.WHITE, 0.12, color);
          const scaled = {
            ...mesh,
            positions: mesh.positions.map((value) => value * this.radius),
          };
          return this.interior.add(
            new Primitive({
              geometryInstances: new GeometryInstance({
                id: `layer:${layer.id}`,
                geometry: geometry(scaled),
                modelMatrix: Matrix4.IDENTITY,
                attributes: {
                  color: ColorGeometryInstanceAttribute.fromColor(color),
                },
              }),
              appearance: new PerInstanceColorAppearance({
                translucent: false,
                closed: true,
                flat: false,
              }),
              asynchronous: false,
              // These are interior objects: the globe's horizon occluder must not discard them.
              cull: false,
            }),
          );
        });
      this.layerPrimitives.set(layer.id, primitives);
    }
  }

  private retained(longitude: number, latitude: number) {
    const p = Cartesian3.fromDegrees(
      longitude,
      latitude,
      0,
      Ellipsoid.UNIT_SPHERE,
    );
    return (
      this.state!.cutaway === "full" ||
      (this.state!.cutaway === "half"
        ? p.x <= 1e-10
        : p.x <= 1e-10 || p.y <= 1e-10)
    );
  }
  private addOverlays(state: SceneState) {
    for (const id of this.overlayIds) this.viewer.entities.removeById(id);
    this.overlayIds.length = 0;
    const add = (options: Parameters<Viewer["entities"]["add"]>[0]) => {
      const entity = this.viewer.entities.add(options);
      entity.show = this.navigationMode === "orbit";
      this.overlayIds.push(entity.id);
    };
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    if (state.showGrid && state.cutaway === "full") {
      for (let longitude = -180; longitude < 180; longitude += 30) {
        add({
          polyline: {
            positions: Array.from({ length: 91 }, (_, i) =>
              Cartesian3.fromDegrees(longitude, -90 + i * 2, 12000, ellipsoid),
            ),
            width: 1,
            material: Color.CYAN.withAlpha(0.2),
          },
        });
      }
      for (let latitude = -60; latitude <= 60; latitude += 30) {
        add({
          polyline: {
            positions: Array.from({ length: 181 }, (_, i) =>
              Cartesian3.fromDegrees(-180 + i * 2, latitude, 12000, ellipsoid),
            ),
            width: 1,
            material: Color.CYAN.withAlpha(0.2),
          },
        });
      }
    }
    if (!state.showLandmarks || state.hiddenLayers.includes(state.layers[0].id))
      return;
    for (const place of state.points) {
      if (!place.visible || !this.retained(place.longitude, place.latitude))
        continue;
      add({
        id: `landmark:${place.id}`,
        position: Cartesian3.fromDegrees(
          place.longitude,
          place.latitude,
          12000,
          ellipsoid,
        ),
        point: {
          pixelSize: 7,
          color:
            place.category === "着陆点"
              ? Color.GOLD
              : Color.fromCssColorString("#b8dacf"),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: place.name,
          font: "16px sans-serif",
          fillColor: Color.WHITE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -12),
          distanceDisplayCondition: new DistanceDisplayCondition(
            0,
            this.radius * (place.category === "月海" ? 5 : 1.3),
          ),
        },
      });
    }
  }
}
