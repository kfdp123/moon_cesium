import { describe, expect, it } from "vitest";
import {
  BoundingSphere,
  Cartesian3,
  ComponentDatatype,
  Ellipsoid,
  GeographicProjection,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  Matrix4,
  PrimitivePipeline,
  PrimitiveType,
} from "cesium";
import { buildShell } from "./shellGeometry";

// Exercise Cesium's real CPU pipeline, including its optional 2D projection.
function prepare(mode, scene3DOnly) {
  return buildShell(0, 240 / 1737.4, mode).map((mesh) => {
    const geometry = new Geometry({
      attributes: {
        position: new GeometryAttribute({
          componentDatatype: ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: new Float64Array(
            mesh.positions.map((value) => value * 1737400),
          ),
        }),
        normal: new GeometryAttribute({
          componentDatatype: ComponentDatatype.FLOAT,
          componentsPerAttribute: 3,
          values: new Float32Array(mesh.normals),
        }),
      },
      indices: new Uint32Array(mesh.indices),
      primitiveType: PrimitiveType.TRIANGLES,
      boundingSphere: new BoundingSphere(Cartesian3.ZERO, 240000),
    });
    return PrimitivePipeline.combineGeometry({
      instances: [new GeometryInstance({ geometry })],
      ellipsoid: Ellipsoid.MOON,
      projection: new GeographicProjection(Ellipsoid.MOON),
      elementIndexUintSupported: true,
      scene3DOnly,
      vertexCacheOptimize: false,
      compressVertices: true,
      modelMatrix: Matrix4.clone(Matrix4.IDENTITY),
      createPickOffsets: false,
    });
  });
}

describe("Cesium interior geometry pipeline", () => {
  it("reproduces the 2D projection failure for a cut face through the moon center", () => {
    expect(() => prepare("half", false)).toThrow(/project|cartographic/i);
  });
  it.each(["full", "half", "quarter"])(
    "prepares %s in a 3D-only scene",
    (mode) => {
      for (const result of prepare(mode, true)) {
        expect(result.geometries.length).toBeGreaterThan(0);
      }
    },
  );
});
