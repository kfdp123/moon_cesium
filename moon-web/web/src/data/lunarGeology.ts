export interface GeologyPart {
  id: string;
  name: string;
  color: string;
  description: string;
  relationship: string;
}

export interface GeologyExhibit {
  id: string;
  name: string;
  subtitle: string;
  steps: [string, string, string];
  captions: [string, string, string];
  parts: GeologyPart[];
  boundary: string;
  sources: { title: string; url: string }[];
}

// 年代沿用合同中的全局场景组织；局部过程没有独立的绝对年代或地理定位。
export const geologyExhibits: GeologyExhibit[] = [
  {
    id: "magma-ocean",
    name: "岩浆海",
    subtitle: "熔融月球的局部窗口",
    steps: ["熔融", "对流", "向表面散热"],
    captions: [
      "高温熔体构成连续的岩浆海。",
      "热物质上升、较冷物质下沉，形成对流。",
      "热量向表面释放；本场景仍处于无结晶阶段。",
    ],
    parts: [
      {
        id: "melt",
        name: "岩浆海熔体",
        color: "#e66b28",
        description:
          "月球形成早期，大规模熔融产生岩浆海。这里截取一小块熔体，用剖面观察其内部。",
        relationship: "在剖面中观察熔体运动，理解早期岩浆海的热量传输。",
      },
      {
        id: "surface",
        name: "散热表面",
        color: "#ffb44b",
        description: "岩浆海向外散热，为后续冷却和结晶创造条件。",
        relationship: "热量从深部向表面传递，随后散失到太空。",
      },
    ],
    boundary:
      "对应合同“岩浆海无结晶”场景的局部过程。流线、颜色与速度均为示意，不是温度场或流体计算结果。",
    sources: [
      {
        title: "NASA · 月球形成与岩浆海",
        url: "https://science.nasa.gov/moon/formation/",
      },
    ],
  },
  {
    id: "volcanism",
    name: "分异与火山",
    subtitle: "从月壳到岩浆通道",
    steps: ["分层结构", "岩浆上涌", "熔岩铺展"],
    captions: [
      "早期分异形成月壳和更深部物质的差异。",
      "后续岩浆沿通道上升，连接储集区与火山口。",
      "熔岩铺展并冷却，形成深色玄武岩地表。",
    ],
    parts: [
      {
        id: "mantle",
        name: "深部岩石",
        color: "#665862",
        description:
          "岩浆海结晶分异留下不同成分的深部岩石。后续局部熔融可为月球火山活动提供岩浆。",
        relationship:
          "深部岩石与月壳具有不同的组成，局部熔融使岩浆沿通道向上迁移。",
      },
      {
        id: "crust",
        name: "月壳",
        color: "#b3abb0",
        description:
          "早期岩浆海结晶过程中，富含斜长石的物质上浮，参与形成浅色原始月壳。",
        relationship:
          "月壳与火山喷发分属相联系但不必同时发生的过程，模型用同一剖面组织展示。",
      },
      {
        id: "magma",
        name: "岩浆储集区与通道",
        color: "#f47732",
        description: "橙色储集区和通道表示岩浆从地下向地表输运的概念路径。",
        relationship: "通道穿过月壳并通向火山口，连通地下储集区与地表熔岩流。",
      },
      {
        id: "lava",
        name: "火山与玄武岩",
        color: "#615b64",
        description: "月球火山活动可形成低缓火山构造及广泛的玄武岩熔岩覆盖。",
        relationship:
          "沿着火山口观察熔岩流的铺展，以及冷却后形成的深色玄武岩覆盖。",
      },
    ],
    boundary:
      "将分异背景与后续火山活动放在一个概念剖面中，并非同一时刻的测量快照。火山坡度、层厚和通道大小经过展示夸张。",
    sources: [
      {
        title: "LPI · 阿波罗样品与斜长岩月壳",
        url: "https://www.lpi.usra.edu/lunar/missions/apollo/apollo_11/samples/",
      },
      {
        title: "LPI · 月球火山活动",
        url: "https://www.lpi.usra.edu/education/explore/shaping_the_planets/volcanism/",
      },
    ],
  },
  {
    id: "impact",
    name: "撞击与冷却",
    subtitle: "撞击坑的地表与地下",
    steps: ["撞击前", "开挖与熔融", "冷却后的剖面"],
    captions: [
      "撞击前的浅表岩层。",
      "撞击开挖形成坑体，部分岩石破碎、熔融。",
      "熔融物冷却，留下坑缘、坑底与地下破碎区。",
    ],
    parts: [
      {
        id: "bedrock",
        name: "下伏岩石",
        color: "#676271",
        description: "下伏岩石为坑体和上部破碎层提供背景。",
        relationship: "沿坑体剖面向下观察，识别受扰动的浅表岩层与下伏岩石。",
      },
      {
        id: "breccia",
        name: "破碎岩层",
        color: "#9c8790",
        description:
          "高速撞击使岩石破碎、混合，形成角砾状物质和受扰动的地下区域。",
        relationship: "观察坑底下方的破碎带，以及它与完整岩石的空间关系。",
      },
      {
        id: "terrain",
        name: "月表与坑体",
        color: "#bbb9bd",
        description:
          "较大的复杂撞击坑可具有隆起坑缘、凹陷坑底和中央隆起。并非所有撞击坑都有中央峰。",
        relationship:
          "撞击后展示半个坑体及其剖面，便于同时观察地形与地下结构。撞击前步骤则保留未开挖月表。",
      },
      {
        id: "impact-melt",
        name: "撞击熔融物",
        color: "#dd975d",
        description: "撞击释放的能量可熔化部分岩石，熔体随后冷却凝固。",
        relationship: "橙色到暗色的变化呈现熔融物逐渐冷却、凝固的过程。",
      },
    ],
    boundary:
      "用于合同晚期大撞击与冷却场景的局部讲解。不是南极—艾特肯盆地复原，也不表示月球在某一时刻完全停止火山活动。",
    sources: [
      {
        title: "NASA · 月球撞击坑",
        url: "https://science.nasa.gov/moon/lunar-craters/",
      },
    ],
  },
];
