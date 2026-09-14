import {
  CustomHeightmapTerrainProvider,
  GeographicTilingScheme,
  Ellipsoid,
  Math as CesiumMath,
  Credit,
  type TerrainProvider,
} from "cesium";

const terrainGrids = new WeakMap<TerrainProvider, Int16Array>();

/** The same grid drives terrain tiles and surface walking, independent of tile loading/LOD. */
export function terrainHeightAt(
  provider: TerrainProvider,
  longitude: number,
  latitude: number,
) {
  const grid = terrainGrids.get(provider);
  return grid ? sampleElevation(grid, longitude, latitude) : 0;
}

// NASA's 1440×720 cell-centered, east-positive grid. Heights are signed meters.
export function sampleElevation(
  grid: Int16Array,
  longitude: number,
  latitude: number,
): number {
  const x = (((longitude + 180) / 360) * 1440 - 0.5 + 1440) % 1440;
  const y = Math.max(0, Math.min(719, ((90 - latitude) / 180) * 720 - 0.5));
  const x0 = Math.floor(x),
    x1 = (x0 + 1) % 1440,
    y0 = Math.floor(y),
    y1 = Math.min(719, y0 + 1);
  const dx = x - x0,
    dy = y - y0;
  return (
    (grid[y0 * 1440 + x0] * (1 - dx) + grid[y0 * 1440 + x1] * dx) * (1 - dy) +
    (grid[y1 * 1440 + x0] * (1 - dx) + grid[y1 * 1440 + x1] * dx) * dy
  );
}

export async function loadLunarTerrain(url: string, ellipsoid: Ellipsoid) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`高程加载失败：HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== 1440 * 720 * 2)
    throw new Error("高程网格尺寸不匹配");
  const grid = new Int16Array(buffer);
  const scheme = new GeographicTilingScheme({ ellipsoid });
  const provider = new CustomHeightmapTerrainProvider({
    width: 33,
    height: 33,
    tilingScheme: scheme,
    credit: new Credit("NASA / LOLA · 0.25° DEM"),
    callback: (x, y, level) => {
      const rectangle = scheme.tileXYToRectangle(x, y, level);
      const heights = new Float32Array(33 * 33);
      for (let row = 0; row < 33; row++)
        for (let column = 0; column < 33; column++) {
          const longitude = CesiumMath.toDegrees(
            rectangle.west + (rectangle.width * column) / 32,
          );
          const latitude = CesiumMath.toDegrees(
            rectangle.north - (rectangle.height * row) / 32,
          );
          heights[row * 33 + column] = sampleElevation(
            grid,
            longitude,
            latitude,
          );
        }
      return heights;
    },
  });
  terrainGrids.set(provider, grid);
  return provider;
}
