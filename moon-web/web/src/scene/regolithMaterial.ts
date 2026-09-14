import { Material, Matrix4 } from "cesium";

/** Illustrative close-up grain, shaded on the globe itself; it adds no terrain height. */
export function regolithMaterial(frame: Matrix4) {
  return new Material({
    fabric: {
      type: "LunarRegolith",
      uniforms: {
        worldToLocal: Matrix4.toArray(
          Matrix4.inverseTransformation(frame, new Matrix4()),
        ),
      },
      source: `
        float grainHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float grainNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(grainHash(i), grainHash(i + vec2(1, 0)), f.x),
                     mix(grainHash(i + vec2(0, 1)), grainHash(i + vec2(1, 1)), f.x), f.y);
        }
        czm_material czm_getMaterial(czm_materialInput inputData) {
          czm_material material = czm_getDefaultMaterial(inputData);
          vec3 local = (worldToLocal * czm_inverseView * vec4(-inputData.positionToEyeEC, 1.0)).xyz;
          float distanceToEye = length(inputData.positionToEyeEC);
          float fine = mix(grainNoise(local.xy * 7.0), 0.5, smoothstep(10.0, 80.0, distanceToEye));
          float grain = 0.24 + 0.19 * grainNoise(local.xy * 0.17) + 0.14 * grainNoise(local.xy * 1.2) + 0.13 * fine;
          material.diffuse = vec3(grain, grain * 0.98, grain * 0.94);
          material.alpha = 0.86 * (1.0 - smoothstep(350.0, 1800.0, distanceToEye));
          return material;
        }
      `,
    },
  });
}
