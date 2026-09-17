/** 局部展台坐标（非地理坐标、非等比例）。x/y 为平面，z 向上。 */
export type HeightField = (x: number, y: number) => number;
export interface RockMesh {
  positions: number[];
  normals: number[];
  st: number[];
  indices: number[];
}
export const BLOCK = { width: 12, depth: 9, bottom: -3.8 };
const SURFACE_RESOLUTION = 48;
const noise = (x: number, y: number) =>
  0.045 * Math.sin(x * 3.1 + y * 1.7) * Math.cos(y * 4.3 - x) +
  0.025 * Math.cos(x * 9 + y * 7);
export const plainSurface: HeightField = (x, y) => 0.22 + noise(x, y);
export const shieldSurface: HeightField = (x, y) => {
  const r = Math.hypot(x + 1.2, (y + 4.5) * 1.05);
  return (
    plainSurface(x, y) +
    1.28 * Math.exp((-r * r) / 7) -
    0.28 * Math.exp((-r * r) / 0.24)
  );
};
export const craterSurface: HeightField = (x, y) => {
  const r = Math.hypot(x - 0.65, y + 4.5);
  const bowl = -0.95 * Math.exp(-Math.pow(r / 2.5, 4));
  const rim = 0.58 * Math.exp(-Math.pow((r - 2.85) / 0.4, 2));
  const peak = 0.72 * Math.exp((-r * r) / 0.22);
  return plainSurface(x, y) + bowl + rim + peak;
};

/** 独立三角面保留岩石棱面；六面闭合，不依赖模型加载器修补法线。 */
export function makeSlab(
  top: HeightField,
  bottom: HeightField,
  resolution = SURFACE_RESOLUTION,
): RockMesh {
  const mesh: RockMesh = { positions: [], normals: [], st: [], indices: [] };
  type Vec = [number, number, number];
  function triangle(a: Vec, b: Vec, c: Vec) {
    const u = b.map((v, i) => v - a[i]!) as Vec;
    const v = c.map((n, i) => n - a[i]!) as Vec;
    const n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const length = Math.hypot(...n);
    for (const p of [a, b, c]) {
      mesh.indices.push(mesh.positions.length / 3);
      mesh.positions.push(...p);
      mesh.normals.push(...n.map((value) => value / length));
      // Cesium 压缩纹理坐标要求位于 [0,1]，超出范围会在块体中部产生接缝。
      mesh.st.push((p[0] + 6) / 12, (p[1] + p[2] * 2 + 13) / 22);
    }
  }
  const point = (i: number, j: number, height: HeightField): Vec => {
    const x = -6 + (i * 12) / resolution,
      y = -4.5 + (j * 9) / resolution;
    return [x, y, height(x, y)];
  };
  for (let j = 0; j < resolution; j++)
    for (let i = 0; i < resolution; i++) {
      const a = point(i, j, top),
        b = point(i + 1, j, top),
        c = point(i + 1, j + 1, top),
        d = point(i, j + 1, top);
      triangle(a, b, c);
      triangle(a, c, d);
      const e = point(i, j, bottom),
        f = point(i + 1, j, bottom),
        g = point(i + 1, j + 1, bottom),
        h = point(i, j + 1, bottom);
      triangle(e, g, f);
      triangle(e, h, g);
    }
  // 沿逆时针边界连接上下表面，外法线指向块体外侧。
  for (let side = 0; side < 4; side++)
    for (let k = 0; k < resolution; k++) {
      const edge = (t: number): [number, number] =>
        side === 0
          ? [t, 0]
          : side === 1
            ? [resolution, t]
            : side === 2
              ? [resolution - t, resolution]
              : [0, resolution - t];
      const [i, j] = edge(k),
        [u, v] = edge(k + 1);
      const a = point(i, j, top),
        b = point(u, v, top),
        c = point(u, v, bottom),
        d = point(i, j, bottom);
      triangle(a, c, b);
      triangle(a, d, c);
    }
  return mesh;
}

/** 火山坡面上的一条熔岩流，贴合地形而非悬浮在剖面上。 */
export function makeLavaFlow(): RockMesh {
  const mesh: RockMesh = { positions: [], normals: [], st: [], indices: [] };
  // 对实际三角网插值，避免解析曲面与离散地形之间出现穿插。
  const terrainHeight: HeightField = (x, y) => {
    const u = ((x + 6) / 12) * SURFACE_RESOLUTION;
    const v = ((y + 4.5) / 9) * SURFACE_RESOLUTION;
    const i = Math.floor(u),
      j = Math.floor(v),
      a = u - i,
      b = v - j;
    const h = (dx: number, dy: number) =>
      shieldSurface(
        -6 + ((i + dx) * 12) / SURFACE_RESOLUTION,
        -4.5 + ((j + dy) * 9) / SURFACE_RESOLUTION,
      );
    return b <= a
      ? (1 - a) * h(0, 0) + (a - b) * h(1, 0) + b * h(1, 1)
      : (1 - b) * h(0, 0) + a * h(1, 1) + (b - a) * h(0, 1);
  };
  const steps = 160,
    columns = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = -1.2 + Math.sin(t * 5) * 0.55 + t * 1.8,
      y = -4.25 + t * 6.7,
      width =
        (0.1 + t * 0.27) * Math.sqrt(Math.sin(Math.PI * (0.02 + t * 0.979)));
    for (let column = 0; column <= columns; column++) {
      const side = (column / columns) * 2 - 1;
      const px = x + width * side;
      mesh.positions.push(px, y, terrainHeight(px, y) + 0.025);
      const dx =
        (shieldSurface(px + 0.01, y) - shieldSurface(px - 0.01, y)) / 0.02;
      const dy =
        (shieldSurface(px, y + 0.01) - shieldSurface(px, y - 0.01)) / 0.02;
      const length = Math.hypot(dx, dy, 1);
      mesh.normals.push(-dx / length, -dy / length, 1 / length);
      mesh.st.push((side + 1) / 2, t);
    }
    if (i < steps)
      for (let column = 0; column < columns; column++) {
        const k = i * (columns + 1) + column,
          next = k + columns + 1;
        mesh.indices.push(k, k + 1, next + 1, k, next + 1, next);
      }
  }
  return mesh;
}
