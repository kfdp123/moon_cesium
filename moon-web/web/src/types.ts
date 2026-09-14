export type SceneMode = "surface" | "interior";
export type CutawayMode = "full" | "half" | "quarter";
export type LayerId = "crust" | "mantle" | "outer-core" | "inner-core";

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
  mode: SceneMode;
  cutaway: CutawayMode;
  layers: MoonLayer[];
  hiddenLayers: LayerId[];
  selectedLayer: LayerId | null;
  showGrid: boolean;
  showLandmarks: boolean;
}

export type SceneSelection =
  | { kind: "layer"; id: LayerId }
  | { kind: "landmark"; id: string }
  | null;
