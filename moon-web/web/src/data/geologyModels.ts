/**
 * 本地剖面模型资源目录。
 *
 * 这些模型来自 files/9.17模型，运行时副本位于 public/assets/geology-models。
 * bounds 是 GLB 网格 POSITION accessor 的局部坐标范围；模型内部的节点变换
 * 仍由 glTF 加载器负责，不能把这些值当成月球的真实尺度。
 */

export type GeologyModelGroup = "shallow" | "interior" | "evolution";

export interface GeologyModelLayer {
  name: string;
  color: string;
  description?: string;
}

export interface GeologyModelSource {
  title: string;
  url: string;
}

export interface GeologyModelBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
}

export interface GeologyModelAsset {
  id: string;
  name: string;
  group: GeologyModelGroup;
  description: string;
  url: string;
  sourceFile: string;
  bytes: number;
  meshCount: number;
  primitiveCount: number;
  textured: boolean;
  coordinateSpace: "gltf-local";
  bounds: GeologyModelBounds;
  layers: GeologyModelLayer[];
  sources: GeologyModelSource[];
}

const localSource = (sourceFile: string): GeologyModelSource => ({
  title: `本地模型资源：${sourceFile}`,
  url: "",
});

export const geologyModels: GeologyModelAsset[] = [
  {
    id: "shallow-strata",
    name: "月表浅层分层块体",
    group: "shallow",
    description:
      "带月表陨石坑和多条水平地下层的浅层剖面模型，用于展示月壤与浅部地层的空间关系。",
    url: "/assets/geology-models/shallow-strata.glb",
    sourceFile: "DwarfWarrior_Textured_00019_.glb",
    bytes: 43613792,
    meshCount: 1,
    primitiveCount: 1,
    textured: true,
    coordinateSpace: "gltf-local",
    bounds: {
      min: [-0.4999949932, -0.1677957922, -0.1280461997],
      max: [0.4999949932, 0.1677957922, 0.1280461997],
      size: [0.9999899864, 0.3355915844, 0.2560923993],
      center: [0, 0, 0],
    },
    layers: [
      { name: "月表与陨石坑", color: "#a69d91" },
      { name: "浅层月壤", color: "#81786d" },
      { name: "地下分层", color: "#625951" },
    ],
    sources: [localSource("DwarfWarrior_Textured_00019_.glb")],
  },
  {
    id: "interior-sphere",
    name: "月球内部整体球体",
    group: "interior",
    description:
      "带月表纹理和内部环状结构的整体球体，用于从完整月球视角观察内部构造。",
    url: "/assets/geology-models/interior-sphere.glb",
    sourceFile: "DwarfWarrior_Textured_00021_.glb",
    bytes: 69097476,
    meshCount: 1,
    primitiveCount: 1,
    textured: true,
    coordinateSpace: "gltf-local",
    bounds: {
      min: [-0.4999949932, -0.499925523996, -0.499953866],
      max: [0.4999949932, 0.499925523996, 0.499953866],
      size: [0.9999899864, 0.999851048, 0.999907732],
      center: [0, 0, 0],
    },
    layers: [
      { name: "月球表面", color: "#9a948a" },
      { name: "内部圈层", color: "#9b633d" },
      { name: "中心区域", color: "#c2b4a2" },
    ],
    sources: [localSource("DwarfWarrior_Textured_00021_.glb")],
  },
  {
    id: "interior-quarter-cutaway",
    name: "月球内部四分之一剖切",
    group: "interior",
    description:
      "保留月表纹理的四分之一剖切球体，适合观察外壳、内部层状结构和剖切关系。",
    url: "/assets/geology-models/interior-quarter-cutaway.glb",
    sourceFile: "DwarfWarrior_Textured_00022_.glb",
    bytes: 74483328,
    meshCount: 1,
    primitiveCount: 1,
    textured: true,
    coordinateSpace: "gltf-local",
    bounds: {
      min: [-0.4999498129, -0.4999949932, -0.4999403358],
      max: [0.4999498129, 0.4999949932, 0.4999403358],
      size: [0.9998996258, 0.9999899864, 0.9998806716],
      center: [0, 0, 0],
    },
    layers: [
      { name: "月壳与月表", color: "#98928a" },
      { name: "月幔示意层", color: "#837064" },
      { name: "深部橙色结构", color: "#b87343" },
    ],
    sources: [localSource("DwarfWarrior_Textured_00022_.glb")],
  },
  {
    id: "interior-layer-block",
    name: "月球内部层序长方体",
    group: "interior",
    description:
      "月表、地下水平层和深部层序组成的长方体模型，适合按层序讲解内部结构。",
    url: "/assets/geology-models/interior-layer-block.glb",
    sourceFile: "DwarfWarrior_Textured_00023_.glb",
    bytes: 46821872,
    meshCount: 1,
    primitiveCount: 1,
    textured: true,
    coordinateSpace: "gltf-local",
    bounds: {
      min: [-0.4999949932, -0.3305439949, -0.1340722442],
      max: [0.4999949932, 0.3305439949, 0.1340722442],
      size: [0.9999899864, 0.6610879898, 0.2681444884],
      center: [0, 0, 0],
    },
    layers: [
      { name: "月壳", color: "#99958e" },
      { name: "主月幔", color: "#8d806f" },
      { name: "低黏度层", color: "#654a38" },
      { name: "外核", color: "#ad7a46" },
      { name: "内核", color: "#bcb3a0" },
    ],
    sources: [localSource("DwarfWarrior_Textured_00023_.glb")],
  },
  {
    id: "early-magma-ocean",
    name: "早期岩浆海三层块体",
    group: "evolution",
    description:
      "由月壳、剩余岩浆海和固态堆晶组成的早期演化剖面块体。",
    url: "/assets/geology-models/early-magma-ocean.glb",
    sourceFile: "DwarfWarrior_Textured_00024_.glb",
    bytes: 57279084,
    meshCount: 1,
    primitiveCount: 1,
    textured: true,
    coordinateSpace: "gltf-local",
    bounds: {
      min: [-0.4999949932, -0.3601410091, -0.1331227571],
      max: [0.4999949932, 0.3601410091, 0.1331227571],
      size: [0.9999899864, 0.7202820182, 0.2662455142],
      center: [0, 0, 0],
    },
    layers: [
      { name: "原始月壳", color: "#bab3a3" },
      { name: "剩余岩浆海", color: "#d88b37" },
      { name: "固态堆晶", color: "#706459" },
    ],
    sources: [localSource("DwarfWarrior_Textured_00024_.glb")],
  },
  {
    id: "interior-untextured",
    name: "无材质内部剖切底模",
    group: "interior",
    description:
      "无贴图的几何剖切底模，保留为备用资源，适合后续重新制作材质或比较几何轮廓。",
    url: "/assets/geology-models/interior-untextured.glb",
    sourceFile: "未命名.glb",
    bytes: 45772464,
    meshCount: 1,
    primitiveCount: 1,
    textured: false,
    coordinateSpace: "gltf-local",
    bounds: {
      min: [-2.4999036789, -2.4979572296, -5],
      max: [2.4999036789, 2.4972007275, 0],
      size: [4.9998073578, 4.9951579571, 5],
      center: [0, -0.0003782511, -2.5],
    },
    layers: [{ name: "剖切几何底模", color: "#8c8c8c" }],
    sources: [localSource("未命名.glb")],
  },
];

export const geologyModelGroups: Array<{
  id: GeologyModelGroup;
  name: string;
  description: string;
}> = [
  {
    id: "shallow",
    name: "月表浅层",
    description: "观察月表形态和浅部地层。",
  },
  {
    id: "interior",
    name: "月球内部",
    description: "用整体球体、剖切球体和层序块体观察内部结构。",
  },
  {
    id: "evolution",
    name: "早期演化",
    description: "观察早期岩浆海和冷却分层的局部剖面。",
  },
];

export function getGeologyModel(id: string) {
  return geologyModels.find((model) => model.id === id);
}
