/**
 * Types and loading helpers for the scientific Cesium data package.
 *
 * The package is intentionally kept outside the application bundle.  A catalog
 * is fetched from a configurable static-data root and its large grids are
 * fetched only when a caller requests a sample.
 */

export const DEFAULT_CESIUM_DATA_BASE = "/data/cesium_data/";

export type CesiumDataPath = string;

export interface CesiumEllipsoid {
  cesium: string;
  radius_m: number;
}

export interface CesiumCatalogStats {
  min: number;
  max: number;
  mean: number;
}

export interface CesiumCatalogLayer {
  id: string;
  title: string;
  group: string;
  type: "imagery";
  units?: string;
  rectangle: [number, number, number, number];
  image: CesiumDataPath;
  legend?: CesiumDataPath | null;
  grid?: CesiumDataPath | null;
  geotiff?: CesiumDataPath | null;
  valueRange?: [number, number];
  colormap?: string;
  stats?: CesiumCatalogStats;
  source?: string;
  note?: string;
  batch?: number;
}

export interface CesiumGridRectangle {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface CesiumGridMetadata {
  name: string;
  file: string;
  dtype: "float32";
  byteOrder: "little" | "big";
  rows: number;
  cols: number;
  rowOrder: "north_to_south" | "south_to_north";
  colOrder: "west_to_east" | "east_to_west";
  rectangle_deg: CesiumGridRectangle;
  cellsize_deg: [number, number];
  units?: string;
  nodata?: number | null;
  min?: number;
  max?: number;
  mean?: number;
}

export interface CesiumInteriorCatalog {
  model: CesiumDataPath;
  posterior_samples?: CesiumDataPath;
  czml_shells?: CesiumDataPath;
  czml_cutaway?: CesiumDataPath;
  teaching_model?: CesiumDataPath;
}

export interface CesiumMagneticRegion {
  id: string;
  name: string;
  category: string;
  rectangle: [number, number, number, number];
  rectangle_lon0_360?: [number, number, number, number];
  n_obs?: number;
  bt_max_nT?: number;
  inversion?: {
    cellsize_deg?: number;
    depth_layers?: number;
    depth_range_km?: [number, number];
    M_max_A_m?: number;
    M_max_le60km?: number;
  };
  pointcloud?: {
    tileset: CesiumDataPath;
    n_points?: number;
    depth_max_km?: number;
    M_threshold?: number;
    batchAttribute?: string;
  };
  surface?: { bt?: CesiumDataPath; br?: CesiumDataPath };
  slices_legend?: CesiumDataPath;
  note?: string;
}

export interface CesiumMagneticCatalog {
  index: CesiumDataPath;
  regions: CesiumMagneticRegion[];
}

export interface CesiumRegionalEntry {
  id: string;
  title: string;
  rectangle: [number, number, number, number];
  n_layers?: number;
  region: CesiumDataPath;
}

export interface CesiumRegionalCatalog {
  index: CesiumDataPath;
  regions: CesiumRegionalEntry[];
}

export interface CesiumThermalCatalog {
  timeline: CesiumDataPath;
  n_frames: number;
  figures?: CesiumDataPath;
  n_figures?: number;
}

export interface CesiumCatalog {
  name: string;
  version: string;
  ellipsoid: CesiumEllipsoid;
  conventions?: Record<string, string>;
  groups: Record<string, string>;
  layers: CesiumCatalogLayer[];
  interior?: CesiumInteriorCatalog;
  magnetic?: CesiumMagneticCatalog;
  regional?: CesiumRegionalCatalog;
  thermal?: CesiumThermalCatalog;
}

export interface LoadedCesiumGrid {
  layerId: string;
  metadata: CesiumGridMetadata;
  values: Float32Array;
  metadataUrl: string;
  binaryUrl: string;
}

export function resolveCesiumDataUrl(
  path: string,
  base = DEFAULT_CESIUM_DATA_BASE,
): string {
  if (/^(?:[a-z]+:)?\//i.test(path)) return path;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function normalizeCesiumDataBase(
  base = DEFAULT_CESIUM_DATA_BASE,
): string {
  return base.endsWith("/") ? base : `${base}/`;
}

export function findCesiumLayer(
  catalog: CesiumCatalog,
  id: string,
): CesiumCatalogLayer | undefined {
  return catalog.layers.find((layer) => layer.id === id);
}

export function parseCesiumCatalog(value: unknown): CesiumCatalog {
  if (!value || typeof value !== "object")
    throw new Error("Cesium 数据目录格式无效");
  const catalog = value as Partial<CesiumCatalog>;
  if (
    typeof catalog.name !== "string" ||
    typeof catalog.version !== "string" ||
    !catalog.ellipsoid ||
    !Array.isArray(catalog.layers)
  )
    throw new Error("Cesium 数据目录缺少基础字段");
  const ids = new Set<string>();
  for (const layer of catalog.layers) {
    if (
      !layer ||
      typeof layer.id !== "string" ||
      ids.has(layer.id) ||
      typeof layer.title !== "string" ||
      typeof layer.group !== "string" ||
      layer.type !== "imagery" ||
      typeof layer.image !== "string" ||
      !Array.isArray(layer.rectangle) ||
      layer.rectangle.length !== 4 ||
      !layer.rectangle.every((value) => Number.isFinite(value))
    )
      throw new Error("Cesium 数据图层字段无效");
    ids.add(layer.id);
  }
  return catalog as CesiumCatalog;
}

export async function fetchCesiumCatalog(
  base = DEFAULT_CESIUM_DATA_BASE,
  fetcher: typeof fetch = fetch,
): Promise<CesiumCatalog> {
  const response = await fetcher(resolveCesiumDataUrl("catalog.json", base));
  if (!response.ok)
    throw new Error(`Cesium 数据目录加载失败：HTTP ${response.status}`);
  return parseCesiumCatalog(await response.json());
}

function gridBinaryUrl(metadataUrl: string, file: string): string {
  if (/^(?:[a-z]+:)?\//i.test(file)) return file;
  const directory = metadataUrl.slice(0, metadataUrl.lastIndexOf("/") + 1);
  return `${directory}${file.replace(/^\/+/, "")}`;
}

export function parseCesiumGridMetadata(value: unknown): CesiumGridMetadata {
  const metadata = value as Partial<CesiumGridMetadata> | null;
  const rectangle = metadata?.rectangle_deg;
  if (
    !metadata ||
    typeof metadata.file !== "string" ||
    metadata.dtype !== "float32" ||
    !["little", "big"].includes(metadata.byteOrder ?? "") ||
    !["north_to_south", "south_to_north"].includes(metadata.rowOrder ?? "") ||
    !["west_to_east", "east_to_west"].includes(metadata.colOrder ?? "") ||
    typeof metadata.name !== "string" ||
    !Number.isInteger(metadata.rows) ||
    !Number.isInteger(metadata.cols) ||
    (metadata.rows ?? 0) < 1 ||
    (metadata.cols ?? 0) < 1 ||
    !rectangle ||
    ![rectangle.west, rectangle.south, rectangle.east, rectangle.north].every(
      Number.isFinite,
    ) ||
    !Array.isArray(metadata.cellsize_deg) ||
    metadata.cellsize_deg.length !== 2 ||
    !metadata.cellsize_deg.every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    rectangle.north <= rectangle.south ||
    rectangle.west === rectangle.east ||
    Math.abs(rectangle.east - rectangle.west) > 360
  )
    throw new Error("科研网格元数据格式无效");
  return metadata as CesiumGridMetadata;
}

export async function fetchCesiumGrid(
  layer: CesiumCatalogLayer,
  base = DEFAULT_CESIUM_DATA_BASE,
  fetcher: typeof fetch = fetch,
): Promise<LoadedCesiumGrid> {
  if (!layer.grid) throw new Error(`图层 ${layer.id} 没有网格数据`);
  const metadataUrl = resolveCesiumDataUrl(layer.grid, base);
  const metadataResponse = await fetcher(metadataUrl);
  if (!metadataResponse.ok)
    throw new Error(`网格元数据加载失败：HTTP ${metadataResponse.status}`);
  const metadata = parseCesiumGridMetadata(await metadataResponse.json());
  const expected = metadata.rows * metadata.cols;
  const binaryResponse = await fetcher(
    gridBinaryUrl(metadataUrl, metadata.file),
  );
  if (!binaryResponse.ok)
    throw new Error(`网格数据加载失败：HTTP ${binaryResponse.status}`);
  const bytes = await binaryResponse.arrayBuffer();
  if (bytes.byteLength !== expected * 4)
    throw new Error(`网格数据长度不符：需要 ${expected * 4} 字节`);
  const values = new Float32Array(expected);
  const view = new DataView(bytes);
  const littleEndian = metadata.byteOrder !== "big";
  for (let index = 0; index < expected; index++)
    values[index] = view.getFloat32(index * 4, littleEndian);
  return {
    layerId: layer.id,
    metadata,
    values,
    metadataUrl,
    binaryUrl: gridBinaryUrl(metadataUrl, metadata.file),
  };
}

export function sampleCesiumGrid(
  grid: LoadedCesiumGrid,
  longitude: number,
  latitude: number,
): number | null {
  const { metadata } = grid;
  const { west, south, east, north } = metadata.rectangle_deg;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const width = east > west ? east - west : east + 360 - west;
  // Wrap equivalent longitudes into the grid's west-origin interval. This also
  // handles regional rectangles that cross the antimeridian (west > east).
  const longitudeOffset = (((longitude - west) % 360) + 360) % 360;
  if (longitudeOffset > width || latitude < south || latitude > north)
    return null;

  // cz_common.py/save_bin exports cell footprints, not endpoint sample nodes:
  // width/cols and height/rows match rasterio.from_bounds. Use exact bounds;
  // the header's cellsize_deg is rounded to six decimals. Include regional
  // east/south edges in the last cell; the global ±180° seam uses the first.
  const x = Math.min(
    metadata.cols - 1,
    Math.floor((longitudeOffset / width) * metadata.cols),
  );
  const northRow = Math.min(
    metadata.rows - 1,
    Math.floor(((north - latitude) / (north - south)) * metadata.rows),
  );
  const y =
    metadata.rowOrder === "south_to_north"
      ? metadata.rows - 1 - northRow
      : northRow;
  const col = metadata.colOrder === "east_to_west" ? metadata.cols - 1 - x : x;
  const value = grid.values[y * metadata.cols + col];
  if (
    metadata.nodata !== null &&
    metadata.nodata !== undefined &&
    value === metadata.nodata
  )
    return null;
  return Number.isFinite(value) ? value : null;
}
