import type { CutawayMode } from "../types";

type Vector = [number, number, number];

export interface ShellMesh {
  positions: number[];
  normals: number[];
  indices: number[];
  surface: "shell" | "cap";
}

const TAU = Math.PI * 2;

function sphere(radius: number, latitude: number, longitude: number): Vector {
  const horizontal = radius * Math.cos(latitude);
  return [
    horizontal * Math.cos(longitude),
    horizontal * Math.sin(longitude),
    radius * Math.sin(latitude),
  ];
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function subtract(a: Vector, b: Vector): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function mesh(surface: ShellMesh["surface"]): ShellMesh {
  return { positions: [], normals: [], indices: [], surface };
}

// Explicit triangle normals keep curved surfaces smooth and cut faces flat.
function triangle(target: ShellMesh, vertices: Vector[], normals: Vector[]) {
  const face = cross(
    subtract(vertices[1], vertices[0]),
    subtract(vertices[2], vertices[0]),
  );
  if (Math.hypot(...face) < 1e-12) return; // Poles and the core center collapse to points.
  const order = dot(face, normals[0]) >= 0 ? [0, 1, 2] : [0, 2, 1];
  for (const index of order) {
    target.indices.push(target.positions.length / 3);
    target.positions.push(...vertices[index]);
    target.normals.push(...normals[index]);
  }
}

function curvedSurface(
  target: ShellMesh,
  radius: number,
  start: number,
  end: number,
  inward: boolean,
  segments: number,
) {
  const rows = Math.max(12, Math.floor(segments / 2));
  const columns = Math.max(12, Math.ceil((segments * (end - start)) / TAU));
  const direction = inward ? -1 : 1;
  for (let row = 0; row < rows; row++) {
    const bottom = -Math.PI / 2 + (Math.PI * row) / rows;
    const top = -Math.PI / 2 + (Math.PI * (row + 1)) / rows;
    for (let column = 0; column < columns; column++) {
      const left = start + ((end - start) * column) / columns;
      const right = start + ((end - start) * (column + 1)) / columns;
      const points = [
        sphere(radius, bottom, left),
        sphere(radius, bottom, right),
        sphere(radius, top, right),
        sphere(radius, top, left),
      ];
      const normals = points.map(
        (point) => point.map((value) => (direction * value) / radius) as Vector,
      );
      for (const indices of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        triangle(
          target,
          indices.map((index) => points[index]),
          indices.map((index) => normals[index]),
        );
      }
    }
  }
}

function cutFace(
  target: ShellMesh,
  innerRadius: number,
  outerRadius: number,
  longitude: number,
  direction: number,
  segments: number,
) {
  const normal: Vector = [
    -Math.sin(longitude) * direction,
    Math.cos(longitude) * direction,
    0,
  ];
  const rows = Math.max(12, Math.floor(segments / 2));
  for (let row = 0; row < rows; row++) {
    const bottom = -Math.PI / 2 + (Math.PI * row) / rows;
    const top = -Math.PI / 2 + (Math.PI * (row + 1)) / rows;
    const points = [
      sphere(innerRadius, bottom, longitude),
      sphere(outerRadius, bottom, longitude),
      sphere(outerRadius, top, longitude),
      sphere(innerRadius, top, longitude),
    ];
    for (const indices of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      triangle(
        target,
        indices.map((index) => points[index]),
        [normal, normal, normal],
      );
    }
  }
}

/** Build a closed radial layer. Quarter mode removes x > 0 && y > 0. */
export function buildShell(
  innerRadius: number,
  outerRadius: number,
  mode: CutawayMode,
  segments = 96,
  includeOuterSurface = true,
): ShellMesh[] {
  if (innerRadius < 0 || outerRadius <= innerRadius)
    throw new Error("圈层半径需要满足 0 ≤ 内半径 < 外半径");
  const [start, end] =
    mode === "full"
      ? [0, TAU]
      : mode === "half"
        ? [Math.PI / 2, Math.PI * 1.5]
        : [Math.PI / 2, TAU];
  const shell = mesh("shell");
  if (includeOuterSurface)
    curvedSurface(shell, outerRadius, start, end, false, segments);
  if (innerRadius > 0)
    curvedSurface(shell, innerRadius, start, end, true, segments);
  if (mode === "full") return [shell];

  const cap = mesh("cap");
  cutFace(cap, innerRadius, outerRadius, start, -1, segments);
  cutFace(cap, innerRadius, outerRadius, end, 1, segments);
  return [shell, cap];
}
