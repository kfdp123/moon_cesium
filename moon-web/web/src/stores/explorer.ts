import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { epochs } from "../data/moon";
import type { CutawayMode, LayerId, SceneMode, SceneState } from "../types";

export const useExplorer = defineStore("explorer", () => {
  const mode = ref<SceneMode>("surface");
  const cutaway = ref<CutawayMode>("quarter");
  const epochIndex = ref(3);
  const selectedLayer = ref<LayerId | null>(null);
  const selectedLandmark = ref<string | null>(null);
  const hiddenLayers = ref<LayerId[]>([]);
  const showGrid = ref(false);
  const showLandmarks = ref(true);
  const epoch = computed(() => epochs[epochIndex.value]);
  const selection = computed(() =>
    epoch.value.layers.find((layer) => layer.id === selectedLayer.value),
  );
  const sceneState = computed<SceneState>(() => ({
    mode: mode.value,
    cutaway: cutaway.value,
    layers: epoch.value.layers,
    hiddenLayers: hiddenLayers.value,
    selectedLayer: selectedLayer.value,
    showGrid: showGrid.value,
    showLandmarks: showLandmarks.value,
  }));

  function setMode(value: SceneMode) {
    mode.value = value;
    selectedLandmark.value = null;
    selectedLayer.value = null;
  }

  function setEpoch(index: number) {
    epochIndex.value = index;
    hiddenLayers.value = [];
    selectedLayer.value = null;
  }

  function toggleLayer(id: LayerId) {
    hiddenLayers.value = hiddenLayers.value.includes(id)
      ? hiddenLayers.value.filter((value) => value !== id)
      : [...hiddenLayers.value, id];
    if (hiddenLayers.value.includes(id) && selectedLayer.value === id)
      selectedLayer.value = null;
  }

  return {
    mode,
    cutaway,
    epochIndex,
    epoch,
    selectedLayer,
    selectedLandmark,
    selection,
    hiddenLayers,
    showGrid,
    showLandmarks,
    sceneState,
    setMode,
    setEpoch,
    toggleLayer,
  };
});
