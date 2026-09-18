import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  DEFAULT_CESIUM_DATA_BASE,
  fetchCesiumCatalog,
  findCesiumLayer,
  normalizeCesiumDataBase,
  type CesiumCatalog,
  type CesiumCatalogLayer,
} from "../data/cesiumCatalog";

/** Runtime state for the external scientific Cesium data package.
 *
 * It deliberately does not use the map-layer localStorage key. The scene owns
 * imagery and grid caches; this store keeps only catalog and UI state.
 */
export const useScienceData = defineStore("scienceData", () => {
  const catalog = ref<CesiumCatalog | null>(null);
  const baseUrl = ref(DEFAULT_CESIUM_DATA_BASE);
  const loading = ref(false);
  const error = ref("");
  const visible = ref<Record<string, boolean>>({});
  const opacity = ref<Record<string, number>>({});
  const layerLoading = ref<Record<string, boolean>>({});
  const layerErrors = ref<Record<string, string>>({});
  let pending: { base: string; promise: Promise<void> } | null = null;
  let loadRevision = 0;

  const layers = computed(() => catalog.value?.layers ?? []);
  const groups = computed(() => catalog.value?.groups ?? {});
  const visibleLayers = computed(() =>
    layers.value.filter((layer) => visible.value[layer.id]),
  );

  function load(nextBase = DEFAULT_CESIUM_DATA_BASE): Promise<void> {
    const requestedBase = normalizeCesiumDataBase(nextBase);
    if (pending?.base === requestedBase) return pending.promise;
    const revision = ++loadRevision;
    baseUrl.value = requestedBase;
    const promise = (async () => {
      loading.value = true;
      error.value = "";
      try {
        const loaded = await fetchCesiumCatalog(requestedBase);
        if (revision !== loadRevision) return;
        catalog.value = loaded;
        const nextVisibility: Record<string, boolean> = {};
        const nextOpacity: Record<string, number> = {};
        for (const layer of loaded.layers) {
          nextVisibility[layer.id] = false;
          nextOpacity[layer.id] = 1;
        }
        visible.value = nextVisibility;
        opacity.value = nextOpacity;
        layerErrors.value = {};
        layerLoading.value = {};
      } catch (cause) {
        if (revision !== loadRevision) return;
        catalog.value = null;
        visible.value = {};
        opacity.value = {};
        layerLoading.value = {};
        layerErrors.value = {};
        error.value = cause instanceof Error ? cause.message : String(cause);
      } finally {
        if (revision === loadRevision) loading.value = false;
      }
    })();
    pending = { base: requestedBase, promise };
    void promise.finally(() => {
      if (pending?.promise === promise) pending = null;
    });
    return promise;
  }

  function getLayer(id: string): CesiumCatalogLayer | undefined {
    return catalog.value ? findCesiumLayer(catalog.value, id) : undefined;
  }

  function setLayerVisible(id: string, isVisible: boolean) {
    if (!getLayer(id)) throw new Error(`未知科研图层：${id}`);
    visible.value = { ...visible.value, [id]: isVisible };
  }

  function toggleLayer(id: string) {
    setLayerVisible(id, !visible.value[id]);
  }

  function setLayerOpacity(id: string, value: number) {
    if (!getLayer(id)) throw new Error(`未知科研图层：${id}`);
    opacity.value = {
      ...opacity.value,
      [id]: Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1)),
    };
  }

  function setLayerLoading(id: string, value: boolean) {
    layerLoading.value = { ...layerLoading.value, [id]: value };
  }

  function setLayerError(id: string, message: string | null) {
    const next = { ...layerErrors.value };
    if (message) next[id] = message;
    else delete next[id];
    layerErrors.value = next;
  }

  return {
    catalog,
    baseUrl,
    loading,
    error,
    layers,
    groups,
    visible,
    visibleLayers,
    opacity,
    layerLoading,
    layerErrors,
    load,
    getLayer,
    setLayerVisible,
    toggleLayer,
    setLayerOpacity,
    setLayerLoading,
    setLayerError,
  };
});

/** Descriptive alias used by scene integrations. */
export const useScientificData = useScienceData;
