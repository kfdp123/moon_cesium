import type { Epoch, MoonLayer } from "../types";

export const MOON_RADIUS_KM = 1737.4;
export const MOON_RADIUS_M = MOON_RADIUS_KM * 1000;

// Texture orientation and credits: public/assets/lroc_color_8k.source.md.
export const SURFACE_TEXTURE_URL =
  import.meta.env.VITE_MOON_TEXTURE_URL || "/assets/lroc_color_8k.jpg";

const layerDescriptions = {
  crust: {
    name: "月壳",
    english: "CRUST",
    color: "#c4b7a7",
    composition: "以硅酸盐岩石为主",
    description:
      "月球最外侧的固体岩石层。真实厚度随位置变化，这里用均匀球壳说明它与下方月幔的关系。",
  },
  mantle: {
    name: "月幔",
    english: "MANTLE",
    color: "#cc7650",
    composition: "富含镁、铁的硅酸盐",
    description:
      "月幔位于月壳之下，占据月球内部的大部分体积。它的热状态与月球早期的分异及后来的火山活动有关。",
  },
  "outer-core": {
    name: "外核",
    english: "OUTER CORE",
    color: "#e8ad5b",
    composition: "金属富集区（示意）",
    description:
      "靠近月球中心的金属富集区域。此处仅用分层模型展示位置关系，边界和物态需要由实际科学模型确定。",
  },
  "inner-core": {
    name: "内核",
    english: "INNER CORE",
    color: "#f4dba1",
    composition: "中心金属区（示意）",
    description:
      "最靠近月心的区域。图中尺寸为演示参数，不代表本项目已经确定月球内核的真实半径。",
  },
};

function layers(
  crustThickness: number,
  coreRadius: number,
  innerRadius: number,
): MoonLayer[] {
  const boundaries = [
    ["crust", MOON_RADIUS_KM - crustThickness, MOON_RADIUS_KM],
    ["mantle", coreRadius, MOON_RADIUS_KM - crustThickness],
    ["outer-core", innerRadius, coreRadius],
    ["inner-core", 0, innerRadius],
  ] as const;
  return boundaries
    .filter(([, inner, outer]) => outer > inner)
    .map(([id, innerRadiusKm, outerRadiusKm]) => ({
      id,
      innerRadiusKm,
      outerRadiusKm,
      ...layerDescriptions[id],
    }));
}

// All radii and stage transitions are illustrative fixtures, not inversion results.
export const epochs: Epoch[] = [
  {
    id: "magma-ocean",
    label: "岩浆海阶段",
    age: "约 44–45 亿年前",
    title: "从炽热的开始，认识月球",
    description:
      "通过分层示意观察月球早期的内部。这里的动画用于解释结构变化，不是对岩浆海演化的物理求解。",
    event: "早期岩浆海 · 结构示意",
    layers: layers(15, 420, 0),
  },
  {
    id: "differentiation",
    label: "分异与结晶",
    age: "约 43 亿年前",
    title: "物质分异，逐渐形成层次",
    description:
      "在冷却与分异过程中，不同物质形成不同区域。用阶段模型比较月壳与内部结构，而非把演化理解为简单的颜色变化。",
    event: "结晶与分异 · 结构示意",
    layers: layers(35, 390, 160),
  },
  {
    id: "late-evolution",
    label: "撞击与冷却",
    age: "约 38 亿年前",
    title: "撞击与冷却，留下时间的痕迹",
    description:
      "把月球表面的演化与内部热状态联系起来。本阶段的事件与结构仍是教学示意，后续将接入经核定的场景资料。",
    event: "撞击与冷却 · 结构示意",
    layers: layers(45, 360, 220),
  },
  {
    id: "present",
    label: "现今月球",
    age: "今天",
    title: "不止于我们看见的那一面",
    description:
      "从熟悉的月表出发，探索岩石外壳之下的圈层结构。转动月球、打开剖面，再选择一个圈层了解更多。",
    event: "月球内部 · 分层示意",
    layers: layers(45, 350, 240),
  },
];

export const landmarks = [
  {
    id: "apollo11",
    name: "阿波罗 11 号着陆点",
    longitude: 23.47297,
    latitude: 0.67408,
    description:
      "1969 年，人类在静海地区首次登上月球。位置标记用于认识月球正面。",
    source: "https://www.nasa.gov/mission/apollo-11/",
  },
  {
    id: "tycho",
    name: "第谷环形山",
    longitude: -11.22,
    latitude: -43.3,
    description:
      "月球正面南部的显著撞击地貌，可在月表纹理中寻找其向外延伸的辐射纹。",
    source: "https://science.nasa.gov/moon/",
  },
];
