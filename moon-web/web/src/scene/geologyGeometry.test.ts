import { describe, expect, it } from "vitest";
import {
  craterSurface,
  makeSlab,
  plainSurface,
  shieldSurface,
} from "./geologyGeometry";

describe("lunar block geometry", () => {
  it("closes all edges with outward normals and positive volume", () => {
    const mesh = makeSlab(
      () => 1,
      () => -3,
      8,
    );
    const edges = new Map<string, number>();
    let volume = 0;
    for (let offset = 0; offset < mesh.positions.length; offset += 9) {
      const a = mesh.positions.slice(offset, offset + 3),
        b = mesh.positions.slice(offset + 3, offset + 6),
        c = mesh.positions.slice(offset + 6, offset + 9);
      const n = mesh.normals.slice(offset, offset + 3);
      expect(Math.hypot(...n)).toBeCloseTo(1);
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const key = [p!.join(","), q!.join(",")].sort().join("|");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      volume +=
        (a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) +
          a[1]! * (b[2]! * c[0]! - b[0]! * c[2]!) +
          a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)) /
        6;
    }
    expect([...edges.values()].every((count) => count === 2)).toBe(true);
    expect(volume).toBeCloseTo(12 * 9 * 4);
  });
  it("keeps the crater cut above the lower boundary and distinguishes relief", () => {
    for (const height of [plainSurface, shieldSurface, craterSurface]) {
      const mesh = makeSlab(height, () => -2.1, 24);
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      expect(mesh.normals.every(Number.isFinite)).toBe(true);
      expect(mesh.st.every((value) => value >= 0 && value <= 1)).toBe(true);
      for (let x = -6; x <= 6; x += 0.2)
        for (let y = -4.5; y <= 4.5; y += 0.2)
          expect(height(x, y)).toBeGreaterThan(-2.1);
    }
    expect(shieldSurface(-1.2, -4.5)).toBeGreaterThan(
      plainSurface(-1.2, -4.5) + 0.8,
    );
    expect(craterSurface(1.8, -4.5)).toBeLessThan(
      plainSurface(1.8, -4.5) - 0.5,
    );
    expect(craterSurface(3.5, -4.5)).toBeGreaterThan(
      plainSurface(3.5, -4.5) + 0.1,
    );
  });
});
