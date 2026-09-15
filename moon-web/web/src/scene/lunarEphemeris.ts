import {
  Cartesian3,
  JulianDate,
  Matrix3,
  Simon1994PlanetaryPositions,
  IauOrientationAxes,
} from "cesium";
const moonAxes = new IauOrientationAxes();

/** Modern-date analytic approximation in meters. Never used for geological epochs. */
export function lunarEphemeris(time: JulianDate) {
  const moon =
    Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(
      time,
      new Cartesian3(),
    );
  const sun =
    Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
      time,
      new Cartesian3(),
    );
  // Use the same IAU 2000 rotation as Cesium's Moon primitive. The older public
  // HPR approximation fails our near-side/pole checks in this pinned version.
  const inertialToMoon = moonAxes.evaluate(time, new Matrix3());
  const moonToInertial = Matrix3.transpose(inertialToMoon, new Matrix3());
  const sunFromMoon = Cartesian3.normalize(
    Cartesian3.subtract(sun, moon, new Cartesian3()),
    new Cartesian3(),
  );
  const sunFixed = Matrix3.multiplyByVector(
    inertialToMoon,
    sunFromMoon,
    new Cartesian3(),
  );
  const earthDirection = Cartesian3.normalize(
    Cartesian3.negate(moon, new Cartesian3()),
    new Cartesian3(),
  );
  return {
    moon,
    sun,
    moonToInertial,
    inertialToMoon,
    sunFixed,
    distanceKm: Cartesian3.magnitude(moon) / 1000,
    illuminatedFraction: (1 + Cartesian3.dot(earthDirection, sunFromMoon)) / 2,
    subsolarLongitude: (Math.atan2(sunFixed.y, sunFixed.x) * 180) / Math.PI,
    subsolarLatitude: (Math.asin(sunFixed.z) * 180) / Math.PI,
  };
}
