// 原创月球科普资产。Y 向上；局部形态用于展示地貌结构，不是实测 DEM。
// 只使用 Node 内置模块，生成的 GLB 自带纹理，可直接部署或离线使用。
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const output = fileURLToPath(
  new URL("../public/assets/point-models/", import.meta.url),
);
mkdirSync(output, { recursive: true });
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function noise(x, y) {
  const i = Math.floor(x),
    j = Math.floor(y),
    u = smooth(0, 1, x - i),
    v = smooth(0, 1, y - j);
  return (
    (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) +
    (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v
  );
}
const grain = (x, z) =>
  noise(x * 3, z * 3) * 0.55 +
  noise(x * 13, z * 13) * 0.3 +
  noise(x * 49, z * 49) * 0.15;
const subtract = (a, b) => a.map((n, i) => n - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a) => {
  const length = Math.hypot(...a);
  return a.map((n) => n / length);
};

// Small PNG encoder keeps the asset pipeline independent of image packages.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type),
    payload = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of payload) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const header = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, payload, checksum]);
}
function png(size, sample) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgba = sample(x / (size - 1), y / (size - 1), x, y);
      for (let c = 0; c < 4; c++)
        pixels[y * (size * 4 + 1) + 1 + x * 4 + c] = Math.round(
          clamp(rgba[c], 0, 255),
        );
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function surfaceTexture(kind) {
  return png(1024, (u, v, px, py) => {
    const x = (u - 0.5) * 6,
      z = (v - 0.5) * 6,
      r = Math.hypot(x, z),
      theta = Math.atan2(z, x);
    const detail = (grain(x * 7, z * 7) - 0.5) * 45 + (hash(px, py) - 0.5) * 24;
    let tone = 158 + (grain(x, z) - 0.5) * 40 + detail;
    if (kind === "crater") {
      tone += smooth(1.1, 1.65, r) * (1 - smooth(1.8, 2.25, r)) * 38;
      tone +=
        Math.pow(
          Math.max(0, Math.sin(theta * 17 + noise(x * 2, z * 2) * 3)),
          10,
        ) *
        smooth(1.65, 1.95, r) *
        25;
      tone -= (1 - smooth(0.95, 1.4, r)) * 20;
    } else if (kind === "mare") {
      tone -= (1 - smooth(1.8, 2.3, r + (noise(x, z) - 0.5) * 0.4)) * 55;
      tone += Math.sin(x * 7 + z * 3 + noise(x * 2, z * 2) * 4) * 4;
    } else {
      tone -= Math.exp(-(r * r) / 0.028) * 48;
    }
    if (kind !== "regolith") tone += smooth(1.85, 2.5, r) * 35;
    const edge = r + (noise(x * 6, z * 6) - 0.5) * 0.09;
    const alpha =
      (1 - smooth(kind === "regolith" ? 2.4 : 2.05, 2.96, edge)) * 255;
    return [tone, tone * 0.985, tone * 0.97, alpha];
  });
}
const textures = {
  crater: surfaceTexture("crater"),
  mare: surfaceTexture("mare"),
  regolith: surfaceTexture("regolith"),
  foil: png(256, (u, v) => {
    const fold =
      Math.abs(Math.sin(u * 83 + noise(u * 23, v * 23) * 11)) * 25 +
      (noise(u * 51, v * 51) - 0.5) * 50;
    return [208 + fold, 147 + fold * 0.8, 51 + fold * 0.4, 255];
  }),
  solar: png(256, (u, v) => {
    const border = u % 0.125 < 0.007 || v % 0.25 < 0.008;
    const line = u % 0.021 < 0.0017;
    return border
      ? [120, 141, 167, 255]
      : line
        ? [90, 119, 148, 255]
        : [17 + u * 12, 40 + u * 10, 75 + v * 14, 255];
  }),
};
const materials = [
  { name: "Lunar regolith", color: [0.83, 0.82, 0.8, 1], roughness: 1 },
  { name: "Basalt", color: [0.25, 0.25, 0.26, 1], roughness: 1 },
  {
    name: "Gold thermal blanket",
    color: [1, 1, 1, 1],
    metallic: 0.68,
    roughness: 0.62,
    texture: "foil",
  },
  {
    name: "Aluminium",
    color: [0.78, 0.81, 0.83, 1],
    metallic: 0.58,
    roughness: 0.36,
  },
  {
    name: "Carbon and optics",
    color: [0.035, 0.045, 0.055, 1],
    metallic: 0.22,
    roughness: 0.64,
  },
  {
    name: "Solar cells",
    color: [1, 1, 1, 1],
    metallic: 0.35,
    roughness: 0.3,
    texture: "solar",
  },
  {
    name: "Crater terrain",
    color: [1, 1, 1, 1],
    roughness: 1,
    texture: "crater",
    blend: true,
  },
  {
    name: "Mare terrain",
    color: [1, 1, 1, 1],
    roughness: 1,
    texture: "mare",
    blend: true,
  },
  {
    name: "Surface dust",
    color: [1, 1, 1, 1],
    roughness: 1,
    texture: "regolith",
    blend: true,
  },
];

class Asset {
  groups = materials.map(() => ({ positions: [], normals: [], uv: [] }));
  triangle(a, b, c, material = 0, normalAt, planar = false) {
    const normal = normalize(cross(subtract(b, a), subtract(c, a))),
      group = this.groups[material];
    const axis = normal
      .map(Math.abs)
      .indexOf(Math.max(...normal.map(Math.abs)));
    for (const p of [a, b, c]) {
      group.positions.push(...p);
      group.normals.push(...(normalAt ? normalAt(p[0], p[2]) : normal));
      group.uv.push(
        ...(planar
          ? [p[0] / 6 + 0.5, p[2] / 6 + 0.5]
          : axis === 1
            ? [p[0], p[2]]
            : axis === 0
              ? [p[2], p[1]]
              : [p[0], p[1]]),
      );
    }
  }
  quad(a, b, c, d, material = 0, normalAt, planar = false) {
    this.triangle(a, b, c, material, normalAt, planar);
    this.triangle(a, c, d, material, normalAt, planar);
  }
  box(center, size, material = 0) {
    const [x, y, z] = center,
      [w, h, d] = size.map((n) => n / 2);
    const p = [
      [-w, -h, -d],
      [w, -h, -d],
      [w, h, -d],
      [-w, h, -d],
      [-w, -h, d],
      [w, -h, d],
      [w, h, d],
      [-w, h, d],
    ].map(([a, b, c]) => [a + x, b + y, c + z]);
    for (const face of [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
      [3, 7, 6, 2],
      [0, 1, 5, 4],
    ])
      this.quad(...face.map((i) => p[i]), material);
  }
  tube(start, end, radius, material = 3, tipRadius = radius, segments = 20) {
    const axis = normalize(subtract(end, start)),
      u = normalize(
        cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]),
      ),
      v = cross(axis, u);
    const point = (center, r, t) =>
      center.map((n, i) => n + r * (Math.cos(t) * u[i] + Math.sin(t) * v[i]));
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2,
        b = ((i + 1) / segments) * Math.PI * 2;
      const p = point(start, radius, a),
        q = point(start, radius, b),
        r = point(end, tipRadius, b),
        s = point(end, tipRadius, a);
      this.quad(p, q, r, s, material);
      this.triangle(start, q, p, material);
      this.triangle(end, s, r, material);
    }
  }
  rock(x, z, radius, seed) {
    const rings = 5,
      segments = 9,
      points = [];
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI;
      points[j] = Array.from({ length: segments }, (_, i) => {
        const a = (i / segments) * Math.PI * 2,
          rough = 0.78 + hash(i + seed, j) * 0.34;
        return [
          x + Math.sin(phi) * Math.cos(a) * radius * rough,
          radius * (0.32 + Math.cos(phi) * 0.65) * rough,
          z + Math.sin(phi) * Math.sin(a) * radius * rough,
        ];
      });
    }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segments; i++) {
        const next = (i + 1) % segments;
        // Omit the collapsed poles instead of producing undefined normals.
        if (j > 0)
          this.triangle(points[j][i], points[j][next], points[j + 1][next], 0);
        if (j < rings - 1)
          this.triangle(points[j][i], points[j + 1][next], points[j + 1][i], 0);
      }
  }
  terrain(kind) {
    const height = (x, z) => {
      const r = Math.hypot(x, z),
        theta = Math.atan2(z, x),
        edge = 1 - smooth(2.5, 3, r);
      const rough = (grain(x * 2, z * 2) - 0.5) * 0.035;
      if (kind === "regolith")
        return (
          (0.008 + (grain(x * 4, z * 4) - 0.5) * 0.02 * smooth(0.4, 0.8, r)) *
          edge
        );
      if (kind === "mare") {
        const ring =
          r + 0.12 * Math.sin(theta * 5) + (noise(x * 2, z * 2) - 0.5) * 0.2;
        const arc =
          0.16 + 0.84 * smooth(-0.4, 0.6, Math.sin(theta * 2.3 + 0.4));
        const highland =
          0.4 *
          Math.exp(-(((ring - 2.3) / 0.29) ** 2)) *
          arc *
          (0.65 + noise(x * 4, z * 4) * 0.55);
        const ridge =
          0.02 *
          Math.pow(Math.max(0, Math.sin(x * 5 + z * 2 + noise(x, z) * 3)), 6);
        return (
          Math.max(
            0.015,
            0.05 + highland + rough * smooth(1.7, 2.2, r) + ridge,
          ) * edge
        );
      }
      const warped =
        r + 0.045 * Math.sin(theta * 9) + 0.025 * Math.sin(theta * 19);
      const terraces =
        0.085 +
        0.14 * smooth(0.85, 1, warped) +
        0.16 * smooth(1.08, 1.21, warped) +
        0.19 * smooth(1.3, 1.44, warped) +
        0.21 * smooth(1.53, 1.67, warped);
      const rim = 0.14 * Math.exp(-(((warped - 1.7) / 0.105) ** 2));
      const outer = 0.68 * Math.exp(-(warped - 1.7) * 2.3);
      const peak =
        0.42 * Math.exp(-((x + 0.12) ** 2 / 0.04 + (z + 0.06) ** 2 / 0.09)) +
        0.28 * Math.exp(-((x - 0.22) ** 2 / 0.02 + (z - 0.04) ** 2 / 0.045));
      const radial = Math.sin(theta * 67 + r * 9) * 0.007 * smooth(0.8, 1.4, r);
      return (
        Math.max(
          0.008,
          (warped < 1.7 ? terraces : outer) + rim + peak + rough + radial,
        ) *
        edge *
        0.45
      );
    };
    const steps = kind === "regolith" ? 64 : 144,
      material = kind === "crater" ? 6 : kind === "mare" ? 7 : 8;
    const normal = (x, z) => {
      const e = 0.006;
      return normalize([
        -(height(x + e, z) - height(x - e, z)) / (2 * e),
        1,
        -(height(x, z + e) - height(x, z - e)) / (2 * e),
      ]);
    };
    const point = (i, j) => {
      const x = -3 + (i * 6) / steps,
        z = -3 + (j * 6) / steps;
      return [x, height(x, z), z];
    };
    for (let j = 0; j < steps; j++)
      for (let i = 0; i < steps; i++) {
        if (
          Math.hypot(
            -3 + ((i + 0.5) * 6) / steps,
            -3 + ((j + 0.5) * 6) / steps,
          ) > 3
        )
          continue;
        this.quad(
          point(i, j),
          point(i, j + 1),
          point(i + 1, j + 1),
          point(i + 1, j),
          material,
          normal,
          true,
        );
      }
    if (kind === "regolith")
      for (let i = 0; i < 52; i++) {
        const a = hash(i, 8) * Math.PI * 2,
          r = 0.75 + hash(i, 9) * 1.9;
        this.rock(
          Math.cos(a) * r,
          Math.sin(a) * r,
          0.009 + hash(i, 10) ** 3 * 0.048,
          i,
        );
      }
  }
  save(name) {
    const used = this.groups
      .map((group, i) => (group.positions.length ? i : -1))
      .filter((i) => i >= 0);
    const document = {
      asset: { version: "2.0", generator: "Moon Cesium lunar exhibits" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name, mesh: 0 }],
      meshes: [{ primitives: [] }],
      materials: [],
      textures: [],
      images: [],
      samplers: [
        { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 },
      ],
      buffers: [{ byteLength: 0 }],
      bufferViews: [],
      accessors: [],
    };
    const chunks = [],
      textureIds = new Map();
    let length = 0;
    const append = (buffer, target) => {
      const view = document.bufferViews.length;
      document.bufferViews.push({
        buffer: 0,
        byteOffset: length,
        byteLength: buffer.length,
        ...(target ? { target } : {}),
      });
      const padded = Buffer.alloc(Math.ceil(buffer.length / 4) * 4);
      buffer.copy(padded);
      chunks.push(padded);
      length += padded.length;
      return view;
    };
    for (const index of used) {
      const m = materials[index],
        pbr = {
          baseColorFactor: m.color,
          metallicFactor: m.metallic ?? 0,
          roughnessFactor: m.roughness,
        };
      if (m.texture) {
        if (!textureIds.has(m.texture)) {
          textureIds.set(m.texture, document.textures.length);
          document.textures.push({
            sampler: 0,
            source: document.images.length,
          });
          document.images.push({
            bufferView: append(textures[m.texture]),
            mimeType: "image/png",
          });
        }
        pbr.baseColorTexture = { index: textureIds.get(m.texture) };
      }
      document.materials.push({
        name: m.name,
        pbrMetallicRoughness: pbr,
        ...(m.blend ? { alphaMode: "BLEND", doubleSided: true } : {}),
      });
    }
    const attribute = (values, components, position = false) => {
      const accessor = {
        bufferView: append(Buffer.from(new Float32Array(values).buffer), 34962),
        componentType: 5126,
        count: values.length / components,
        type: `VEC${components}`,
      };
      if (position) {
        accessor.min = [Infinity, Infinity, Infinity];
        accessor.max = [-Infinity, -Infinity, -Infinity];
        values.forEach((n, i) => {
          accessor.min[i % 3] = Math.min(accessor.min[i % 3], n);
          accessor.max[i % 3] = Math.max(accessor.max[i % 3], n);
        });
      }
      document.accessors.push(accessor);
      return document.accessors.length - 1;
    };
    used.forEach((index, material) => {
      const g = this.groups[index];
      document.meshes[0].primitives.push({
        attributes: {
          POSITION: attribute(g.positions, 3, true),
          NORMAL: attribute(g.normals, 3),
          TEXCOORD_0: attribute(g.uv, 2),
        },
        material,
      });
    });
    document.buffers[0].byteLength = length;
    const json = Buffer.from(JSON.stringify(document)),
      padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
    json.copy(padded);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + padded.length + length, 8);
    header.writeUInt32LE(padded.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const bin = Buffer.alloc(8);
    bin.writeUInt32LE(length, 0);
    bin.writeUInt32LE(0x004e4942, 4);
    writeFileSync(
      `${output}/${name}.glb`,
      Buffer.concat([header, padded, bin, ...chunks]),
    );
    console.log(
      `${name}: ${(length / 1024 / 1024).toFixed(2)} MB, ${used.length} materials`,
    );
  }
}

for (const kind of ["crater", "mare", "regolith"]) {
  const asset = new Asset();
  asset.terrain(kind);
  asset.save(kind);
}

// Landing equipment: open truss, foil insulation, radiators, optics and two solar wings.
const lander = new Asset();
lander.tube([0, 0.76, 0], [0, 1.48, 0], 0.82, 2, 0.72, 8);
lander.box([0, 1.62, 0], [1.16, 0.35, 1.04], 3);
lander.box([0, 1.48, 0], [1.35, 0.04, 1.26], 4);
lander.tube([0, 0.49, 0], [0, 0.82, 0], 0.3, 4, 0.16);
for (const [x, z] of [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]) {
  lander.tube([x * 0.5, 1.3, z * 0.5], [x * 1.32, 0.08, z * 1.32], 0.035, 3);
  lander.tube([x * 0.7, 0.85, z * 0.7], [x * 1.18, 0.32, z * 1.18], 0.029, 2);
  lander.tube([x * 0.5, 1.2, z * 0.5], [x * 0.9, 0.62, z * 0.9], 0.067, 2);
  lander.tube(
    [x * 1.32, 0, z * 1.32],
    [x * 1.32, 0.07, z * 1.32],
    0.22,
    3,
    0.2,
  );
}
for (const x of [-1, 1]) {
  lander.tube([x * 0.57, 1.45, 0], [x * 1.72, 1.45, 0], 0.038, 3);
  lander.box([x * 1.58, 1.47, 0], [1.38, 0.04, 1.32], 3);
  lander.box([x * 1.58, 1.498, 0], [1.32, 0.008, 1.25], 5);
  lander.box([x * 0.591, 1.67, 0], [0.025, 0.2, 0.73], 4);
  for (let z = -0.32; z < 0.34; z += 0.08)
    lander.box([x * 0.607, 1.67, z], [0.016, 0.2, 0.012], 3);
}
lander.tube([0.23, 1.81, 0], [0.23, 2.3, 0], 0.027, 3);
lander.box([0.23, 2.3, 0], [0.39, 0.13, 0.17], 3);
for (const x of [0.1, 0.35])
  lander.tube([x, 2.3, -0.085], [x, 2.3, -0.12], 0.045, 4);
lander.tube([-0.35, 1.79, 0.2], [-0.35, 2.03, 0.2], 0.025, 3);
lander.tube([-0.35, 2.02, 0.2], [-0.35, 2.09, 0.2], 0.17, 3, 0.05);
lander.box([0, 1.05, -0.77], [0.44, 0.23, 0.055], 3);
lander.tube([0, 1.06, -0.8], [0, 1.06, -0.85], 0.065, 4);
lander.save("lander");
