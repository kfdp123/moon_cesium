// Closed demonstration route in local east/north meters, outside the base buildings.
const count = 256;
const angles = Array.from(
  { length: count + 1 },
  (_, i) => (i / count) * Math.PI * 2,
);
const point = (angle: number) => ({
  x: 120 * Math.cos(angle),
  y: -180 + 75 * Math.sin(angle),
});
const lengths = [0];
for (let i = 1; i <= count; i++) {
  const a = point(angles[i - 1]),
    b = point(angles[i]);
  lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
}
export const ROVER_ROUTE_LENGTH = lengths[count];
export function roverRoute(distance: number) {
  const d =
    ((distance % ROVER_ROUTE_LENGTH) + ROVER_ROUTE_LENGTH) % ROVER_ROUTE_LENGTH;
  const i = lengths.findIndex((value) => value > d) - 1;
  const angle =
    angles[i] +
    ((angles[i + 1] - angles[i]) * (d - lengths[i])) /
      (lengths[i + 1] - lengths[i]);
  return {
    ...point(angle),
    heading: Math.atan2(-120 * Math.sin(angle), 75 * Math.cos(angle)),
  };
}
