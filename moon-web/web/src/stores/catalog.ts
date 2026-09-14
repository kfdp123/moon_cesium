import { ref } from "vue";
import { defineStore } from "pinia";
import { defaultMapLayers, parseMapLayers } from "../data/mapLayers";
import { parsePoints, pointsGeoJson } from "../data/pointFiles";
import type { LunarPoint, MapLayer } from "../types";

export const useCatalog = defineStore("catalog", () => {
  const points = ref<LunarPoint[]>([]);
  const mapLayers = ref<MapLayer[]>(structuredClone(defaultMapLayers));
  const error = ref("");
  const layerStatus = ref<Record<string, string>>({});
  async function load() {
    try {
      const savedMaps = localStorage.getItem("moon-maps-v1");
      if (savedMaps) mapLayers.value = parseMapLayers(JSON.parse(savedMaps));
    } catch (cause) {
      error.value = `已保留内置图层，保存的图层配置读取失败：${String(cause)}`;
    }
    try {
      const saved = localStorage.getItem("moon-points-v1");
      if (saved) points.value = parsePoints(JSON.parse(saved));
      else {
        const response = await fetch("/data/lunar-points.geojson");
        if (!response.ok)
          throw new Error(`点位目录加载失败：HTTP ${response.status}`);
        points.value = parsePoints(await response.json());
      }
    } catch (cause) {
      error.value = `点位未加载：${String(cause)}。可导入 GeoJSON 或恢复内置目录。`;
    }
  }
  function savePoints() {
    localStorage.setItem(
      "moon-points-v1",
      JSON.stringify(pointsGeoJson(points.value)),
    );
  }
  function saveMaps() {
    localStorage.setItem("moon-maps-v1", JSON.stringify(mapLayers.value));
  }
  function restoreMaps() {
    mapLayers.value = structuredClone(defaultMapLayers);
    localStorage.removeItem("moon-maps-v1");
  }
  function upsertPoint(point: LunarPoint) {
    const validated = parsePoints(pointsGeoJson([point]))[0];
    const index = points.value.findIndex((p) => p.id === validated.id);
    if (index === -1) points.value.push(validated);
    else points.value[index] = validated;
    savePoints();
  }
  function removePoint(id: string) {
    points.value = points.value.filter((p) => p.id !== id);
    savePoints();
  }
  async function restorePoints() {
    localStorage.removeItem("moon-points-v1");
    error.value = "";
    await load();
  }
  return {
    saveMaps,
    restoreMaps,
    points,
    mapLayers,
    error,
    layerStatus,
    load,
    savePoints,
    upsertPoint,
    removePoint,
    restorePoints,
  };
});
