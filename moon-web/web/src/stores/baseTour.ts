import { defineStore } from "pinia";
import { ref } from "vue";
import { baseStops } from "../data/lunarBase";

export type BaseTourMode = "guided" | "free";

export const useBaseTour = defineStore("baseTour", () => {
  const mode = ref<BaseTourMode>("guided");
  const playing = ref(true);
  const index = ref(0);
  const progress = ref(0);
  const speed = ref(1);
  const showLabels = ref(true);
  const command = ref(0);
  const panelRight = ref(0);

  function select(nextIndex: number) {
    mode.value = "guided";
    index.value =
      ((nextIndex % baseStops.length) + baseStops.length) % baseStops.length;
    progress.value = 0;
    playing.value = false;
    command.value++;
  }

  function step(delta: number) {
    select(index.value + delta);
  }

  function restart() {
    mode.value = "guided";
    index.value = 0;
    progress.value = 0;
    playing.value = true;
    command.value++;
  }

  function reset() {
    speed.value = 1;
    showLabels.value = true;
    restart();
  }

  function setMode(nextMode: BaseTourMode) {
    mode.value = nextMode;
    playing.value = nextMode === "guided";
    command.value++;
  }

  return {
    mode,
    playing,
    index,
    progress,
    speed,
    showLabels,
    command,
    panelRight,
    select,
    step,
    reset,
    restart,
    setMode,
  };
});
