import { describe, expect, it } from "vitest";
import { buildShell, type ShellMesh } from "./shellGeometry";
import { epochs, MOON_RADIUS_KM } from "../data/moon";

function signedVolume(meshes: ShellMesh[]) {
  let volume = 0;
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.positions.length; index += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = mesh.positions.slice(
        index,
        index + 9,
      );
      volume +=
        (ax * (by * cz - bz * cy) +
          ay * (bz * cx - bx * cz) +
          az * (bx * cy - by * cx)) /
        6;
    }
  }
  return volume;
}

function edgeCounts(meshes: ShellMesh[]) {
  const edges = new Map<string, number>();
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.positions.length; index += 9) {
      const points = [0, 3, 6].map((offset) =>
        mesh.positions
          .slice(index + offset, index + offset + 3)
          .map((value) => Math.round(value * 1e8))
          .join(","),
      );
      for (const [a, b] of [
        [0, 1],
        [1, 2],
        [2, 0],
      ]) {
        const key = [points[a], points[b]].sort().join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
  }
  return [...edges.values()];
}

describe("closed radial shell geometry", () => {
  for (const mode of ["full", "half", "quarter"] as const) {
    for (const innerRadius of [0, 0.6]) {
      it(`${mode} closes every edge for inner radius ${innerRadius}`, () => {
        expect(
          new Set(edgeCounts(buildShell(innerRadius, 1, mode, 48))),
        ).toEqual(new Set([2]));
      });
    }
  }

  it("retains the expected volume with outward winding", () => {
    const full = signedVolume(buildShell(0.4, 1, "full", 96));
    expect(full).toBeCloseTo((4 / 3) * Math.PI * (1 - 0.4 ** 3), 1);
    expect(signedVolume(buildShell(0.4, 1, "half", 96)) / full).toBeCloseTo(
      0.5,
      6,
    );
    expect(signedVolume(buildShell(0.4, 1, "quarter", 96)) / full).toBeCloseTo(
      0.75,
      6,
    );
  });

  it("quarter mode contains no surface inside the removed quadrant", () => {
    const [surface] = buildShell(0.4, 1, "quarter", 48);
    for (let i = 0; i < surface.positions.length; i += 3) {
      expect(
        surface.positions[i] > 1e-8 && surface.positions[i + 1] > 1e-8,
      ).toBe(false);
    }
  });

  it("uses unit normals and finite coordinates", () => {
    for (const mesh of buildShell(0.3, 1, "quarter", 32)) {
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < mesh.normals.length; i += 3)
        expect(Math.hypot(...mesh.normals.slice(i, i + 3))).toBeCloseTo(1, 8);
    }
  });

  it("rejects inverted layer boundaries", () => {
    expect(() => buildShell(1, 0.5, "quarter")).toThrow();
    expect(() => buildShell(-1, 1, "full")).toThrow();
  });
});

describe("illustrative epoch configurations", () => {
  it("has contiguous layers from center to surface at every epoch", () => {
    for (const epoch of epochs) {
      const sorted = [...epoch.layers].sort(
        (a, b) => a.innerRadiusKm - b.innerRadiusKm,
      );
      expect(sorted[0].innerRadiusKm).toBe(0);
      expect(sorted.at(-1)!.outerRadiusKm).toBe(MOON_RADIUS_KM);
      for (let i = 1; i < sorted.length; i++)
        expect(sorted[i].innerRadiusKm).toBe(sorted[i - 1].outerRadiusKm);
    }
  });
  it("does not invent an inner core in the initial fixture", () => {
    expect(epochs[0].layers.some((layer) => layer.id === "inner-core")).toBe(
      false,
    );
  });
});
