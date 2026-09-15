import { Cartesian3, JulianDate, Matrix3 } from "cesium";
import { expect, it } from "vitest";
import { lunarEphemeris } from "./lunarEphemeris";

it("keeps Earth over the near side and the solar declination near the lunar equator", () => {
  const start = JulianDate.fromIso8601("2026-09-01T00:00:00Z");
  for (let day = 0; day < 31; day++) {
    const state = lunarEphemeris(
      JulianDate.addDays(start, day, new JulianDate()),
    );
    const earth = Matrix3.multiplyByVector(
      state.inertialToMoon,
      Cartesian3.negate(state.moon, new Cartesian3()),
      new Cartesian3(),
    );
    expect(
      Math.abs((Math.atan2(earth.y, earth.x) * 180) / Math.PI),
    ).toBeLessThan(9);
    expect(
      Math.abs(
        (Math.asin(earth.z / Cartesian3.magnitude(earth)) * 180) / Math.PI,
      ),
    ).toBeLessThan(8);
    expect(Math.abs(state.subsolarLatitude)).toBeLessThan(2);
    expect(state.distanceKm).toBeGreaterThan(350000);
    expect(state.distanceKm).toBeLessThan(410000);
  }
});
it("uses a roughly monthly rotation, not a terrestrial 24 hour rotation", () => {
  const time = JulianDate.fromIso8601("2026-09-15T00:00:00Z");
  const a = lunarEphemeris(time),
    b = lunarEphemeris(JulianDate.addDays(time, 1, new JulianDate()));
  const axis = (matrix: Matrix3) =>
    Matrix3.multiplyByVector(matrix, Cartesian3.UNIT_X, new Cartesian3());
  const angle =
    (Cartesian3.angleBetween(axis(a.moonToInertial), axis(b.moonToInertial)) *
      180) /
    Math.PI;
  expect(angle).toBeGreaterThan(12);
  expect(angle).toBeLessThan(14);
  expect(
    (Cartesian3.angleBetween(a.moon, b.moon) * 180) / Math.PI,
  ).toBeGreaterThan(10);
});
it("returns independent, orthonormal matrices and normalized sunlight", () => {
  const a = lunarEphemeris(JulianDate.fromIso8601("2026-09-15T00:00:00Z"));
  const saved = Matrix3.clone(a.moonToInertial);
  lunarEphemeris(JulianDate.fromIso8601("2026-09-25T00:00:00Z"));
  expect(Matrix3.equals(saved, a.moonToInertial)).toBe(true);
  expect(
    Matrix3.equalsEpsilon(
      Matrix3.multiply(a.inertialToMoon, a.moonToInertial, new Matrix3()),
      Matrix3.IDENTITY,
      1e-12,
    ),
  ).toBe(true);
  expect(Cartesian3.magnitude(a.sunFixed)).toBeCloseTo(1, 12);
  expect(a.illuminatedFraction).toBeGreaterThanOrEqual(0);
  expect(a.illuminatedFraction).toBeLessThanOrEqual(1);
});
