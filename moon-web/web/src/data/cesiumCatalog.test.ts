import { describe, expect, it } from "vitest";
import {
  parseCesiumGridMetadata,
  sampleCesiumGrid,
  type CesiumGridMetadata,
  type LoadedCesiumGrid,
} from "./cesiumCatalog";

function grid(
  rectangle: [number, number, number, number],
  values: number[],
  overrides: Partial<CesiumGridMetadata> = {},
): LoadedCesiumGrid {
  const [west, south, east, north] = rectangle;
  const metadata: CesiumGridMetadata = {
    name: "test",
    file: "test.bin",
    dtype: "float32",
    byteOrder: "little",
    rows: 2,
    cols: 4,
    rowOrder: "north_to_south",
    colOrder: "west_to_east",
    rectangle_deg: { west, south, east, north },
    cellsize_deg: [(east - west) / 4, (north - south) / 2],
    nodata: null,
    ...overrides,
  };
  return {
    layerId: "test",
    metadata,
    values: Float32Array.from(values),
    metadataUrl: "/data/test.json",
    binaryUrl: "/data/test.bin",
  };
}

describe("scientific Cesium grid sampling", () => {
  it("uses raster cell footprints from the north-west origin", () => {
    const data = grid([0, 0, 4, 2], [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sampleCesiumGrid(data, 0.5, 1.5)).toBe(1);
    expect(sampleCesiumGrid(data, 1, 1)).toBe(6);
    expect(sampleCesiumGrid(data, 3.999, 0.001)).toBe(8);
  });

  it("honors reversed row and column orders", () => {
    const data = grid([0, 0, 4, 2], [1, 2, 3, 4, 5, 6, 7, 8], {
      rowOrder: "south_to_north",
      colOrder: "east_to_west",
    });
    expect(sampleCesiumGrid(data, 0.5, 1.5)).toBe(8);
    expect(sampleCesiumGrid(data, 3.5, 0.5)).toBe(1);
  });

  it("wraps the global seam and accepts a regional antimeridian rectangle", () => {
    const global = grid([-180, -90, 180, 90], [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sampleCesiumGrid(global, -180, 89)).toBe(1);
    expect(sampleCesiumGrid(global, 180, 89)).toBe(1);
    expect(sampleCesiumGrid(global, 179.9, 89)).toBe(4);

    const regional = grid([170, -10, -170, 10], [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sampleCesiumGrid(regional, 175, 9)).toBe(2);
    expect(sampleCesiumGrid(regional, -175, 9)).toBe(4);
    expect(sampleCesiumGrid(regional, 0, 9)).toBeNull();
  });

  it("returns null for nodata and non-finite values", () => {
    const nodata = grid([0, 0, 4, 2], [1, -999, 3, 4, 5, 6, 7, 8], {
      nodata: -999,
    });
    expect(sampleCesiumGrid(nodata, 1.5, 1.5)).toBeNull();
    const nan = grid([0, 0, 4, 2], [Number.NaN, 2, 3, 4, 5, 6, 7, 8]);
    expect(sampleCesiumGrid(nan, 0.5, 1.5)).toBeNull();
  });
});

describe("scientific Cesium grid metadata", () => {
  it("accepts the generated Float32 little-endian header", () => {
    expect(
      parseCesiumGridMetadata({
        name: "test",
        file: "test.bin",
        dtype: "float32",
        byteOrder: "little",
        rows: 1,
        cols: 1,
        rowOrder: "north_to_south",
        colOrder: "west_to_east",
        rectangle_deg: { west: -180, south: -90, east: 180, north: 90 },
        cellsize_deg: [360, 180],
      }),
    ).toMatchObject({ rows: 1, cols: 1 });
  });

  it("rejects unsupported or impossible dimensions", () => {
    expect(() =>
      parseCesiumGridMetadata({
        dtype: "float64",
        byteOrder: "little",
        file: "x.bin",
        rows: 0,
        cols: 2,
        rowOrder: "north_to_south",
        colOrder: "west_to_east",
        rectangle_deg: { west: 0, south: 0, east: 1, north: 1 },
      }),
    ).toThrow(/元数据/);
  });
});
