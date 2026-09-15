import { expect, it } from "vitest";
import { ROVER_ROUTE_LENGTH, roverRoute } from "./roverRoute";
it("closes the route smoothly and stays outside the habitat", () => {
  expect(roverRoute(0)).toEqual(roverRoute(ROVER_ROUTE_LENGTH));
  const end = roverRoute(ROVER_ROUTE_LENGTH - 0.01),
    start = roverRoute(0.01);
  expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(0.02, 3);
  for (let d = 0; d < ROVER_ROUTE_LENGTH; d += 2) {
    const a = roverRoute(d),
      b = roverRoute(d + 1);
    expect(a.y).toBeLessThan(-100);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(1, 2);
    expect(Number.isFinite(a.heading)).toBe(true);
  }
});
