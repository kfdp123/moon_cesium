import type { LunarPoint } from "../types";

export function validUrl(value: string): boolean {
  return (
    value === "" || value.startsWith("/assets/") || /^https?:\/\//i.test(value)
  );
}

export function parsePoints(value: unknown): LunarPoint[] {
  const collection = value as { type?: string; features?: unknown[] };
  if (
    collection?.type !== "FeatureCollection" ||
    !Array.isArray(collection.features)
  )
    throw new Error("请选择 GeoJSON FeatureCollection 文件");
  if (collection.features.length > 10000)
    throw new Error("每次最多导入 10000 个点位");
  const ids = new Set<string>();
  return collection.features.map((value, index) => {
    const f = value as {
      geometry: { type: string; coordinates: number[] };
      properties: Partial<LunarPoint>;
    };
    if (f.geometry?.type !== "Point")
      throw new Error(`第 ${index + 1} 条不是 Point 点位`);
    const [longitude, latitude] = f.geometry.coordinates;
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > 90
    )
      throw new Error(`第 ${index + 1} 条经纬度超出范围`);
    const p = f.properties;
    if (!p || typeof p.name !== "string" || !p.name.trim())
      throw new Error(`第 ${index + 1} 条缺少名称`);
    const point: LunarPoint = {
      id: String(p.id || crypto.randomUUID()),
      name: p.name,
      longitude,
      latitude,
      category: String(p.category || "自定义"),
      description: String(p.description || ""),
      source: String(p.source || ""),
      visible: p.visible !== false,
      images: p.images || [],
      modelUrl: String(p.modelUrl || ""),
      references: p.references || [],
      links: p.links || [],
    };
    for (const list of [point.images, point.references, point.links]) {
      if (
        !Array.isArray(list) ||
        list.some(
          (link) =>
            typeof link.title !== "string" ||
            typeof link.url !== "string" ||
            !validUrl(link.url),
        )
      )
        throw new Error(`${point.name} 的素材链接格式不正确`);
    }
    if (!validUrl(point.source) || !validUrl(point.modelUrl))
      throw new Error(`${point.name} 包含不支持的链接协议`);
    if (ids.has(point.id)) throw new Error(`重复点位 ID：${point.id}`);
    ids.add(point.id);
    return point;
  });
}

export function pointsGeoJson(points: LunarPoint[]) {
  return {
    type: "FeatureCollection",
    name: "Moon / east longitude / planetocentric latitude",
    features: points.map(({ longitude, latitude, ...properties }) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [longitude, latitude] },
      properties,
    })),
  };
}

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
