import { describe, expect, it } from "vitest";
import { parsePoints, pointsGeoJson } from "./pointFiles";
const point = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [23.47297, 0.67408] },
  properties: {
    id: "apollo11",
    name: "Apollo 11",
    modelUrl: "/assets/apollo-lunar-module.glb",
    images: [{ title: "NASA", url: "https://example.org/image.jpg" }],
  },
};
describe("lunar point imports", () => {
  it("roundtrips coordinates and resources", () => {
    const data = parsePoints({ type: "FeatureCollection", features: [point] });
    expect(parsePoints(pointsGeoJson(data))).toEqual(data);
  });
  it("rejects coordinates outside the declared lunar convention", () => {
    expect(() =>
      parsePoints({
        type: "FeatureCollection",
        features: [
          { ...point, geometry: { type: "Point", coordinates: [350, 12] } },
        ],
      }),
    ).toThrow(/经纬度/);
  });
  it("rejects executable URLs and duplicate IDs", () => {
    expect(() =>
      parsePoints({
        type: "FeatureCollection",
        features: [
          {
            ...point,
            properties: { ...point.properties, source: "javascript:alert(1)" },
          },
        ],
      }),
    ).toThrow(/协议/);
    expect(() =>
      parsePoints({ type: "FeatureCollection", features: [point, point] }),
    ).toThrow(/重复/);
  });
});
