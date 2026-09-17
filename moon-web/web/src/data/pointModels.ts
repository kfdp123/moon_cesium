import type { LunarPoint } from "../types";

export interface PointModel {
  url: string;
  thumbnail: string;
  title: string;
  caption: string;
  scale: number;
  baseHeight: number;
  environment: "surface" | "terrain";
  pitch: number;
}
const root = "/assets/point-models";
const categories: Record<
  string,
  {
    id: string;
    title: string;
    scale: number;
    baseHeight: number;
    environment: "surface" | "terrain";
    pitch: number;
  }
> = {
  环形山: {
    id: "crater",
    title: "环形山构造",
    scale: 1500,
    baseHeight: 0,
    environment: "terrain",
    pitch: -0.65,
  },
  月海: {
    id: "mare",
    title: "月海与周缘高地",
    scale: 3000,
    baseHeight: 0,
    environment: "terrain",
    pitch: -0.72,
  },
  着陆点: {
    id: "lander",
    title: "月面着陆器",
    scale: 1.5,
    baseHeight: 0,
    environment: "surface",
    pitch: -0.3,
  },
  巡视器: {
    id: "rover",
    title: "月面巡视器",
    scale: 0.005,
    baseHeight: 0,
    environment: "surface",
    pitch: -0.32,
  },
};

/** 专属模型优先；只为明确匹配的类别提供通用示意，不把任意点位套成地貌。 */
export function pointModel(point: LunarPoint): PointModel | null {
  if (point.modelUrl) {
    const apollo = point.modelUrl === "/assets/apollo-lunar-module.glb";
    return {
      url: point.modelUrl,
      thumbnail: apollo ? `${root}/apollo.png` : "",
      title: apollo ? "阿波罗登月舱" : "点位三维模型",
      caption: apollo ? "NASA / Michael D. Carbajal" : "",
      scale: 1,
      baseHeight: apollo ? 0.102631 : 0,
      environment: "surface",
      pitch: -0.3,
    };
  }
  const type = categories[point.category];
  return type
    ? {
        url:
          type.id === "rover"
            ? "/月球车_写实贴图.glb"
            : `${root}/${type.id}.glb`,
        thumbnail: `${root}/${type.id}.png`,
        title: type.title,
        caption: "",
        scale: type.scale,
        baseHeight: type.baseHeight,
        environment: type.environment,
        pitch: type.pitch,
      }
    : null;
}
