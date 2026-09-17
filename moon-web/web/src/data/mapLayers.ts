import type { MapLayer } from "../types";
import { validUrl } from "./pointFiles";
import { SURFACE_TEXTURE_URL } from "./moon";
const trek = "https://trek.nasa.gov/tiles/Moon/EQ/";
export function parseMapLayers(value: unknown): MapLayer[] {
  if (!Array.isArray(value) || value.length > 40)
    throw new Error("图层配置必须是最多 40 项的列表");
  const ids = new Set<string>();
  for (const layer of value) {
    if (
      !layer ||
      typeof layer.id !== "string" ||
      ids.has(layer.id) ||
      typeof layer.name !== "string" ||
      !["image", "xyz", "terrain"].includes(layer.kind) ||
      typeof layer.url !== "string" ||
      !validUrl(layer.url) ||
      typeof layer.source !== "string" ||
      !validUrl(layer.source) ||
      !Number.isFinite(layer.opacity) ||
      layer.opacity < 0 ||
      layer.opacity > 1 ||
      !Number.isInteger(layer.maximumLevel) ||
      layer.maximumLevel < 0 ||
      layer.maximumLevel > 18
    )
      throw new Error("图层配置字段不正确");
    ids.add(layer.id);
  }
  return value;
}
function online(
  id: string,
  name: string,
  product: string,
  extension: string,
  maximumLevel: number,
  description: string,
): MapLayer {
  return {
    id,
    name,
    kind: "xyz",
    url: `${trek}${product}/1.0.0/default/default028mm/{z}/{y}/{x}.${extension}`,
    source: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon",
    description,
    visible: false,
    opacity: 1,
    maximumLevel,
  };
}
export const defaultMapLayers: MapLayer[] = [
  {
    id: "local-lro",
    name: "NASA LRO 展示影像",
    kind: "image",
    url: SURFACE_TEXTURE_URL,
    source: "https://svs.gsfc.nasa.gov/4720/",
    description: "NASA LRO 全球月表影像，8192 × 4096 像素。",
    visible: true,
    opacity: 1,
    maximumLevel: 0,
  },
  online(
    "wac",
    "LROC WAC 全球影像",
    "LRO_WAC_Mosaic_Global_303ppd_v02",
    "jpg",
    8,
    "NASA Trek 在线影像；现今月表。",
  ),
  online(
    "lola-color",
    "LOLA DEM 彩色晕渲",
    "LRO_LOLA_ClrShade_Global_256ppd_v06",
    "png",
    6,
    "高程着色的二维专题图，不改变地形高度。",
  ),
  online(
    "lola-shade",
    "LOLA DEM 阴影地形图",
    "LRO_LOLA_Shade_Global_256ppd_v06",
    "png",
    6,
    "高程派生的阴影图，不是影像照片。",
  ),
  online(
    "geology",
    "月球统一地质图",
    "Unified_Geologic_Map_of_the_Moon_RASTER",
    "png",
    5,
    "NASA Trek 托管的地质专题图；颜色表示地质单元。",
  ),
  {
    id: "lola-dem",
    name: "LOLA 三维高程 · 0.25°",
    kind: "terrain",
    url: "/assets/lola-dem.bin",
    source: "https://svs.gsfc.nasa.gov/4720/",
    description:
      "实际 LOLA 高程网格，参考半径 1737.4 km；全球演示分辨率，不能表现基地附近细节。",
    visible: false,
    opacity: 1,
    maximumLevel: 5,
  },
];
