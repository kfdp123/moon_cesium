export interface PointStory {
  kicker: string;
  facts: { label: string; value: string }[];
  imageCredit: string;
}

export interface ExplorationTheme {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  pointIds: string[];
}

const media = "/assets/poi-media";

export const curatedPointIds = [
  "apollo11",
  "change3",
  "yutu",
  "usgs-3691",
  "usgs-3678",
  "usgs-6163",
  "usgs-1296",
];

export const explorationThemes: ExplorationTheme[] = [
  {
    id: "footprints",
    title: "登月足迹",
    subtitle: "从静海第一步，到玉兔月面巡视",
    image: `${media}/apollo11-armstrong.jpg`,
    pointIds: ["apollo11", "change3", "yutu"],
  },
  {
    id: "volcanism",
    title: "月海与火山",
    subtitle: "追寻玄武岩平原与古老熔岩",
    image: `${media}/maria-color.jpg`,
    pointIds: ["usgs-3691", "usgs-3678"],
  },
  {
    id: "impacts",
    title: "撞击地貌",
    subtitle: "深入环形山、中央峰与溅射物",
    image: `${media}/tycho-peak.png`,
    pointIds: ["usgs-6163", "usgs-1296"],
  },
];

export const pointStories: Record<string, PointStory> = {
  apollo11: {
    kicker: "人类在另一颗天体留下的第一行足迹",
    facts: [
      { label: "着陆日期", value: "1969.07.20" },
      { label: "着陆区域", value: "静海" },
      { label: "带回样品", value: "约 21.5 kg" },
    ],
    imageCredit: "NASA",
  },
  change3: {
    kicker: "中国首次月面软着陆与巡视勘察",
    facts: [
      { label: "着陆日期", value: "2013.12.14" },
      { label: "着陆区域", value: "雨海北部" },
      { label: "着陆器载荷", value: "4 种科学仪器" },
    ],
    imageCredit: "NASA/GSFC/ASU",
  },
  yutu: {
    kicker: "沿着车辙，探查月壤下面的世界",
    facts: [
      { label: "所属任务", value: "嫦娥三号" },
      { label: "巡视区域", value: "雨海" },
      { label: "探测方式", value: "成像 · 光谱 · 雷达" },
    ],
    imageCredit: "国家航天局",
  },
  "usgs-3691": {
    kicker: "凝固的熔岩之海，也是人类登月的起点",
    facts: [
      { label: "地貌类型", value: "玄武岩平原" },
      { label: "名录直径", value: "约 876 km" },
      { label: "代表任务", value: "阿波罗 11 号" },
    ],
    imageCredit: "NASA/JPL",
  },
  "usgs-3678": {
    kicker: "一次巨型撞击与多期熔岩共同塑造的盆地",
    facts: [
      { label: "名录直径", value: "约 1,146 km" },
      { label: "形成过程", value: "撞击盆地 → 熔岩充填" },
      { label: "典型地貌", value: "孤峰 · 山环 · 月海" },
    ],
    imageCredit: "NASA/GSFC/ASU",
  },
  "usgs-6163": {
    kicker: "从明亮辐射纹，读懂一次猛烈的撞击",
    facts: [
      { label: "名录直径", value: "约 85 km" },
      { label: "结构类型", value: "复杂撞击坑" },
      { label: "中央峰高差", value: "约 2.5 km" },
    ],
    imageCredit: "NASA/GSFC/ASU",
  },
  "usgs-1296": {
    kicker: "台阶状坑壁与中央峰，揭开月壳深处的岩石",
    facts: [
      { label: "名录直径", value: "约 96 km" },
      { label: "结构类型", value: "复杂撞击坑" },
      { label: "观察重点", value: "阶地 · 中央峰 · 坑链" },
    ],
    imageCredit: "NASA / Lunar and Planetary Institute",
  },
};
