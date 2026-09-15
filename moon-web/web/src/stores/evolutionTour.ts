import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { evolutionSteps } from "../data/evolutionTour";
import { useExplorer } from "./explorer";

export const useEvolutionTour = defineStore("evolutionTour", () => {
  const explorer = useExplorer();
  const active = ref(false),
    playing = ref(false),
    index = ref(0),
    elapsed = ref(0),
    command = ref(0);
  const step = computed(() => evolutionSteps[index.value]);
  const finished = computed(
    () =>
      index.value === evolutionSteps.length - 1 &&
      elapsed.value >= step.value.duration,
  );
  const progress = computed(
    () =>
      evolutionSteps
        .slice(0, index.value)
        .reduce((sum, s) => sum + s.duration, 0) + elapsed.value,
  );
  function applyStep(next: number) {
    index.value = next;
    elapsed.value = 0;
    const current = step.value;
    if (explorer.epochIndex !== current.epoch) {
      explorer.rememberModel();
      explorer.setEpoch(current.epoch);
    }
    explorer.cutaway = current.cut;
    explorer.hiddenLayers = [];
    explorer.expanded = current.expanded;
    explorer.selectedLayer = explorer.layers.some(
      (layer) => layer.id === current.focus,
    )
      ? current.focus
      : null;
    explorer.selectedLandmark = null;
    command.value++;
  }
  function start() {
    active.value = true;
    playing.value = true;
    explorer.evolutionRunning = true;
    applyStep(0);
  }
  function pause() {
    playing.value = false;
    explorer.evolutionRunning = false;
  }
  function resume() {
    if (
      !active.value ||
      (index.value === evolutionSteps.length - 1 &&
        elapsed.value >= step.value.duration)
    )
      start();
    else {
      playing.value = true;
      explorer.evolutionRunning = true;
    }
  }
  function stop() {
    pause();
    active.value = false;
  }
  function move(delta: number) {
    applyStep(
      Math.max(0, Math.min(evolutionSteps.length - 1, index.value + delta)),
    );
  }
  function tick(dt: number) {
    if (!playing.value) return;
    elapsed.value = Math.min(step.value.duration, elapsed.value + dt);
    if (elapsed.value >= step.value.duration) {
      if (index.value < evolutionSteps.length - 1) applyStep(index.value + 1);
      else pause();
    }
  }
  return {
    active,
    playing,
    index,
    elapsed,
    command,
    step,
    progress,
    finished,
    start,
    pause,
    resume,
    stop,
    move,
    tick,
  };
});
