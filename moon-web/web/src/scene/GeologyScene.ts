import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ComponentDatatype,
  CylinderGeometry,
  DirectionalLight,
  EllipsoidGeometry,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  HeadingPitchRange,
  Material,
  MaterialAppearance,
  Matrix3,
  Matrix4,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  Quaternion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  VertexFormat,
  PointPrimitiveCollection,
} from "cesium";
import { geologyExhibits } from "../data/lunarGeology";
import {
  makeSlab,
  makeLavaFlow,
  plainSurface,
  shieldSurface,
  craterSurface,
  type HeightField,
  type RockMesh,
} from "./geologyGeometry";

interface PartPrimitive {
  id: string;
  primitive: Primitive;
  material: Material;
  color: Color;
  heat: number;
}
export type GeologyView = "oblique" | "top" | "section";
const ROCK_SHADER = `
float grain(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float rockNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(grain(i),grain(i+vec2(1,0)),f.x),mix(grain(i+vec2(0,1)),grain(i+vec2(1,1)),f.x),f.y);
}
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material m=czm_getDefaultMaterial(materialInput);
  vec2 st=materialInput.st*38.0;
  float coarse=rockNoise(st), fine=rockNoise(st*5.0);
  float bands=sin(materialInput.st.t*170.0+coarse*3.0)*0.045;
  float veins=smoothstep(0.52,0.78,rockNoise(st*0.23+vec2(time*0.06,0)));
  m.diffuse=baseColor.rgb*(0.74+coarse*0.18+fine*0.08+bands);
  m.emission=baseColor.rgb*heat*(0.20+veins*0.95);
  m.shininess=8.0;
  m.specular=0.035;
  m.alpha=1.0;
  return m;
}`;

/** 独立的局部展台，不使用经纬度，也不改动全局月球半径和时间轴。 */
export class GeologyScene {
  readonly viewer: Viewer;
  private parts: PartPrimitive[] = [];
  private solids: PrimitiveCollection;
  private particles: PointPrimitiveCollection;
  private handler: ScreenSpaceEventHandler;
  private stage = 0;
  private phase = 2;
  private running = false;
  private elapsed = 0;
  private lastTime = performance.now();
  private removeTick: () => void;

  constructor(
    container: HTMLElement,
    select: (id: string | null) => void,
    error: (message: string) => void,
  ) {
    this.viewer = new Viewer(container, {
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
    const scene = this.viewer.scene;
    scene.backgroundColor = Color.fromCssColorString("#0b1421");
    scene.light = new DirectionalLight({
      direction: new Cartesian3(-0.3, 0.45, -0.85),
      intensity: 1.65,
    });
    scene.highDynamicRange = false;
    const controls = scene.screenSpaceCameraController;
    controls.minimumZoomDistance = 8;
    controls.maximumZoomDistance = 60;
    controls.enableTranslate = false;
    controls.enableCollisionDetection = false;
    this.viewer.camera.frustum.near = 0.1;
    this.solids = scene.primitives.add(new PrimitiveCollection());
    this.particles = scene.primitives.add(new PointPrimitiveCollection());
    this.handler = new ScreenSpaceEventHandler(scene.canvas);
    this.handler.setInputAction((event: { position: Cartesian2 }) => {
      const hit = scene.pick(event.position);
      select(
        typeof hit?.id === "string" && hit.id.startsWith("geology:")
          ? hit.id.slice(8)
          : null,
      );
    }, ScreenSpaceEventType.LEFT_CLICK);
    scene.renderError.addEventListener((_scene, cause) => error(String(cause)));
    this.removeTick = scene.preUpdate.addEventListener(() => this.tick());
    this.reset();
  }

  private add(
    id: string,
    geometry: Geometry | CylinderGeometry | EllipsoidGeometry,
    color: string,
    heat = 0,
    matrix = Matrix4.IDENTITY,
  ) {
    const baseColor = Color.fromCssColorString(color);
    const material = new Material({
      fabric: {
        type: "LunarGeologyRock",
        uniforms: { baseColor, time: 0, heat },
        source: ROCK_SHADER,
      },
      translucent: false,
    });
    const primitive = this.solids.add(
      new Primitive({
        geometryInstances: new GeometryInstance({
          id: `geology:${id}`,
          geometry,
          modelMatrix: matrix,
        }),
        appearance: new MaterialAppearance({
          material,
          closed: true,
          faceForward: false,
        }),
        asynchronous: false,
      }),
    );
    this.parts.push({ id, primitive, material, color: baseColor, heat });
  }

  private slab(
    id: string,
    top: HeightField,
    bottom: HeightField,
    color: string,
    heat = 0,
  ) {
    this.rock(id, makeSlab(top, bottom), color, heat);
  }

  private rock(id: string, mesh: RockMesh, color: string, heat = 0) {
    const positions = new Float64Array(mesh.positions);
    this.add(
      id,
      new Geometry({
        attributes: Object.assign(new GeometryAttributes(), {
          position: new GeometryAttribute({
            componentDatatype: ComponentDatatype.DOUBLE,
            componentsPerAttribute: 3,
            values: positions,
          }),
          normal: new GeometryAttribute({
            componentDatatype: ComponentDatatype.FLOAT,
            componentsPerAttribute: 3,
            values: new Float32Array(mesh.normals),
          }),
          st: new GeometryAttribute({
            componentDatatype: ComponentDatatype.FLOAT,
            componentsPerAttribute: 2,
            values: new Float32Array(mesh.st),
          }),
        }),
        indices: new Uint32Array(mesh.indices),
        primitiveType: PrimitiveType.TRIANGLES,
        boundingSphere: BoundingSphere.fromVertices(mesh.positions),
      }),
      color,
      heat,
    );
  }

  private lens(
    id: string,
    center: Cartesian3,
    radii: Cartesian3,
    color: string,
    heat = 0,
  ) {
    this.add(
      id,
      new EllipsoidGeometry({
        radii,
        stackPartitions: 32,
        slicePartitions: 48,
        vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
      }),
      color,
      heat,
      Matrix4.fromTranslation(center),
    );
  }

  private conduit(start: Cartesian3, end: Cartesian3, color: string) {
    const direction = Cartesian3.subtract(end, start, new Cartesian3());
    const length = Cartesian3.magnitude(direction);
    Cartesian3.normalize(direction, direction);
    const axis = Cartesian3.cross(
      Cartesian3.UNIT_Z,
      direction,
      new Cartesian3(),
    );
    const rotation =
      Cartesian3.magnitude(axis) < 0.001
        ? Matrix3.IDENTITY
        : Matrix3.fromQuaternion(
            Quaternion.fromAxisAngle(
              Cartesian3.normalize(axis, axis),
              Math.acos(direction.z),
            ),
          );
    const matrix = Matrix4.fromRotationTranslation(
      rotation,
      Cartesian3.midpoint(start, end, new Cartesian3()),
    );
    this.add(
      "magma",
      new CylinderGeometry({
        length,
        topRadius: 0.13,
        bottomRadius: 0.17,
        slices: 24,
        vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
      }),
      color,
      0.65,
      matrix,
    );
  }

  setModel(stage: number, phase: number) {
    this.stage = stage;
    this.phase = phase;
    this.elapsed = 0;
    this.solids.removeAll();
    this.particles.removeAll();
    this.parts = [];
    const exhibit = geologyExhibits[stage]!;
    const color = (id: string) => exhibit.parts.find((p) => p.id === id)!.color;
    if (stage === 0) {
      const surface: HeightField = (x, y) =>
        plainSurface(x, y) + 0.06 * Math.sin(x * 1.8 + y);
      this.slab(
        "melt",
        (x, y) => surface(x, y) - 0.08,
        () => -3.8,
        color("melt"),
        0.45,
      );
      this.slab(
        "surface",
        surface,
        (x, y) => surface(x, y) - 0.08,
        color("surface"),
        phase === 2 ? 0.35 : 0.65,
      );
    } else if (stage === 1) {
      const top = phase === 0 ? plainSurface : shieldSurface;
      this.slab(
        "mantle",
        () => -1.2,
        () => -3.8,
        color("mantle"),
      );
      this.slab(
        "crust",
        (x, y) => top(x, y) - (phase === 0 ? 0 : 0.12),
        () => -1.2,
        color("crust"),
      );
      if (phase > 0)
        this.slab("lava", top, (x, y) => top(x, y) - 0.12, color("lava"));
      if (phase > 0) {
        this.rock(
          "lava",
          makeLavaFlow(),
          phase === 1 ? "#ff993d" : "#3e3941",
          phase === 1 ? 0.85 : 0,
        );
        this.lens(
          "magma",
          new Cartesian3(-1.2, -4.5, -2.65),
          new Cartesian3(1.4, 0.4, 0.65),
          color("magma"),
          0.7,
        );
        this.conduit(
          new Cartesian3(-1.2, -4.55, -2.5),
          new Cartesian3(-0.75, -4.55, -0.9),
          color("magma"),
        );
        this.conduit(
          new Cartesian3(-0.75, -4.55, -0.9),
          new Cartesian3(-1.2, -4.55, 1.15),
          color("magma"),
        );
      }
    } else {
      const top = phase === 0 ? plainSurface : craterSurface;
      this.slab(
        "bedrock",
        phase === 0 ? (x, y) => top(x, y) - 0.32 : () => -2.1,
        () => -3.8,
        color("bedrock"),
      );
      if (phase > 0)
        this.slab(
          "breccia",
          (x, y) => top(x, y) - 0.32,
          () => -2.1,
          color("breccia"),
        );
      this.slab("terrain", top, (x, y) => top(x, y) - 0.32, color("terrain"));
      if (phase > 0)
        this.lens(
          "impact-melt",
          new Cartesian3(0.65, -4.51, -1.35),
          new Cartesian3(1.85, 0.22, 0.22),
          phase === 1 ? "#ff973d" : "#594b52",
          phase === 1 ? 0.85 : 0,
        );
    }
    if (phase > 0)
      for (let i = 0; i < 72; i++)
        this.particles.add({
          position: Cartesian3.ZERO,
          pixelSize: stage === 2 ? 3 : 4,
          color: Color.fromCssColorString("#ffe3a0"),
          outlineColor: Color.fromCssColorString("#f27935"),
          outlineWidth: 1,
          id: `geology:${stage === 0 ? "melt" : stage === 1 ? "magma" : "impact-melt"}`,
        });
    this.tick();
    this.viewer.scene.requestRender();
  }

  setRunning(running: boolean) {
    this.running = running;
    this.lastTime = performance.now();
  }
  select(id: string | null, hidden: ReadonlySet<string>) {
    for (const part of this.parts) {
      part.primitive.show = !hidden.has(part.id);
      part.material.uniforms.baseColor =
        id && part.id !== id
          ? Color.multiplyByScalar(part.color, 0.48, new Color())
          : part.color;
      part.material.uniforms.heat =
        id && part.id !== id ? part.heat * 0.25 : part.heat;
    }
    const particleId =
      this.stage === 0 ? "melt" : this.stage === 1 ? "magma" : "impact-melt";
    this.particles.show = !hidden.has(particleId) && (!id || id === particleId);
    this.viewer.scene.requestRender();
  }
  private tick() {
    const now = performance.now();
    if (this.running) this.elapsed += (now - this.lastTime) / 1000;
    if (this.running) this.viewer.scene.requestRender();
    this.lastTime = now;
    for (const part of this.parts) part.material.uniforms.time = this.elapsed;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles.get(i),
        t = (i / this.particles.length + this.elapsed * 0.12) % 1;
      if (this.stage === 0) {
        const cell = Math.floor(i / 24),
          angle = t * Math.PI * 2;
        p.position = new Cartesian3(
          -3.8 + cell * 3.8 + 1.3 * Math.sin(angle),
          -4.55,
          -1.75 + 1.42 * Math.cos(angle),
        );
        p.show = this.phase > 0;
      } else if (this.stage === 1) {
        p.position = new Cartesian3(
          -1.2 + 0.3 * Math.sin(t * Math.PI),
          -4.76,
          -2.4 + t * 3.4,
        );
        p.show = this.phase === 1 || i % 3 === 0;
      } else {
        const angle = i * 2.39996;
        p.position = new Cartesian3(
          0.65 + Math.cos(angle) * t * 4,
          -3.8 + Math.abs(Math.sin(angle)) * t * 4,
          0.2 + Math.sin(t * Math.PI) * 3.5,
        );
        p.show = this.phase === 1;
      }
    }
  }
  reset(view: GeologyView = "oblique") {
    const pose =
      view === "top"
        ? new HeadingPitchRange(0, -Math.PI / 2, 28)
        : view === "section"
          ? new HeadingPitchRange(0, -0.04, 28)
          : new HeadingPitchRange(0.48, -0.48, 29);
    this.viewer.camera.lookAtTransform(
      Matrix4.fromTranslation(new Cartesian3(-1.6, -0.8, -0.6)),
      pose,
    );
  }
  capture() {
    this.viewer.render();
    return this.viewer.canvas.toDataURL("image/png");
  }
  dispose() {
    this.removeTick();
    this.handler.destroy();
    this.viewer.destroy();
  }
}
