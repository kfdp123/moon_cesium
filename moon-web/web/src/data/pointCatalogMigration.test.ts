import { describe, expect, it } from "vitest";
import type { LunarPoint } from "../types";
import { pruneRetiredPoints } from "./pointCatalogMigration";

const ordinary: LunarPoint = {
  id: "usgs-12",
  name: "Abel",
  category: "环形山",
  longitude: 85,
  latitude: -34,
  description: "目录中的普通环形山",
  source: "https://planetarynames.wr.usgs.gov/Feature/12",
  visible: false,
  images: [],
  modelUrl: "",
  references: [],
  links: [{ title: "USGS / IAU 地名记录", url: "https://example.org/12" }],
};

describe("point catalog migration", () => {
  it("removes unchanged retired entries and preserves new and key sites", () => {
    const key = { ...ordinary, id: "apollo11" };
    const custom = { ...ordinary, id: "my-site", name: "我的观测点" };
    expect(pruneRetiredPoints([ordinary, key, custom], [ordinary])).toEqual([
      key,
      custom,
    ]);
  });

  it.each<Partial<LunarPoint>>([
    { visible: true },
    { name: "自定义名称" },
    { category: "我的类别" },
    { longitude: 86 },
    { latitude: -35 },
    { description: "新的展板说明" },
    { source: "https://example.org/source" },
    { images: [{ title: "照片", url: "/assets/photo.jpg" }] },
    { modelUrl: "/assets/model.glb" },
    { references: [{ title: "文献", url: "https://example.org/paper" }] },
    { links: [] },
  ])("retains edited retired entries: %j", (edit) => {
    const changed = { ...ordinary, ...edit };
    expect(pruneRetiredPoints([changed], [ordinary])).toEqual([changed]);
  });

  it("never restores points that the user deleted", () => {
    expect(pruneRetiredPoints([], [ordinary])).toEqual([]);
  });

  it("compares link values without relying on object property order", () => {
    const reordered = {
      ...ordinary,
      links: ordinary.links.map(({ title, url }) => ({ url, title })),
    };
    expect(pruneRetiredPoints([reordered], [ordinary])).toEqual([]);
  });
});
