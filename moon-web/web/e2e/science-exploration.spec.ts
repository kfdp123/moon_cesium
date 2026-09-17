import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const legacyContent: { id: string }[] = JSON.parse(readFileSync(new URL("../src/data/legacyPointContent.json", import.meta.url), "utf8"));

test("science welcome, mapped regions, guided routes and illustrated exhibits", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await expect(page.getByLabel("精选探索", { exact: true })).toBeVisible();
  await expect(page.locator(".exploration-theme-card")).toHaveCount(3);
  for (const img of await page.locator(".exploration-theme-card img").all())
    await expect
      .poll(() =>
        img.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/scene/MoonScene.ts")!;
    const { MoonScene } = await import(path),
      reset = MoonScene.prototype.resetCamera;
    MoonScene.prototype.resetCamera = function (animate: boolean) {
      (window as any).__moonScene = this;
      return reset.call(this, animate);
    };
  });
  await page.getByRole("button", { name: "收起精选探索", exact: true }).click();
  await page.getByRole("button", { name: "重置视角", exact: true }).click();
  await page.waitForTimeout(1000);
  const geometry = await page.evaluate(async () => {
    const moon = (window as any).__moonScene;
    const entries = moon.viewer.entities.values;
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname.endsWith("/cesium.js"))!;
    const { Cartesian3, SceneTransforms } = await import(path);
    const pixel = SceneTransforms.worldToWindowCoordinates(
      moon.viewer.scene,
      Cartesian3.fromDegrees(35, 5, 0, moon.viewer.scene.globe.ellipsoid),
    );
    return {
      regions: entries.filter((entity: any) => entity.polygon).length,
      lines: entries.filter((entity: any) => entity.polyline).length,
      icons: entries.filter((entity: any) => entity.billboard).length,
      pixel: { x: pixel.x, y: pixel.y },
    };
  });
  expect(geometry.regions).toBeGreaterThanOrEqual(7);
  expect(geometry.lines).toBeGreaterThanOrEqual(7);
  expect(geometry.icons).toBeGreaterThanOrEqual(15);
  await page.mouse.move(geometry.pixel.x, geometry.pixel.y);
  await expect(page.locator(".point-hover")).toContainText("静海");
  await page.mouse.click(geometry.pixel.x, geometry.pixel.y);
  await expect(
    page.getByRole("heading", { name: "静海", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".science-story-facts > div")).toHaveCount(3);
  await page
    .locator(".science-story-resources")
    .first()
    .locator("summary")
    .click();
  expect(
    await page.locator(".science-story-resources").first().locator("a").count(),
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "精选探索", exact: true }).click();
  await page
    .locator(".exploration-theme-card")
    .filter({ hasText: "撞击地貌" })
    .click();
  await expect(
    page.getByRole("heading", { name: "第谷环形山", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("科普线路", { exact: true })).toContainText(
    "1 / 2",
  );
  await page.getByRole("button", { name: "下一站", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "哥白尼环形山", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("科普线路", { exact: true })).toContainText(
    "2 / 2",
  );
  await page.getByRole("button", { name: "结束科普线路", exact: true }).click();
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await expect(page.locator(".science-point-card")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "新增点位", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "资料管理", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "新增点位", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("curated content stays available with a saved catalog", async ({
  page,
}) => {
  const original = await (
    await page.request.get("/data/lunar-points.geojson")
  ).json();
  for (const feature of original.features) {
    const legacy = legacyContent.find(
      (item) => item.id === feature.properties.id,
    );
    if (legacy) Object.assign(feature.properties, legacy);
  }
  original.features[0].properties.name = "我的登月展板";
  await page.addInitScript((data) => {
    if (!localStorage.getItem("moon-points-v1"))
      localStorage.setItem("moon-points-v1", JSON.stringify(data));
  }, original);
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page.locator(".exploration-shortcuts button").first().click();
  await expect(
    page.getByRole("heading", { name: "我的登月展板", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".science-story-cover img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(page.locator(".science-story-resources")).toHaveCount(2);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("moon-points-v1")!);
    const point = data.features.find(
      (feature: any) => feature.properties.id === "apollo11",
    ).properties;
    point.images = [];
    point.references = [];
    point.links = [];
    localStorage.setItem("moon-points-v1", JSON.stringify(data));
  });
  await page.reload();
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page.locator(".exploration-shortcuts button").first().click();
  await expect(page.locator(".science-story-cover")).toHaveCount(0);
  // An unavailable bundled catalog must not make saved exhibits disappear.
  await page.evaluate(() =>
    localStorage.removeItem("moon-points-content-version"),
  );
  await page.route("**/data/lunar-points.geojson", (route) => route.abort());
  await page.reload();
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page.locator(".exploration-shortcuts button").first().click();
  await expect(
    page.getByRole("heading", { name: "我的登月展板", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 760, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(760);
});

test("edited categories and deleted featured sites keep science routes usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const data = await (
    await page.request.get("/data/lunar-points.geojson")
  ).json();
  data.features = data.features.filter(
    (feature: any) => feature.properties.id !== "apollo11",
  );
  data.features.find(
    (feature: any) => feature.properties.id === "usgs-3691",
  ).properties.category = "自定义";
  await page.addInitScript((value) => {
    localStorage.setItem("moon-points-v1", JSON.stringify(value));
    localStorage.setItem("moon-points-content-version", "2");
  }, data);
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page
    .locator(".exploration-theme-card")
    .filter({ hasText: "登月足迹" })
    .click();
  await expect(
    page.getByRole("heading", { name: "嫦娥三号着陆点", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("科普线路", { exact: true })).toContainText(
    "1 / 2",
  );
  await page.getByRole("button", { name: "下一站", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "玉兔号巡视器", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("月球场景暂时无法加载", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
