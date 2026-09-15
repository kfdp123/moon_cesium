import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { epochs } from "../data/moon";
import type { CutawayMode, LayerId, MoonLayer, SceneState } from "../types";

export const useExplorer = defineStore("explorer", () => {
  const cutaway = ref<CutawayMode>("full");
  const epochIndex = ref(3);
  const savedModels = ref<Record<string, MoonLayer[]>>({});
  const drafts: Record<string, MoonLayer[]> = {};
  function rememberModel() {
    drafts[epoch.value.id] = JSON.parse(JSON.stringify(layers.value));
  }
  const layers = ref<MoonLayer[]>(structuredClone(epochs[3].layers));
  const selectedLayer = ref<LayerId | null>(null);
  const selectedLandmark = ref<string | null>(null);
  const hiddenLayers = ref<LayerId[]>([]);
  const showGrid = ref(false);
  const showLandmarks = ref(true);
  const epoch = computed(() => epochs[epochIndex.value]);
  const radiusKm = computed(() => layers.value[0].outerRadiusKm);
  const selection = computed(() =>
    layers.value.find((layer) => layer.id === selectedLayer.value),
  );
  const sceneState = computed<Omit<SceneState, "points">>(() => ({
    radiusKm: radiusKm.value,
    cutaway: cutaway.value,
    layers: layers.value,
    hiddenLayers: hiddenLayers.value,
    selectedLayer: selectedLayer.value,
    showGrid: showGrid.value,
    showLandmarks: showLandmarks.value,
  }));

  function setEpoch(index: number) {
    epochIndex.value = index;
    layers.value = JSON.parse(
      JSON.stringify(
        drafts[epochs[index].id] ||
          savedModels.value[epochs[index].id] ||
          epochs[index].layers,
      ),
    );
    hiddenLayers.value = [];
    selectedLayer.value = null;
  }
  function setRadius(value: number) {
    if (!Number.isFinite(value) || value < 100 || value > 10000)
      throw new Error("总半径需在 100–10000 km 之间");
    const scale = value / radiusKm.value;
    layers.value = layers.value.map((layer) => ({
      ...layer,
      innerRadiusKm: layer.innerRadiusKm * scale,
      outerRadiusKm: layer.outerRadiusKm * scale,
    }));
  }
  function saveModel() {
    rememberModel();
    savedModels.value[epoch.value.id] = JSON.parse(
      JSON.stringify(layers.value),
    );
    localStorage.setItem("moon-models-v1", JSON.stringify(savedModels.value));
  }
  function restoreModel() {
    delete drafts[epoch.value.id];
    delete savedModels.value[epoch.value.id];
    localStorage.setItem("moon-models-v1", JSON.stringify(savedModels.value));
    setEpoch(epochIndex.value);
  }
  function loadModels() {
    const saved = localStorage.getItem("moon-models-v1");
    if (!saved) return;
    const models = JSON.parse(saved) as Record<string, MoonLayer[]>;
    for (const values of Object.values(models)) {
      if (!Array.isArray(values) || values.length < 1 || values.length > 8)
        throw new Error("保存的圈层数量不正确");
      const ids = new Set<string>();
      values.forEach((layer, index) => {
        if (
          typeof layer.id !== "string" ||
          ids.has(layer.id) ||
          typeof layer.name !== "string" ||
          !/^#[0-9a-f]{6}$/i.test(layer.color) ||
          !Number.isFinite(layer.outerRadiusKm) ||
          !Number.isFinite(layer.innerRadiusKm) ||
          layer.innerRadiusKm < 0 ||
          layer.outerRadiusKm <= layer.innerRadiusKm ||
          layer.outerRadiusKm > 10000 ||
          layer.innerRadiusKm !== (values[index + 1]?.outerRadiusKm || 0)
        )
          throw new Error("保存的圈层边界或属性不正确");
        ids.add(layer.id);
      });
    }
    savedModels.value = models;
    setEpoch(epochIndex.value);
  }
  function rebuild(thicknesses: { layer: MoonLayer; thickness: number }[]) {
    let radius = 0;
    layers.value = thicknesses
      .reverse()
      .map(({ layer, thickness }) => {
        const innerRadiusKm = radius;
        radius += thickness;
        return { ...layer, innerRadiusKm, outerRadiusKm: radius };
      })
      .reverse();
  }
  function setThickness(id: string, value: number) {
    if (!Number.isFinite(value) || value < 1 || value > 5000)
      throw new Error("圈层厚度需在 1–5000 km 之间");
    const values = layers.value.map((layer) => ({
      layer,
      thickness:
        layer.id === id ? value : layer.outerRadiusKm - layer.innerRadiusKm,
    }));
    const total = values.reduce((sum, item) => sum + item.thickness, 0);
    if (total < 100 || total > 10000)
      throw new Error("总半径需在 100–10000 km 之间");
    rebuild(values);
  }
  function addLayer() {
    if (layers.value.length >= 8) throw new Error("演示模型最多支持 8 个圈层");
    if (radiusKm.value + 20 > 10000) throw new Error("总半径不能超过 10000 km");
    layers.value.unshift({
      id: crypto.randomUUID(),
      name: "新增圈层",
      english: "CUSTOM LAYER",
      innerRadiusKm: radiusKm.value,
      outerRadiusKm: radiusKm.value + 20,
      color: "#87b6bd",
      description: "自定义教学圈层。",
      composition: "示意",
    });
  }
  function removeLayer(id: string) {
    if (layers.value.length === 1) throw new Error("至少保留一个圈层");
    rebuild(
      layers.value
        .filter((layer) => layer.id !== id)
        .map((layer) => ({
          layer,
          thickness: layer.outerRadiusKm - layer.innerRadiusKm,
        })),
    );
    hiddenLayers.value = hiddenLayers.value.filter((value) => value !== id);
    selectedLayer.value = null;
  }
  function toggleLayer(id: LayerId) {
    hiddenLayers.value = hiddenLayers.value.includes(id)
      ? hiddenLayers.value.filter((value) => value !== id)
      : [...hiddenLayers.value, id];
    if (hiddenLayers.value.includes(id)) selectedLayer.value = null;
  }
  return {
    rememberModel,
    saveModel,
    restoreModel,
    loadModels,
    cutaway,
    epochIndex,
    epoch,
    layers,
    radiusKm,
    selectedLayer,
    selectedLandmark,
    hiddenLayers,
    showGrid,
    showLandmarks,
    selection,
    sceneState,
    setEpoch,
    setRadius,
    setThickness,
    addLayer,
    removeLayer,
    toggleLayer,
  };
});
