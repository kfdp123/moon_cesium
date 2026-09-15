import { Clock, ClockRange, ClockStep, JulianDate } from "cesium";
import { markRaw, ref } from "vue";
import { defineStore } from "pinia";

export const useAstronomy = defineStore("astronomy", () => {
  const clock = markRaw(
    new Clock({
      startTime: JulianDate.fromIso8601("2000-01-01T00:00:00Z"),
      stopTime: JulianDate.fromIso8601("2100-01-01T00:00:00Z"),
      currentTime: JulianDate.now(),
      clockRange: ClockRange.CLAMPED,
      clockStep: ClockStep.SYSTEM_CLOCK_MULTIPLIER,
      multiplier: 3600,
      shouldAnimate: false,
    }),
  );
  const view = ref<"moon" | "system">("moon");
  const lighting = ref(false);
  const shadows = ref(true);
  const inertialCamera = ref(true);
  const trueScale = ref(false);
  const command = ref(0);
  function seek(iso: string) {
    const date = JulianDate.fromIso8601(iso);
    clock.currentTime = JulianDate.clone(
      JulianDate.lessThan(date, clock.startTime)
        ? clock.startTime
        : JulianDate.greaterThan(date, clock.stopTime)
          ? clock.stopTime
          : date,
    );
    clock.shouldAnimate = false;
    command.value++;
  }
  function togglePlayback() {
    clock.shouldAnimate = !clock.shouldAnimate;
    if (clock.shouldAnimate) lighting.value = true;
    command.value++;
  }
  function shift(days: number) {
    seek(
      JulianDate.toIso8601(
        JulianDate.addDays(clock.currentTime, days, new JulianDate()),
      ),
    );
  }
  return {
    clock,
    view,
    lighting,
    shadows,
    inertialCamera,
    trueScale,
    command,
    seek,
    shift,
    togglePlayback,
  };
});
