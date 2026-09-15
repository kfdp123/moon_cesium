import { beforeEach, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEvolutionTour } from "./evolutionTour";
import { useExplorer } from "./explorer";
beforeEach(() => setActivePinia(createPinia()));
it("pauses without losing time, finishes at today, and restarts", () => {
  const tour = useEvolutionTour(),
    explorer = useExplorer();
  tour.start();
  tour.tick(2);
  tour.pause();
  tour.tick(4);
  expect(tour.elapsed).toBe(2);
  expect(explorer.evolutionRunning).toBe(false);
  tour.resume();
  for (let i = 0; i < 70; i++) tour.tick(1);
  expect(tour.progress).toBe(60);
  expect(tour.index).toBe(7);
  expect(explorer.epochIndex).toBe(3);
  expect(tour.playing).toBe(false);
  tour.resume();
  expect(tour.index).toBe(0);
  expect(tour.elapsed).toBe(0);
});
it("keeps edited model dimensions when the guide visits other epochs", () => {
  const tour = useEvolutionTour(),
    explorer = useExplorer();
  explorer.setRadius(1900);
  tour.start();
  for (let i = 0; i < 7; i++) tour.move(1);
  expect(explorer.radiusKm).toBeCloseTo(1900);
  tour.stop();
  expect(tour.active).toBe(false);
  expect(tour.playing).toBe(false);
});
