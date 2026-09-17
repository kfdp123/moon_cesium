import { test, expect } from "@playwright/test";

test("map model remains visible on negative-height lunar DEM", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((url) => new URL(url).pathname === "/src/scene/MoonScene.ts")!;
    const { MoonScene } = await import(path),
      original = MoonScene.prototype.loadPointModel;
    MoonScene.prototype.loadPointModel = function (point: unknown) {
      (window as any).__moonScene = this;
      return original.call(this, point);
    };
  });
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await page.getByLabel("搜索点位", { exact: true }).fill("阿波罗 11");
  await page.locator(".point-title").first().click();
  await page
    .getByRole("button", { name: "加载阿波罗登月舱", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "聚焦模型", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }).check();
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__moonScene.pointModels.ground),
      { timeout: 20000 },
    )
    .toBeLessThan(-10);
  await page.getByRole("button", { name: "聚焦模型", exact: true }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "test-results/map-dem-visibility.png" });
  const result = await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((url) => new URL(url).pathname.endsWith("/cesium.js"))!;
    const { Cartesian2, Cartesian3 } = await import(path);
    const moon = (window as any).__moonScene,
      scene = moon.viewer.scene,
      model = moon.pointModels.model;
    const hits = [];
    for (let y = 0.38; y <= 0.62; y += 0.06)
      for (let x = 0.4; x <= 0.6; x += 0.05) {
        const hit = scene.pick(
          new Cartesian2(
            scene.canvas.clientWidth * x,
            scene.canvas.clientHeight * y,
          ),
        );
        if (hit?.id === "landmark:apollo11") hits.push([x, y]);
      }
    return {
      hits,
      ground: moon.pointModels.ground,
      centerHeight: scene.globe.ellipsoid.cartesianToCartographic(
        model.boundingSphere.center,
      ).height,
      cameraHeight: scene.globe.ellipsoid.cartesianToCartographic(
        moon.viewer.camera.positionWC,
      ).height,
      distance: Cartesian3.distance(
        model.boundingSphere.center,
        moon.viewer.camera.positionWC,
      ),
      radius: model.boundingSphere.radius,
    };
  });
  expect(result.hits.length, JSON.stringify(result)).toBeGreaterThan(0);
});
