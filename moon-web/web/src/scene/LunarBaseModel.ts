import {
  BoundingSphere,
  BoxGeometry,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  ComponentDatatype,
  CylinderGeometry,
  EllipsoidGeometry,
  Geometry,
  GeometryAttribute,
  GeometryAttributes,
  GeometryInstance,
  Matrix3,
  Matrix4,
  PerInstanceColorAppearance,
  Primitive,
  PrimitiveCollection,
  PrimitiveType,
  ShadowMode,
  Transforms,
  Viewer,
} from "cesium";
import { sunColorFragment } from "./sunAppearance";

type FacilityId = "habitat" | "power" | "communications" | "landing";
type Facility = {
  id: FacilityId;
  center: Cartesian3;
  frame: Matrix4;
  inverse: Matrix4;
  instances: GeometryInstance[];
};

const palette = {
  shell: Color.fromCssColorString("#dce1dc"),
  endcap: Color.fromCssColorString("#bbc4c3"),
  metal: Color.fromCssColorString("#8d9a9e"),
  dark: Color.fromCssColorString("#34444c"),
  window: Color.fromCssColorString("#133e53"),
  blue: Color.fromCssColorString("#245574"),
  cell: Color.fromCssColorString("#426f94"),
  amber: Color.fromCssColorString("#e0a653"),
  ivory: Color.fromCssColorString("#f0eddb"),
  pad: Color.fromCssColorString("#4f5152"),
  stone: Color.fromCssColorString("#70706a"),
};
const vertexFormat = PerInstanceColorAppearance.VERTEX_FORMAT;
const alongY = Matrix3.fromRotationX(Math.PI / 2);
const alongX = Matrix3.fromRotationY(Math.PI / 2);

/** Four independently grounded facilities, with geometry batched per facility. */
export class LunarBaseModel {
  private readonly primitives = new PrimitiveCollection();
  private readonly surfaces: Primitive[] = [];
  private readonly highlights = new Map<FacilityId, Primitive>();

  constructor(
    private viewer: Viewer,
    private world: (local: Cartesian3) => Cartesian3,
    private sunlight: boolean,
  ) {
    viewer.scene.primitives.add(this.primitives);
    this.createHabitat();
    this.createPower();
    this.createCommunications();
    this.createLanding();
    this.createSiteDetails();
  }

  setLighting(enabled: boolean) {
    this.sunlight = enabled;
    for (const primitive of this.surfaces)
      primitive.appearance = this.appearance();
    this.viewer.scene.requestRender();
  }

  setHighlighted(id: string | null) {
    for (const [facility, primitive] of this.highlights)
      primitive.show = id === facility || id === `base:${facility}`;
    this.viewer.scene.requestRender();
  }

  contains(x: number, y: number) {
    const nearModule = [-18, 18].some(
      (center) => Math.abs(x - center) < 6.8 && y > 0 && y < 30,
    );
    const inCorridor = Math.abs(x) < 14 && Math.abs(y - 15) < 3.1;
    const nearPanelLeg = [-76, -62, -48].some((column) =>
      [-6, 18].some((row) =>
        [-3.4, 3.4].some(
          (offset) =>
            Math.abs(x - column - offset) < 1.3 && Math.abs(y - row) < 1.3,
        ),
      ),
    );
    const nearAntenna = Math.hypot(x - 48, y - 40) < 4;
    const nearBattery = Math.abs(x + 38) < 2.1 && Math.abs(y - 6) < 3.4;
    const nearCargo = x > 34.5 && x < 42 && y > -42 && y < -34;
    const nearService = Math.abs(x - 92) < 2.1 && Math.abs(y + 42) < 3.2;
    return (
      nearModule ||
      inCorridor ||
      nearPanelLeg ||
      nearAntenna ||
      nearBattery ||
      nearCargo ||
      nearService
    );
  }

  dispose() {
    this.viewer.scene.primitives.remove(this.primitives);
  }

  private facility(id: FacilityId, x: number, y: number): Facility {
    const center = new Cartesian3(x, y, 0);
    const frame = Transforms.eastNorthUpToFixedFrame(
      this.world(center),
      this.viewer.scene.globe.ellipsoid,
    );
    return {
      id,
      center,
      frame,
      inverse: Matrix4.inverseTransformation(frame, new Matrix4()),
      instances: [],
    };
  }

  private appearance() {
    return new PerInstanceColorAppearance({
      translucent: false,
      closed: true,
      fragmentShaderSource: this.sunlight ? sunColorFragment : undefined,
    });
  }

  private finish(facility: Facility, pickable = true) {
    const primitive = this.primitives.add(
      new Primitive({
        geometryInstances: facility.instances,
        modelMatrix: facility.frame,
        appearance: this.appearance(),
        asynchronous: false,
        cull: false,
        shadows: ShadowMode.CAST_ONLY,
        allowPicking: pickable,
      }),
    );
    this.surfaces.push(primitive);
  }

  private add(
    facility: Facility,
    geometry: Geometry | BoxGeometry | CylinderGeometry | EllipsoidGeometry,
    position: Cartesian3,
    color: Color,
    rotation = Matrix3.IDENTITY,
  ) {
    facility.instances.push(
      new GeometryInstance({
        id: `base:${facility.id}`,
        geometry,
        modelMatrix: Matrix4.fromRotationTranslation(rotation, position),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      }),
    );
  }

  private box(
    facility: Facility,
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    color: Color,
    rotation = Matrix3.IDENTITY,
  ) {
    this.add(
      facility,
      BoxGeometry.fromDimensions({
        dimensions: new Cartesian3(width, depth, height),
        vertexFormat,
      }),
      new Cartesian3(x, y, z),
      color,
      rotation,
    );
  }

  private cylinder(
    facility: Facility,
    center: Cartesian3,
    radius: number,
    length: number,
    color: Color,
    rotation = Matrix3.IDENTITY,
    topRadius = radius,
  ) {
    this.add(
      facility,
      new CylinderGeometry({
        length,
        topRadius,
        bottomRadius: radius,
        slices: 48,
        vertexFormat,
      }),
      center,
      color,
      rotation,
    );
  }

  private sphere(
    facility: Facility,
    center: Cartesian3,
    radii: Cartesian3,
    color: Color,
    rotation = Matrix3.IDENTITY,
  ) {
    this.add(
      facility,
      new EllipsoidGeometry({
        radii,
        stackPartitions: 20,
        slicePartitions: 32,
        vertexFormat,
      }),
      center,
      color,
      rotation,
    );
  }

  /** A narrow metal tube between two points, used for structural framing. */
  private strut(
    facility: Facility,
    start: Cartesian3,
    end: Cartesian3,
    radius: number,
    color = palette.metal,
  ) {
    const direction = Cartesian3.subtract(end, start, new Cartesian3());
    const length = Cartesian3.magnitude(direction);
    Cartesian3.divideByScalar(direction, length, direction);
    const reference =
      Math.abs(direction.z) > 0.9 ? Cartesian3.UNIT_X : Cartesian3.UNIT_Z;
    const right = Cartesian3.normalize(
      Cartesian3.cross(reference, direction, new Cartesian3()),
      new Cartesian3(),
    );
    const forward = Cartesian3.cross(direction, right, new Cartesian3());
    const rotation = Matrix3.fromColumnMajorArray([
      right.x,
      right.y,
      right.z,
      forward.x,
      forward.y,
      forward.z,
      direction.x,
      direction.y,
      direction.z,
    ]);
    this.cylinder(
      facility,
      Cartesian3.midpoint(start, end, new Cartesian3()),
      radius,
      length,
      color,
      rotation,
    );
  }

  /** A rigid facility stays level while each foot reaches its terrain height. */
  private foot(facility: Facility, x: number, y: number, top: number) {
    const surface = Matrix4.multiplyByPoint(
      facility.inverse,
      this.world(
        new Cartesian3(facility.center.x + x, facility.center.y + y, 0),
      ),
      new Cartesian3(),
    );
    const bottom = surface.z + 0.12;
    this.box(facility, x, y, bottom, 2.1, 2.1, 0.24, palette.dark);
    this.strut(
      facility,
      new Cartesian3(x, y, bottom),
      new Cartesian3(x, y, top),
      0.24,
    );
  }

  private ring(
    facility: Facility,
    center: Cartesian3,
    radius: number,
    tube: number,
    color: Color,
    rotation = Matrix3.IDENTITY,
  ) {
    this.add(facility, torusGeometry(radius, tube), center, color, rotation);
  }

  private highlight(facility: Facility, x: number, y: number, radius: number) {
    const instance = new GeometryInstance({
      geometry: torusGeometry(radius, 0.12),
      modelMatrix: Matrix4.fromTranslation(new Cartesian3(x, y, 0.28)),
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(
          Color.fromCssColorString("#70d9e8"),
        ),
      },
    });
    const primitive = this.primitives.add(
      new Primitive({
        geometryInstances: instance,
        modelMatrix: facility.frame,
        appearance: new PerInstanceColorAppearance({
          flat: true,
          translucent: false,
          closed: true,
        }),
        allowPicking: false,
        asynchronous: false,
        cull: false,
        show: false,
        shadows: ShadowMode.DISABLED,
      }),
    );
    this.highlights.set(facility.id, primitive);
  }

  private createHabitat() {
    const habitat = this.facility("habitat", 0, 15);
    for (const x of [-18, 18]) {
      // Pressure shell: cylindrical middle with rounded end caps and collars.
      this.cylinder(
        habitat,
        new Cartesian3(x, 0, 6.3),
        5.4,
        21,
        palette.shell,
        alongY,
      );
      for (const y of [-10.5, 10.5])
        this.sphere(
          habitat,
          new Cartesian3(x, y, 6.3),
          new Cartesian3(5.39, 2.3, 5.39),
          palette.endcap,
        );
      for (const y of [-9.4, -4.8, 4.8, 9.4])
        this.ring(
          habitat,
          new Cartesian3(x, y, 6.3),
          5.43,
          0.13,
          palette.metal,
          alongY,
        );
      // A single orange identity band reads clearly from the orbiting camera.
      this.ring(
        habitat,
        new Cartesian3(x, -8.8, 6.3),
        5.43,
        0.17,
        palette.amber,
        alongY,
      );
      for (const y of [-7, 7])
        for (const dx of [-4.1, 4.1]) this.foot(habitat, x + dx, y, 3.8);

      // Front airlock, recessed hatch, observation ports, and entrance steps.
      this.cylinder(
        habitat,
        new Cartesian3(x, -12.3, 4.8),
        2.25,
        1.4,
        palette.shell,
        alongY,
      );
      this.cylinder(
        habitat,
        new Cartesian3(x, -13.05, 4.8),
        1.82,
        0.13,
        palette.dark,
        alongY,
      );
      this.ring(
        habitat,
        new Cartesian3(x, -13.15, 4.8),
        1.9,
        0.13,
        palette.metal,
        alongY,
      );
      this.box(habitat, x, -13.15, 4.45, 1.45, 0.18, 2.45, palette.endcap);
      this.cylinder(
        habitat,
        new Cartesian3(x, -13.28, 5.35),
        0.44,
        0.12,
        palette.window,
        alongY,
      );
      this.ring(
        habitat,
        new Cartesian3(x, -13.37, 5.35),
        0.48,
        0.06,
        palette.metal,
        alongY,
      );
      this.box(
        habitat,
        x + 0.47,
        -13.29,
        4.25,
        0.08,
        0.09,
        0.43,
        palette.amber,
      );
      for (let step = 0; step < 5; step++)
        this.box(
          habitat,
          x,
          -16.8 + step * 0.64,
          0.24 + step * 0.48,
          2.8,
          0.67,
          0.34,
          palette.metal,
        );
      for (const dx of [-1.6, 1.6]) {
        this.strut(
          habitat,
          new Cartesian3(x + dx, -17.1, 1.4),
          new Cartesian3(x + dx, -13.8, 3.8),
          0.06,
          palette.amber,
        );
        for (const y of [-17, -14])
          this.strut(
            habitat,
            new Cartesian3(x + dx, y, y < -15 ? 0.3 : 2.3),
            new Cartesian3(x + dx, y, y < -15 ? 1.4 : 3.6),
            0.055,
          );
      }
      for (const y of [-5.8, 0, 5.8]) {
        const side = x < 0 ? -1 : 1;
        this.cylinder(
          habitat,
          new Cartesian3(x + side * 5.36, y, 6.8),
          0.82,
          0.25,
          palette.window,
          alongX,
        );
        this.ring(
          habitat,
          new Cartesian3(x + side * 5.52, y, 6.8),
          0.87,
          0.08,
          palette.metal,
          alongX,
        );
      }
      // Long radiator rails on the crown and compact rear service units.
      this.box(habitat, x, 1.2, 11.77, 3.2, 12.2, 0.24, palette.ivory);
      for (let y = -4.2; y <= 7; y += 1.4)
        this.box(habitat, x, y, 11.94, 3.15, 0.055, 0.04, palette.metal);
      this.box(habitat, x + 2.9, 11.8, 2, 2.4, 2, 3.4, palette.dark);
      this.box(habitat, x + 2.9, 12.85, 2, 1.8, 0.06, 2.5, palette.blue);
    }
    this.cylinder(
      habitat,
      new Cartesian3(0, 0, 5),
      2.2,
      26,
      palette.endcap,
      alongX,
    );
    for (const x of [-10.5, 0, 10.5])
      this.ring(
        habitat,
        new Cartesian3(x, 0, 5),
        2.24,
        0.16,
        palette.metal,
        alongX,
      );
    this.box(habitat, 0, 0, 7.3, 7, 3, 0.18, palette.ivory);
    this.finish(habitat);
    this.highlight(habitat, 0, 0, 32);
  }

  private createPower() {
    const power = this.facility("power", -62, 6);
    const tilt = Matrix3.fromRotationX(0.34);
    // Six panel tables, each with visible cell lanes and raised edge framing.
    for (const x of [-14, 0, 14]) {
      for (const y of [-12, 12]) {
        const panelCenter = new Cartesian3(x, y, 4.8);
        const panelPoint = (dx: number, dy: number, dz: number) =>
          Cartesian3.add(
            panelCenter,
            Matrix3.multiplyByVector(
              tilt,
              new Cartesian3(dx, dy, dz),
              new Cartesian3(),
            ),
            new Cartesian3(),
          );
        this.box(power, x, y, 4.8, 11.2, 17.2, 0.22, palette.dark, tilt);
        for (let row = 0; row < 8; row++) {
          for (let column = 0; column < 4; column++) {
            const center = panelPoint(
              -4.15 + column * 2.76,
              -7.4 + row * 2.1,
              0.15,
            );
            this.box(
              power,
              center.x,
              center.y,
              center.z,
              2.56,
              1.9,
              0.055,
              (row + column) % 3 === 0 ? palette.cell : palette.blue,
              tilt,
            );
            // Silver bus bars make the panels read as solar cells up close.
            const bus = panelPoint(
              -4.15 + column * 2.76,
              -7.4 + row * 2.1,
              0.185,
            );
            this.box(
              power,
              bus.x,
              bus.y,
              bus.z,
              0.027,
              1.84,
              0.014,
              palette.metal,
              tilt,
            );
          }
        }
        for (const dx of [-5.55, 5.55]) {
          const center = panelPoint(dx, 0, 0.21);
          this.box(
            power,
            center.x,
            center.y,
            center.z,
            0.12,
            17.2,
            0.12,
            palette.metal,
            tilt,
          );
        }
        for (const dy of [-8.55, 8.55]) {
          const center = panelPoint(0, dy, 0.21);
          this.box(
            power,
            center.x,
            center.y,
            center.z,
            11.2,
            0.12,
            0.12,
            palette.metal,
            tilt,
          );
        }
        for (const dx of [-3.4, 3.4]) {
          this.foot(power, x + dx, y, 4.6);
          this.strut(
            power,
            new Cartesian3(x + dx, y, 2.2),
            panelPoint(dx, -5.5, -0.12),
            0.095,
          );
          this.strut(
            power,
            new Cartesian3(x + dx, y, 2.2),
            panelPoint(dx, 5.5, -0.12),
            0.095,
          );
        }
      }
    }
    this.box(power, 24, 0, 1.45, 3.5, 6, 2.9, palette.shell);
    for (let y = -2.1; y <= 2.1; y += 0.7)
      this.box(power, 25.79, y, 1.5, 0.08, 0.26, 1.8, palette.dark);
    this.box(power, 24, -3.07, 1.8, 1.8, 0.12, 0.7, palette.amber);
    this.finish(power);
    this.highlight(power, 0, 0, 31);
  }

  private createCommunications() {
    const station = this.facility("communications", 48, 40);
    for (const [x, y] of [
      [-3, -2.4],
      [3, -2.4],
      [0, 3.2],
    ]) {
      this.foot(station, x!, y!, 0.5);
      this.strut(
        station,
        new Cartesian3(x, y, 0.5),
        new Cartesian3(0, 0, 6.5),
        0.22,
      );
    }
    this.cylinder(station, new Cartesian3(0, 0, 5.5), 1, 3, palette.dark);
    this.box(station, 0, 0, 7.4, 4.8, 1.2, 1, palette.metal);
    const rotation = Matrix3.fromRotationX(0.46);
    const dishCenter = new Cartesian3(0, 0, 9.1);
    const point = (x: number, y: number, z: number) =>
      Cartesian3.add(
        dishCenter,
        Matrix3.multiplyByVector(
          rotation,
          new Cartesian3(x, y, z),
          new Cartesian3(),
        ),
        new Cartesian3(),
      );
    this.add(
      station,
      dishGeometry(6.1, 1.8, false),
      dishCenter,
      palette.ivory,
      rotation,
    );
    this.add(
      station,
      dishGeometry(6.1, 1.8, true),
      dishCenter,
      palette.endcap,
      rotation,
    );
    this.ring(station, point(0, 0, 1.8), 6.1, 0.13, palette.metal, rotation);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      for (let part = 0; part < 5; part++) {
        const r1 = (part * 6.1) / 5;
        const r2 = ((part + 1) * 6.1) / 5;
        this.strut(
          station,
          point(
            Math.cos(angle) * r1,
            Math.sin(angle) * r1,
            1.8 * (r1 / 6.1) ** 2 - 0.19,
          ),
          point(
            Math.cos(angle) * r2,
            Math.sin(angle) * r2,
            1.8 * (r2 / 6.1) ** 2 - 0.19,
          ),
          0.08,
        );
      }
    }
    const feed = point(0, 0, 4.8);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      this.strut(
        station,
        point(Math.cos(angle) * 5.2, Math.sin(angle) * 5.2, 1.35),
        feed,
        0.055,
        palette.dark,
      );
    }
    this.cylinder(station, feed, 0.32, 0.8, palette.amber, rotation);
    this.box(station, 5, 4, 1.2, 3, 2.6, 2.4, palette.shell);
    this.box(station, 5, 2.63, 1.25, 2.1, 0.12, 1.6, palette.dark);
    this.strut(
      station,
      new Cartesian3(6.8, 4, 0),
      new Cartesian3(6.8, 4, 12),
      0.1,
    );
    for (const z of [8.7, 10.1, 11.5])
      this.strut(
        station,
        new Cartesian3(5.6, 4, z),
        new Cartesian3(8, 4, z),
        0.035,
      );
    this.finish(station);
    this.highlight(station, 1, 0, 10);
  }

  private createLanding() {
    const landing = this.facility("landing", 65, -48);
    this.cylinder(landing, new Cartesian3(0, 0, 0.08), 22, 0.16, palette.pad);
    this.ring(landing, new Cartesian3(0, 0, 0.2), 20.5, 0.18, palette.ivory);
    this.ring(landing, new Cartesian3(0, 0, 0.2), 16.5, 0.085, palette.amber);
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const x = Math.cos(angle) * 20.5;
      const y = Math.sin(angle) * 20.5;
      this.box(
        landing,
        x,
        y,
        0.24,
        1.7,
        0.35,
        0.08,
        palette.amber,
        Matrix3.fromRotationZ(angle),
      );
      this.cylinder(
        landing,
        new Cartesian3(Math.cos(angle) * 23, Math.sin(angle) * 23, 0.7),
        0.18,
        1.4,
        palette.dark,
      );
      this.sphere(
        landing,
        new Cartesian3(Math.cos(angle) * 23, Math.sin(angle) * 23, 1.43),
        new Cartesian3(0.26, 0.26, 0.18),
        palette.amber,
      );
    }
    // An understated H-shaped landing target, with segmented approach marks.
    for (const x of [-3.5, 3.5])
      this.box(landing, x, 0, 0.2, 0.7, 10, 0.08, palette.ivory);
    this.box(landing, 0, 0, 0.2, 7, 0.7, 0.08, palette.ivory);
    for (const y of [-12, -9, 9, 12])
      this.box(landing, 0, y, 0.2, 0.25, 1.4, 0.08, palette.amber);
    // Cargo and service equipment stay outside the clear landing zone.
    for (const [x, y, width] of [
      [-25, 8, 3],
      [-25, 12, 3],
      [-28.5, 10, 2],
    ]) {
      this.box(landing, x!, y!, 1, width!, 2.5, 2, palette.endcap);
      this.box(landing, x!, y!, 2.04, width! + 0.12, 2.6, 0.1, palette.dark);
      for (const dx of [-0.8, 0.8])
        this.box(landing, x! + dx, y!, 1.03, 0.1, 2.62, 2.14, palette.amber);
    }
    this.box(landing, 27, 6, 1.4, 3.4, 5.5, 2.8, palette.shell);
    this.cylinder(
      landing,
      new Cartesian3(27, 6, 3.4),
      0.85,
      1.4,
      palette.metal,
    );
    this.finish(landing);
    this.highlight(landing, 0, 0, 24.5);
  }

  private createSiteDetails() {
    const details = this.facility("habitat", 0, 0);
    // Low guide markers describe a pedestrian spine without covering regolith.
    for (let i = 0; i < 13; i++) {
      const x = -35 + i * 6;
      const y = -13 - i * 1.6;
      for (const side of [-1, 1]) {
        const surface = Matrix4.multiplyByPoint(
          details.inverse,
          this.world(new Cartesian3(x, y + side * 2.2, 0)),
          new Cartesian3(),
        );
        this.cylinder(
          details,
          new Cartesian3(surface.x, surface.y, surface.z + 0.3),
          0.12,
          0.6,
          palette.metal,
        );
        this.sphere(
          details,
          new Cartesian3(surface.x, surface.y, surface.z + 0.64),
          new Cartesian3(0.18, 0.18, 0.12),
          palette.ivory,
        );
      }
    }
    const rocks = [
      [-47, -38, 1.6],
      [-30, 51, 1.8],
      [21, 53, 1.3],
      [88, -6, 1.5],
      [-92, 31, 2.1],
      [13, -56, 0.8],
      [-12, -39, 0.6],
      [72, 42, 1.1],
      [-90, -24, 1.3],
    ];
    for (const [x, y, radius] of rocks) {
      const ground = Matrix4.multiplyByPoint(
        details.inverse,
        this.world(new Cartesian3(x, y, 0)),
        new Cartesian3(),
      );
      const size = radius!;
      this.add(
        details,
        new EllipsoidGeometry({
          radii: new Cartesian3(size, size * 0.7, size * 0.55),
          stackPartitions: 5,
          slicePartitions: 7,
          vertexFormat,
        }),
        new Cartesian3(ground.x, ground.y, ground.z + size * 0.25),
        palette.stone,
        Matrix3.fromRotationZ(x!),
      );
    }
    this.finish(details, false);
  }
}

function meshGeometry(
  positions: number[],
  normals: number[],
  indices: number[],
) {
  const values = new Float64Array(positions);
  const attributes = new GeometryAttributes();
  attributes.position = new GeometryAttribute({
    componentDatatype: ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values,
  });
  attributes.normal = new GeometryAttribute({
    componentDatatype: ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: new Float32Array(normals),
  });
  return new Geometry({
    attributes,
    indices: new Uint16Array(indices),
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(positions),
  });
}

/** Circular cross-section gives collars and rim details their curved highlight. */
function torusGeometry(radius: number, tube: number) {
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  const segments = 64,
    sides = 8;
  for (let segment = 0; segment <= segments; segment++) {
    const a = (segment / segments) * Math.PI * 2;
    for (let side = 0; side <= sides; side++) {
      const b = (side / sides) * Math.PI * 2;
      const r = radius + tube * Math.cos(b);
      positions.push(r * Math.cos(a), r * Math.sin(a), tube * Math.sin(b));
      normals.push(
        Math.cos(b) * Math.cos(a),
        Math.cos(b) * Math.sin(a),
        Math.sin(b),
      );
      if (segment < segments && side < sides) {
        const next = segment * (sides + 1) + side;
        indices.push(
          next,
          next + sides + 1,
          next + 1,
          next + 1,
          next + sides + 1,
          next + sides + 2,
        );
      }
    }
  }
  return meshGeometry(positions, normals, indices);
}

/** Both dish faces have explicit outward normals; the back is offset for depth. */
function dishGeometry(radius: number, depth: number, back: boolean) {
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  const rings = 12,
    segments = 64;
  const sign = back ? -1 : 1;
  for (let ring = 0; ring <= rings; ring++) {
    const r = (radius * ring) / rings;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment * Math.PI * 2) / segments;
      const x = r * Math.cos(angle),
        y = r * Math.sin(angle);
      positions.push(x, y, depth * (r / radius) ** 2 - (back ? 0.18 : 0));
      const normal = Cartesian3.normalize(
        new Cartesian3(
          (-2 * depth * x) / radius ** 2,
          (-2 * depth * y) / radius ** 2,
          1,
        ),
        new Cartesian3(),
      );
      normals.push(normal.x * sign, normal.y * sign, normal.z * sign);
      if (ring < rings && segment < segments) {
        const first = ring * (segments + 1) + segment;
        const second = first + segments + 1;
        if (back)
          indices.push(first, first + 1, second, first + 1, second + 1, second);
        else
          indices.push(first, second, first + 1, first + 1, second, second + 1);
      }
    }
  }
  return meshGeometry(positions, normals, indices);
}
