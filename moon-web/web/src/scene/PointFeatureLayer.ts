import {
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  DistanceDisplayCondition,
  Entity,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  PolygonHierarchy,
  PolylineDashMaterialProperty,
  SceneTransforms,
  VerticalOrigin,
  Viewer,
} from "cesium";
import type { LunarPoint } from "../types";
import regions from "../data/pointRegions.json";

const featured = [
  "apollo11",
  "change3",
  "usgs-3691",
  "usgs-3678",
  "usgs-6163",
  "usgs-1296",
  "yutu",
];
const colors: Record<string, string> = {
  着陆点: "#f3c676",
  巡视器: "#f3c676",
  月海: "#6dd6d3",
  环形山: "#b5b7ff",
};
const paths: Record<string, string> = {
  着陆点:
    '<path d="m13 24 5-9h12l5 9M16 24h16M19 15V9h10v6M12 24l-4 9h8m20-9 4 9h-8M24 9V5"/>',
  巡视器:
    '<path d="M12 21h22v8H12zm6 0v-7h11m-1 0V8m-3 0h7M9 29h30"/><circle cx="15" cy="32" r="3"/><circle cx="32" cy="32" r="3"/>',
  月海: '<path d="M10 27c5-9 6 5 12-4s7 5 15-3M11 19c5-8 8 4 13-4s7 4 13-2M13 34c7-7 8 3 15-3s5 0 8-1"/>',
  环形山:
    '<ellipse cx="24" cy="25" rx="15" ry="10"/><path d="m12 25 5 3 5-9 5 8 5-3 4 1M13 14l4-3m16 1 3 3M24 7v4"/>',
};
const icons = new Map<string, string>();
function markerImage(category: string, selected: boolean) {
  const key = `${category}:${selected}`;
  if (!icons.has(key)) {
    const color = colors[category] ?? "#92cae6";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${selected ? "#16394a" : "#101e2a"}" fill-opacity=".95" stroke="${color}" stroke-opacity="${selected ? 1 : 0.7}" stroke-width="${selected ? 2.5 : 1.3}"/><g fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[category] ?? '<circle cx="24" cy="24" r="7"/>'}</g></svg>`;
    icons.set(key, `data:image/svg+xml,${encodeURIComponent(svg)}`);
  }
  return icons.get(key)!;
}

export interface PointHover {
  id: string;
  x: number;
  y: number;
}
interface Marker {
  point: LunarPoint;
  entity: Entity;
}
interface Region {
  id: string;
  area: Entity;
  line: Entity;
}

/** Science overlays share point IDs, so icons, region fills and outlines open one exhibit. */
export class PointFeatureLayer {
  private markers: Marker[] = [];
  private areas: Region[] = [];
  private entities: Entity[] = [];
  private route?: Entity;
  private selected: string | null = null;
  private enabled = true;
  private themeIds: string[] = [];
  private removeLayoutListener: () => void;
  private layoutKey = "";

  constructor(private viewer: Viewer) {
    this.removeLayoutListener = viewer.scene.preRender.addEventListener(() =>
      this.layout(),
    );
  }

  configure(
    points: LunarPoint[],
    retained: (longitude: number, latitude: number) => boolean,
  ) {
    this.clearEntities();
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    for (const point of points) {
      if (!point.visible || !retained(point.longitude, point.latitude))
        continue;
      const color = Color.fromCssColorString(
        colors[point.category] ?? "#92cae6",
      );
      const entity = this.add({
        id: `landmark:${point.id}`,
        position: Cartesian3.fromDegrees(
          point.longitude,
          point.latitude,
          0,
          ellipsoid,
        ),
        billboard: {
          image: markerImage(point.category, point.id === this.selected),
          width: 34,
          height: 34,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          verticalOrigin: VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: point.name
            .replace("号着陆点", "号")
            .replace("（LROC 记录位置）", ""),
          font: "600 16px sans-serif",
          fillColor: color,
          outlineColor: Color.fromCssColorString("#06121c"),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(24, 0),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.markers.push({ point, entity });
      const region = regions.find((item) => item.id === point.id);
      if (!region) continue;
      for (const [index, polygon] of region.coordinates.entries()) {
        const ring = polygon[0]!;
        const positions = Cartesian3.fromDegreesArray(ring.flat(), ellipsoid);
        const area = this.add({
          id: `poi-area:${point.id}:${index}`,
          polygon: {
            hierarchy: new PolygonHierarchy(
              positions,
              polygon
                .slice(1)
                .map(
                  (hole) =>
                    new PolygonHierarchy(
                      Cartesian3.fromDegreesArray(hole.flat(), ellipsoid),
                    ),
                ),
            ),
            material: color.withAlpha(point.category === "月海" ? 0.09 : 0.12),
          },
        });
        const line = this.add({
          id: `poi-line:${point.id}:${index}`,
          polyline: {
            positions,
            width: 1.5,
            clampToGround: true,
            material: color.withAlpha(0.62),
          },
        });
        this.areas.push({ id: point.id, area, line });
      }
    }
    this.buildRoute();
    this.select(this.selected);
    this.layoutKey = "";
  }

  private add(options: ConstructorParameters<typeof Entity>[0]) {
    const entity = this.viewer.entities.add(options!);
    this.entities.push(entity);
    return entity;
  }

  pointId(entityId: string): string | null {
    if (entityId.startsWith("landmark:")) return entityId.slice(9);
    if (entityId.startsWith("poi-area:") || entityId.startsWith("poi-line:"))
      return entityId.split(":")[1]!;
    return null;
  }

  select(id: string | null) {
    this.selected = id;
    for (const { point, entity } of this.markers) {
      entity.billboard!.image = new ConstantProperty(
        markerImage(point.category, point.id === id),
      );
      entity.billboard!.width = new ConstantProperty(point.id === id ? 42 : 34);
      entity.billboard!.height = new ConstantProperty(
        point.id === id ? 42 : 34,
      );
    }
    for (const region of this.areas) {
      const point = this.markers.find(
        (item) => item.point.id === region.id,
      )!.point;
      const color = Color.fromCssColorString(
        colors[point.category] ?? "#92cae6",
      );
      region.area.polygon!.material = new ColorMaterialProperty(
        color.withAlpha(region.id === id ? 0.23 : 0.075),
      );
      region.line.polyline!.material = new ColorMaterialProperty(
        color.withAlpha(region.id === id ? 1 : 0.55),
      );
      region.line.polyline!.width = new ConstantProperty(
        region.id === id ? 2.8 : 1.4,
      );
    }
    this.layoutKey = "";
    this.viewer.scene.requestRender();
  }

  setTheme(ids: string[]) {
    this.themeIds = ids;
    this.buildRoute();
    this.layoutKey = "";
    this.viewer.scene.requestRender();
  }
  private buildRoute() {
    if (this.route) this.viewer.entities.remove(this.route);
    this.route = undefined;
    const points = this.themeIds
      .map((id) => this.markers.find((item) => item.point.id === id)?.point)
      .filter((point): point is LunarPoint => Boolean(point));
    if (points.length < 2) return;
    this.route = this.viewer.entities.add({
      id: "science-tour-route",
      polyline: {
        positions: Cartesian3.fromDegreesArray(
          points.flatMap((point) => [point.longitude, point.latitude]),
          this.viewer.scene.globe.ellipsoid,
        ),
        clampToGround: true,
        width: 2.5,
        material: new PolylineDashMaterialProperty({
          color: Color.fromCssColorString("#f3c676"),
          dashLength: 18,
        }),
        distanceDisplayCondition: new DistanceDisplayCondition(
          50000,
          Number.POSITIVE_INFINITY,
        ),
      },
      show: this.enabled,
    });
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    for (const entity of this.entities) entity.show = enabled;
    if (this.route) this.route.show = enabled;
    this.layoutKey = "";
  }

  private layout() {
    if (!this.enabled) return;
    const { camera, scene, clock } = this.viewer;
    const key = [
      ...Cartesian3.pack(camera.positionWC, []),
      ...Cartesian3.pack(camera.directionWC, []),
      scene.canvas.clientWidth,
      scene.canvas.clientHeight,
    ].join(",");
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    // Regional tint belongs to the map view; close-up equipment and terrain keep their natural material colors.
    for (const region of this.areas) {
      region.area.show = camera.positionCartographic.height > 80000;
      region.line.show = camera.positionCartographic.height > 1500;
    }
    const occupied: { x: number; y: number; width: number; height: number }[] =
      [];
    const icons: Cartesian2[] = [];
    const near =
      camera.positionCartographic.height <
      scene.globe.ellipsoid.maximumRadius * 0.7;
    const ordered = [...this.markers].sort((a, b) => {
      const priority = (point: LunarPoint) =>
        point.id === this.selected
          ? -2
          : featured.includes(point.id)
            ? featured.indexOf(point.id)
            : 99;
      return priority(a.point) - priority(b.point);
    });
    for (const { point, entity } of ordered) {
      const position = entity.position!.getValue(clock.currentTime)!;
      const pixel = SceneTransforms.worldToWindowCoordinates(scene, position);
      const facingCamera =
        Cartesian3.dot(
          position,
          Cartesian3.subtract(camera.positionWC, position, new Cartesian3()),
        ) > 0;
      const onScreen =
        pixel &&
        facingCamera &&
        pixel.x > 85 &&
        pixel.x < scene.canvas.clientWidth - 20 &&
        pixel.y > 95 &&
        pixel.y < scene.canvas.clientHeight - 95;
      const visible = Boolean(
        onScreen &&
          !icons.some((other) => Cartesian2.distance(other, pixel!) < 36),
      );
      entity.billboard!.show = new ConstantProperty(visible);
      entity.label!.show = new ConstantProperty(false);
      if (!visible) continue;
      icons.push(pixel!);
      if (!near && !featured.includes(point.id) && point.id !== this.selected)
        continue;
      const text = entity.label!.text!.getValue(clock.currentTime) as string;
      const width = Math.min(240, text.length * 16);
      for (const offset of [
        new Cartesian2(24, 0),
        new Cartesian2(24, -27),
        new Cartesian2(24, 27),
        new Cartesian2(-width - 24, 0),
      ]) {
        const box = {
          x: pixel!.x + offset.x,
          y: pixel!.y + offset.y - 12,
          width,
          height: 24,
        };
        if (
          box.x < 95 ||
          box.x + width > scene.canvas.clientWidth - 20 ||
          occupied.some(
            (other) =>
              box.x < other.x + other.width + 8 &&
              box.x + box.width + 8 > other.x &&
              box.y < other.y + other.height + 7 &&
              box.y + box.height + 7 > other.y,
          )
        )
          continue;
        entity.label!.pixelOffset = new ConstantProperty(offset);
        entity.label!.show = new ConstantProperty(true);
        occupied.push(box);
        break;
      }
    }
  }

  private clearEntities() {
    for (const entity of this.entities) this.viewer.entities.remove(entity);
    this.entities = [];
    this.markers = [];
    this.areas = [];
    if (this.route) this.viewer.entities.remove(this.route);
    this.route = undefined;
  }
  dispose() {
    this.removeLayoutListener();
    this.clearEntities();
  }
}
