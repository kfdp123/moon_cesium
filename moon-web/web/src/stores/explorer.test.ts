import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useExplorer } from "./explorer";

describe("editable radial model", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("keeps contiguous boundaries after thickness edits, adding and removing layers", () => {
    const store = useExplorer();
    store.setThickness("crust", 80);
    expect(store.radiusKm).toBeCloseTo(1772.4);
    store.addLayer();
    const id = store.layers[0].id;
    expect(store.radiusKm).toBeCloseTo(1792.4);
    store.removeLayer(id);
    expect(store.radiusKm).toBeCloseTo(1772.4);
    for (let i = 0; i < store.layers.length - 1; i++)
      expect(store.layers[i].innerRadiusKm).toBe(
        store.layers[i + 1].outerRadiusKm,
      );
    expect(store.layers.at(-1)!.innerRadiusKm).toBe(0);
  });
  it("scales the entire model and restores a phase without leaking edits", () => {
    const store = useExplorer();
    store.setRadius(2000);
    expect(store.radiusKm).toBeCloseTo(2000);
    expect(
      store.layers[0].outerRadiusKm - store.layers[0].innerRadiusKm,
    ).toBeCloseTo((45 * 2000) / 1737.4);
    store.setEpoch(0);
    expect(store.layers).toHaveLength(3);
    store.setEpoch(3);
    expect(store.radiusKm).toBe(1737.4);
  });
  it("rejects invalid edits at the input boundary without changing the model", () => {
    const store = useExplorer();
    expect(() => store.setThickness("crust", -3)).toThrow();
    expect(() => store.setRadius(NaN)).toThrow();
    expect(store.radiusKm).toBe(1737.4);
  });
});
