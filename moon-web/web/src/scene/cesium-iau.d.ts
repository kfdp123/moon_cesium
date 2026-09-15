import "cesium";
import type { JulianDate, Matrix3 } from "cesium";

// Cesium exports this class and uses it for its Moon primitive, but omits its
// types because the API is internal. Keep the dependency pinned and covered by
// the near-side/pole tests when upgrading Cesium.
declare module "cesium" {
  export class IauOrientationAxes {
    evaluate(date: JulianDate, result: Matrix3): Matrix3;
  }
}
