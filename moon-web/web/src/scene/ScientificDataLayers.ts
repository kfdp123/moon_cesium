import {
  ImageryLayer,
  Rectangle,
  SingleTileImageryProvider,
  type Ellipsoid,
  type Viewer,
} from "cesium";
import {
  DEFAULT_CESIUM_DATA_BASE,
  fetchCesiumCatalog,
  fetchCesiumGrid,
  findCesiumLayer,
  normalizeCesiumDataBase,
  resolveCesiumDataUrl,
  sampleCesiumGrid,
  type CesiumCatalog,
  type CesiumCatalogLayer,
  type LoadedCesiumGrid,
} from "../data/cesiumCatalog";

export interface ScientificQueryResult {
  id: string;
  title: string;
  longitude: number;
  latitude: number;
  value: number | null;
  units?: string;
  source?: string;
  note?: string;
  cellsize: [number, number];
}

export interface ScientificDataLayersOptions {
  baseUrl?: string;
  catalogUrl?: string;
  catalog?: CesiumCatalog;
  reportLayer?: (
    id: string,
    state: { loading: boolean; error?: string },
  ) => void;
}

export interface ScientificLayerState {
  id: string;
  opacity: number;
}

export interface ScientificLayerHandle {
  definition: CesiumCatalogLayer;
  imagery: ImageryLayer;
}

interface PendingLayer {
  ellipsoid: Ellipsoid;
  promise: Promise<ScientificLayerHandle | undefined>;
}

/** Owns scientific imagery and its lazy query-grid cache, separate from basemaps. */
export class ScientificDataLayers {
  private baseUrl: string;
  private catalog?: CesiumCatalog;
  private catalogRequest?: Promise<CesiumCatalog>;
  private readonly layers = new Map<string, ScientificLayerHandle>();
  private readonly pending = new Map<string, PendingLayer>();
  private readonly grids = new Map<string, Promise<LoadedCesiumGrid>>();
  private desired = new Map<string, number>();
  private ellipsoid: Ellipsoid;
  private revision = 0;
  private disposed = false;

  constructor(
    private readonly viewer: Viewer,
    private readonly options: ScientificDataLayersOptions = {},
  ) {
    const directory = options.catalogUrl?.slice(
      0,
      options.catalogUrl.lastIndexOf("/") + 1,
    );
    this.baseUrl = normalizeCesiumDataBase(
      options.baseUrl ?? directory ?? DEFAULT_CESIUM_DATA_BASE,
    );
    this.catalog = options.catalog;
    this.ellipsoid = viewer.scene.globe.ellipsoid;
  }

  loadCatalog(): Promise<CesiumCatalog> {
    return this.ensureCatalog();
  }

  async ensureCatalog(): Promise<CesiumCatalog> {
    if (this.catalog) return this.catalog;
    const request = this.catalogRequest ?? fetchCesiumCatalog(this.baseUrl);
    this.catalogRequest = request;
    try {
      const catalog = await request;
      if (this.catalogRequest === request) this.catalog = catalog;
      return catalog;
    } catch (cause) {
      if (this.catalogRequest === request) this.catalogRequest = undefined;
      throw cause;
    }
  }

  getCatalog(): CesiumCatalog | undefined {
    return this.catalog;
  }

  getDefinition(id: string): CesiumCatalogLayer | undefined {
    return this.catalog ? findCesiumLayer(this.catalog, id) : undefined;
  }

  getActiveLayers(): ScientificLayerHandle[] {
    return [...this.layers.values()];
  }

  /** The last requested selection wins, even when earlier PNGs finish later. */
  async apply(
    layers: ScientificLayerState[],
    catalog?: CesiumCatalog,
    baseUrl = this.baseUrl,
  ): Promise<void> {
    if (this.disposed) return;
    const nextBase = normalizeCesiumDataBase(baseUrl);
    if (nextBase !== this.baseUrl) {
      this.clearLayers();
      this.clearGridCache();
      this.catalog = undefined;
      this.catalogRequest = undefined;
      this.baseUrl = nextBase;
    }
    if (catalog) {
      this.catalog = catalog;
      this.catalogRequest = undefined;
    }
    if (this.ellipsoid !== this.viewer.scene.globe.ellipsoid) {
      this.clearLayers();
      this.ellipsoid = this.viewer.scene.globe.ellipsoid;
    }
    const revision = ++this.revision;
    this.desired = new Map(
      layers.map(({ id, opacity }) => [id, clampOpacity(opacity)]),
    );
    for (const id of this.layers.keys()) {
      if (!this.desired.has(id)) this.removeLayer(id);
    }
    if (!layers.length) return;
    await this.ensureCatalog();
    if (revision !== this.revision || this.disposed) return;
    const results = await Promise.allSettled(
      layers.map(({ id }) => this.ensureLayer(id)),
    );
    if (revision !== this.revision || this.disposed) return;
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) throw failure.reason;
    for (const { id } of layers) {
      const handle = this.layers.get(id);
      if (handle) this.viewer.imageryLayers.raiseToTop(handle.imagery);
    }
    this.viewer.scene.requestRender();
  }

  async addLayer(
    id: string,
    options: { opacity?: number; index?: number } = {},
  ): Promise<ScientificLayerHandle | undefined> {
    if (this.disposed) return;
    this.desired.set(id, clampOpacity(options.opacity ?? 1));
    await this.ensureCatalog();
    return this.ensureLayer(id, options.index);
  }

  removeLayer(id: string): boolean {
    const removed = this.desired.delete(id);
    this.options.reportLayer?.(id, { loading: false });
    return this.removeImagery(id) || removed;
  }

  /** Invalidates unfinished imagery loads as well as removing current layers. */
  clearLayers(): void {
    this.revision++;
    this.desired.clear();
    this.pending.clear();
    for (const id of [...this.layers.keys()]) this.removeImagery(id);
  }

  setOpacity(id: string, opacity: number): void {
    if (!this.desired.has(id)) return;
    const alpha = clampOpacity(opacity);
    this.desired.set(id, alpha);
    const handle = this.layers.get(id);
    if (handle) handle.imagery.alpha = alpha;
    this.viewer.scene.requestRender();
  }

  getOpacity(id: string): number | undefined {
    return this.desired.get(id);
  }

  async query(
    longitude: number,
    latitude: number,
    ids = [...this.layers.keys()],
  ): Promise<ScientificQueryResult[]> {
    const definitions = ids
      .map((id) => this.getDefinition(id))
      .filter((layer): layer is CesiumCatalogLayer => Boolean(layer?.grid));
    return Promise.all(
      definitions.map(async (definition) => {
        const grid = await this.loadGrid(definition);
        return {
          id: definition.id,
          title: definition.title,
          longitude,
          latitude,
          value: sampleCesiumGrid(grid, longitude, latitude),
          units: definition.units ?? grid.metadata.units,
          source: definition.source,
          note: definition.note,
          cellsize: grid.metadata.cellsize_deg,
        };
      }),
    );
  }

  async queryLayer(
    id: string,
    longitude: number,
    latitude: number,
  ): Promise<ScientificQueryResult | null> {
    return (await this.query(longitude, latitude, [id]))[0] ?? null;
  }

  clearGridCache(): void {
    this.grids.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.clearLayers();
    this.clearGridCache();
    this.catalogRequest = undefined;
  }

  private async ensureLayer(
    id: string,
    index?: number,
  ): Promise<ScientificLayerHandle | undefined> {
    if (this.disposed || !this.desired.has(id)) return;
    const active = this.layers.get(id);
    if (active && this.viewer.imageryLayers.contains(active.imagery)) {
      active.imagery.alpha = this.desired.get(id)!;
      return active;
    }
    if (active) this.layers.delete(id);
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const pending = this.pending.get(id);
    if (pending?.ellipsoid === ellipsoid) return pending.promise;
    const definition = this.getDefinition(id);
    if (!definition?.image) throw new Error(`科研图层不存在：${id}`);
    this.options.reportLayer?.(id, { loading: true });
    const promise = SingleTileImageryProvider.fromUrl(
      resolveCesiumDataUrl(definition.image, this.baseUrl),
      { rectangle: Rectangle.fromDegrees(...definition.rectangle), ellipsoid },
    )
      .then((provider) => {
        if (
          this.disposed ||
          !this.desired.has(id) ||
          this.pending.get(id)?.promise !== promise ||
          this.viewer.scene.globe.ellipsoid !== ellipsoid
        ) {
          this.options.reportLayer?.(id, { loading: false });
          return;
        }
        const imagery = new ImageryLayer(provider, {
          alpha: this.desired.get(id),
        });
        if (index === undefined) this.viewer.imageryLayers.add(imagery);
        else this.viewer.imageryLayers.add(imagery, index);
        const handle = { definition, imagery };
        this.layers.set(id, handle);
        this.options.reportLayer?.(id, { loading: false });
        this.viewer.scene.requestRender();
        return handle;
      })
      .catch((cause) => {
        this.options.reportLayer?.(id, {
          loading: false,
          error: cause instanceof Error ? cause.message : String(cause),
        });
        throw cause;
      });
    this.pending.set(id, { ellipsoid, promise });
    try {
      return await promise;
    } finally {
      if (this.pending.get(id)?.promise === promise) this.pending.delete(id);
    }
  }

  private removeImagery(id: string): boolean {
    const handle = this.layers.get(id);
    if (!handle) return false;
    this.viewer.imageryLayers.remove(handle.imagery, true);
    this.layers.delete(id);
    this.viewer.scene.requestRender();
    return true;
  }

  private async loadGrid(layer: CesiumCatalogLayer): Promise<LoadedCesiumGrid> {
    const key = resolveCesiumDataUrl(layer.grid!, this.baseUrl);
    const request = this.grids.get(key) ?? fetchCesiumGrid(layer, this.baseUrl);
    this.grids.set(key, request);
    try {
      return await request;
    } catch (cause) {
      if (this.grids.get(key) === request) this.grids.delete(key);
      throw cause;
    }
  }
}

function clampOpacity(value: number): number {
  return Math.max(0, Math.min(1, value));
}
