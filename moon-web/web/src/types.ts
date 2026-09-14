export type CutawayMode = "full" | "half" | "quarter";
export type LayerId = string;
export type NavigationMode =
  | "orbit"
  | "first-person"
  | "base-tour"
  | "third-person";

export interface MoonLayer {
  id: LayerId;
  name: string;
  english: string;
  innerRadiusKm: number;
  outerRadiusKm: number;
  color: string;
  description: string;
  composition: string;
}

export interface Epoch {
  id: string;
  label: string;
  age: string;
  title: string;
  description: string;
  event: string;
  layers: MoonLayer[];
}

export interface SceneState {
  radiusKm: number;
  cutaway: CutawayMode;
  layers: MoonLayer[];
  hiddenLayers: LayerId[];
  selectedLayer: LayerId | null;
  showGrid: boolean;
  showLandmarks: boolean;
  points: LunarPoint[];
}

export interface ResourceLink {
  title: string;
  url: string;
}
export interface LunarPoint {
  id: string;
  name: string;
  category: string;
  longitude: number;
  latitude: number;
  description: string;
  source: string;
  visible: boolean;
  images: ResourceLink[];
  modelUrl: string;
  references: ResourceLink[];
  links: ResourceLink[];
}
export interface MapLayer {
  id: string;
  name: string;
  kind: "image" | "xyz" | "terrain";
  url: string;
  source: string;
  description: string;
  visible: boolean;
  opacity: number;
  maximumLevel: number;
}

export type SceneSelection =
  | { kind: "layer"; id: LayerId }
  | { kind: "landmark"; id: string }
  | null;
