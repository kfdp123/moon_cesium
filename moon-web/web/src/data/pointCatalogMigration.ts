import type { LunarPoint, ResourceLink } from "../types";

function comparablePoint(point: LunarPoint) {
  const links = (items: ResourceLink[]) =>
    items.map(({ title, url }) => [title, url]);
  return JSON.stringify([
    point.id,
    point.name,
    point.category,
    point.longitude,
    point.latitude,
    point.description,
    point.source,
    point.visible,
    links(point.images),
    point.modelUrl,
    links(point.references),
    links(point.links),
  ]);
}

/** Remove only unchanged entries retired from the bundled catalog. */
export function pruneRetiredPoints(
  saved: LunarPoint[],
  retired: LunarPoint[],
): LunarPoint[] {
  const baseline = new Map(
    retired.map((point) => [point.id, comparablePoint(point)]),
  );
  return saved.filter(
    (point) => baseline.get(point.id) !== comparablePoint(point),
  );
}
