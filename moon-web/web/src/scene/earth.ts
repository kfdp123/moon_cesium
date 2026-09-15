import {
  Cartesian2,
  JulianDate,
  Material,
  Matrix3,
  Resource,
  TimeInterval,
  Transforms,
} from "cesium";

export const EARTH_IMAGE_URL = "/assets/earth-blue-marble-200409.jpg";
export const EARTH_IMAGE_CREDIT = "NASA Blue Marble · 2004 年 9 月合成影像";

/** Bundled Cesium XYS data keeps Earth and the Moon in the same inertial frame.
 * Earth orientation parameters use Cesium's default zero corrections (not precision UT1).
 */
export async function loadEarthResources() {
  const [image] = await Promise.all([
    Resource.fetchImage({ url: EARTH_IMAGE_URL }),
    Transforms.preloadIcrfFixed(
      new TimeInterval({
        start: JulianDate.fromIso8601("2000-01-01T00:00:00Z"),
        stop: JulianDate.fromIso8601("2100-01-01T00:00:00Z"),
      }),
    ),
  ]);
  return image!;
}

export function earthToInertial(time: JulianDate) {
  return Transforms.computeFixedToIcrfMatrix(time, new Matrix3())!;
}

export function earthMaterial(image: HTMLImageElement | ImageBitmap) {
  return new Material({
    fabric: {
      type: "BlueMarbleEarth",
      // Cesium EllipsoidGeometry starts u=0 at Greenwich; BMNG starts at 180°W.
      uniforms: { image, offset: new Cartesian2(0.5, 0) },
      source: `czm_material czm_getMaterial(czm_materialInput inputData) {
        czm_material material = czm_getDefaultMaterial(inputData);
        material.diffuse = texture(image, vec2(fract(inputData.st.x + offset.x), clamp(inputData.st.y, 0.001, 0.999))).rgb;
        material.alpha = 1.0;
        return material;
      }`,
    },
    translucent: false,
  });
}
