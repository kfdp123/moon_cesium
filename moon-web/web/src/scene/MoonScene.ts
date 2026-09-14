import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
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
  Math as CesiumMath,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  ScreenSpaceEventType,
  SingleTileImageryProvider,
  Viewer,
  HeadingPitchRange,
  VerticalOrigin,
} from "cesium";
import {
  MOON_RADIUS_M,
  MOON_RADIUS_KM,
  SURFACE_TEXTURE_URL,
  landmarks,
} from "../data/moon";
import type { SceneSelection, SceneState } from "../types";
import { buildShell, type ShellMesh } from "./shellGeometry";

function geometry(mesh: ShellMesh): Geometry {
  const positions = new Float64Array(
    mesh.positions.map((value) => value * MOON_RADIUS_M),
  );
  const attributes = new GeometryAttributes();
  attributes.position = new GeometryAttribute({
    componentDatatype: ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: positions,
  });
  attributes.normal = new GeometryAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: new Float32Array(mesh.normals),
  });
  return new Geometry({
    attributes,
    indices: new Uint32Array(mesh.indices),
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: new BoundingSphere(Cartesian3.ZERO, MOON_RADIUS_M),
  });
}

export class MoonScene {
  private readonly viewer: Viewer;
  private readonly interior = new PrimitiveCollection();
  private readonly layerPrimitives = new Map<string, Primitive[]>();
  private geometryKey = "";
  private mode: SceneState["mode"] = "surface";
  private readonly gridEntities: ReturnType<Viewer["entities"]["add"]>[] = [];
  private readonly landmarkEntities: ReturnType<Viewer["entities"]["add"]>[] =
    [];

  constructor(
    container: HTMLElement,
    onSelection: (selection: SceneSelection) => void,
  ) {
    Ellipsoid.default = Ellipsoid.MOON;
    this.viewer = new Viewer(container, {
      globe: new Globe(Ellipsoid.MOON),
      terrainProvider: new EllipsoidTerrainProvider({
        ellipsoid: Ellipsoid.MOON,
      }),
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
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
    scene.backgroundColor = Color.TRANSPARENT;
    scene.sun!.show = false;
    scene.moon!.show = false;
    scene.globe.baseColor = Color.fromCssColorString("#666870");
    scene.globe.enableLighting = true;
    scene.globe.showGroundAtmosphere = false;
    scene.light = new DirectionalLight({
      direction: new Cartesian3(-1, -0.5, -0.35),
      intensity: 1.8,
    });
    scene.primitives.add(this.interior);
    scene.screenSpaceCameraController.minimumZoomDistance =
      MOON_RADIUS_M * 0.12;
    scene.screenSpaceCameraController.maximumZoomDistance = MOON_RADIUS_M * 12;
    this.viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
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
          onSelection({
            kind: "layer",
            id: id.slice(6) as NonNullable<SceneState["selectedLayer"]>,
          });
        else if (id.startsWith("landmark:"))
          onSelection({ kind: "landmark", id: id.slice(9) });
        else onSelection(null);
      },
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.addOverlays();
    this.resetCamera(false);
  }

  async loadSurface() {
    const provider = await SingleTileImageryProvider.fromUrl(
      SURFACE_TEXTURE_URL,
      { ellipsoid: Ellipsoid.MOON },
    );
    if (this.viewer.isDestroyed()) return;
    this.viewer.imageryLayers.addImageryProvider(provider);
    this.viewer.scene.requestRender();
  }

  applyState(state: SceneState) {
    const geometryKey = JSON.stringify([state.cutaway, state.layers]);
    if (geometryKey !== this.geometryKey && state.mode === "interior") {
      this.buildInterior(state);
      this.geometryKey = geometryKey;
    }
    this.viewer.scene.globe.show = state.mode === "surface";
    this.interior.show = state.mode === "interior";
    this.gridEntities.forEach((entity) => {
      entity.show = state.showGrid && state.mode === "surface";
    });
    this.landmarkEntities.forEach((entity) => {
      entity.show = state.showLandmarks && state.mode === "surface";
    });
    for (const layer of state.layers) {
      for (const primitive of this.layerPrimitives.get(layer.id) ?? [])
        primitive.show = !state.hiddenLayers.includes(layer.id);
    }
    if (state.mode !== this.mode) {
      this.mode = state.mode;
      this.resetCamera(true);
    }
    this.viewer.scene.requestRender();
  }

  resetCamera(animate = true) {
    const heading =
      this.mode === "interior"
        ? CesiumMath.toRadians(135)
        : CesiumMath.toRadians(95);
    this.viewer.camera.flyToBoundingSphere(
      new BoundingSphere(Cartesian3.ZERO, MOON_RADIUS_M),
      {
        duration: animate ? 0.9 : 0,
        offset: new HeadingPitchRange(
          heading,
          CesiumMath.toRadians(-18),
          MOON_RADIUS_M * 3.7,
        ),
      },
    );
  }

  flyToLandmark(id: string) {
    const landmark = landmarks.find((item) => item.id === id)!;
    this.viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        landmark.longitude,
        landmark.latitude,
        MOON_RADIUS_M * 1.2,
        Ellipsoid.MOON,
      ),
      duration: 1.2,
    });
  }

  zoom(direction: "in" | "out") {
    const distance = Cartesian3.magnitude(this.viewer.camera.position) * 0.13;
    if (direction === "in") this.viewer.camera.zoomIn(distance);
    else this.viewer.camera.zoomOut(distance);
    this.viewer.scene.requestRender();
  }

  capture(): string {
    this.viewer.render();
    return this.viewer.canvas.toDataURL("image/png");
  }

  dispose() {
    this.viewer.destroy();
  }

  private buildInterior(state: SceneState) {
    this.interior.removeAll();
    this.layerPrimitives.clear();
    for (const layer of state.layers) {
      const primitives = buildShell(
        layer.innerRadiusKm / MOON_RADIUS_KM,
        layer.outerRadiusKm / MOON_RADIUS_KM,
        state.cutaway,
      ).map((mesh) => {
        const color = Color.fromCssColorString(layer.color);
        if (mesh.surface === "cap") Color.lerp(color, Color.WHITE, 0.12, color);
        return this.interior.add(
          new Primitive({
            geometryInstances: new GeometryInstance({
              id: `layer:${layer.id}`,
              geometry: geometry(mesh),
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
          }),
        );
      });
      this.layerPrimitives.set(layer.id, primitives);
    }
  }

  private addOverlays() {
    for (let longitude = -180; longitude < 180; longitude += 30) {
      const positions = Array.from({ length: 91 }, (_, index) =>
        Cartesian3.fromDegrees(
          longitude,
          -90 + index * 2,
          1500,
          Ellipsoid.MOON,
        ),
      );
      this.gridEntities.push(
        this.viewer.entities.add({
          polyline: {
            positions,
            width: 1,
            material: Color.fromCssColorString("#8fbdca").withAlpha(0.25),
          },
          show: false,
        }),
      );
    }
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const positions = Array.from({ length: 181 }, (_, index) =>
        Cartesian3.fromDegrees(
          -180 + index * 2,
          latitude,
          1500,
          Ellipsoid.MOON,
        ),
      );
      this.gridEntities.push(
        this.viewer.entities.add({
          polyline: {
            positions,
            width: 1,
            material: Color.fromCssColorString("#8fbdca").withAlpha(0.25),
          },
          show: false,
        }),
      );
    }
    for (const landmark of landmarks) {
      this.landmarkEntities.push(
        this.viewer.entities.add({
          id: `landmark:${landmark.id}`,
          position: Cartesian3.fromDegrees(
            landmark.longitude,
            landmark.latitude,
            5000,
            Ellipsoid.MOON,
          ),
          point: {
            pixelSize: 6,
            color: Color.fromCssColorString("#bdd9d4"),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
          },
          label: {
            text: landmark.name,
            font: "13px sans-serif",
            fillColor: Color.fromCssColorString("#d9e6e4"),
            verticalOrigin: VerticalOrigin.BOTTOM,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cartesian2(0, -12),
          },
        }),
      );
    }
  }
}
