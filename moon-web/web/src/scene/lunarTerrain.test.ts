import { expect, it } from "vitest";
import { sampleElevation } from "./lunarTerrain";
it("samples cell centers and interpolates continuously across the longitude seam", () => {
  const grid = new Int16Array(1440 * 720);
  grid.fill(100);
  grid[0] = 200;
  grid[1439] = 400;
  expect(sampleElevation(grid, -179.875, 89.875)).toBe(200);
  expect(sampleElevation(grid, -180, 90)).toBe(300);
  expect(sampleElevation(grid, 180, 90)).toBe(300);
  expect(sampleElevation(grid, 30, -90)).toBe(100);
});
