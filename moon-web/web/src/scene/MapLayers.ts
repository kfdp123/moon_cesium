import {
  EllipsoidTerrainProvider,
  GeographicTilingScheme,
  ImageryLayer,
  SingleTileImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
} from "cesium";
import type { MapLayer } from "../types";
import { loadLunarTerrain } from "./lunarTerrain";

export class MapLayers {
  private revision = 0;
  private signature = "";
  constructor(
    private viewer: Viewer,
    private report: (id: string, status: string) => void,
  ) {}
  async apply(layers: MapLayer[], force = false) {
    const signature = JSON.stringify(layers);
    if (this.signature === signature && !force) return;
    this.signature = signature;
    const revision = ++this.revision;
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    this.viewer.imageryLayers.removeAll();
    this.viewer.terrainProvider = new EllipsoidTerrainProvider({ ellipsoid });
    for (const layer of layers) {
      if (!layer.visible) {
        this.report(layer.id, "已关闭");
        continue;
      }
      this.report(layer.id, "加载中");
      try {
        if (layer.kind === "terrain") {
          const terrain = await loadLunarTerrain(layer.url, ellipsoid);
          if (revision !== this.revision) return;
          this.viewer.terrainProvider = terrain;
        } else {
          const provider =
            layer.kind === "image"
              ? await SingleTileImageryProvider.fromUrl(layer.url, {
                  ellipsoid,
                })
              : new UrlTemplateImageryProvider({
                  url: layer.url,
                  tilingScheme: new GeographicTilingScheme({ ellipsoid }),
                  maximumLevel: layer.maximumLevel,
                  credit: layer.name,
                });
          if (revision !== this.revision) return;
          provider.errorEvent.addEventListener(() =>
            this.report(layer.id, "部分瓦片加载失败，请检查网络或重试"),
          );
          this.viewer.imageryLayers.add(
            new ImageryLayer(provider, { alpha: layer.opacity }),
          );
        }
        this.report(
          layer.id,
          layer.kind === "xyz" ? "已连接 · 按视野请求瓦片" : "已加载",
        );
        this.viewer.scene.requestRender();
      } catch (cause) {
        if (revision === this.revision)
          this.report(layer.id, `加载失败：${String(cause)}`);
      }
    }
  }
  dispose() {
    this.revision++;
  }
}
