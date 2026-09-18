export interface BaseStop {
  id: string;
  title: string;
  kicker: string;
  description: string;
  icon: "overview" | "habitat" | "power" | "communications" | "landing";
  target: [number, number, number];
  radius: number;
  height: number;
  azimuth: number;
  duration: number;
}

export const baseStops: BaseStop[] = [
  {
    id: "overview",
    title: "基地全景",
    kicker: "月面上的工作与生活",
    description:
      "居住科研、能源、通信与着陆设施共同支撑月面活动。沿巡视路线，看看各个区域如何协同工作。",
    icon: "overview",
    target: [0, 0, 4],
    radius: 250,
    height: 140,
    azimuth: 2.6,
    duration: 16,
  },
  {
    id: "habitat",
    title: "生活与实验舱",
    kicker: "生活保障 · 月面科研",
    description:
      "加压舱为生活和实验提供可控环境。气闸用于舱内外过渡，密封通道连接生活舱与实验舱。",
    icon: "habitat",
    target: [0, 15, 6],
    radius: 100,
    height: 40,
    azimuth: 2.5,
    duration: 14,
  },
  {
    id: "power",
    title: "太阳能阵列",
    kicker: "采集阳光 · 储存能源",
    description:
      "太阳能电池将阳光转化为电能，为舱体和设备供电。储能与供电管理用于应对光照条件的变化。",
    icon: "power",
    target: [-60, 5, 3],
    radius: 70,
    height: 34,
    azimuth: 2.5,
    duration: 12,
  },
  {
    id: "communications",
    title: "通信站",
    kicker: "连接地球 · 传递发现",
    description:
      "定向天线收发测控信号与科学数据。当地形或月球遮挡地球方向时，通信可通过中继卫星完成。",
    icon: "communications",
    target: [48, 40, 8],
    radius: 45,
    height: 22,
    azimuth: 2.3,
    duration: 12,
  },
  {
    id: "landing",
    title: "着陆保障区",
    kicker: "人员往返 · 物资补给",
    description:
      "着陆区承担人员往返和物资运输，与生活区保持间隔。起降时的喷流会扬起月尘，场地布局需要考虑它对设备的影响。",
    icon: "landing",
    target: [65, -48, 1],
    radius: 80,
    height: 46,
    azimuth: 2.5,
    duration: 12,
  },
];
