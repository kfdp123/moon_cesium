import { test, expect } from "@playwright/test";

test("point thumbnails place models on the lunar map with a single canvas", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [],
    requested: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().endsWith(".glb"))
      requested.push(decodeURI(new URL(request.url()).pathname));
  });
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
  for (const [query, title, id] of [
    ["第谷环形山", "环形山构造", "crater"],
    ["静海", "月海与周缘高地", "mare"],
    ["嫦娥三号", "月面着陆器", "lander"],
    ["玉兔号", "月面巡视器", "rover"],
    ["阿波罗 11", "阿波罗登月舱", "apollo"],
  ]) {
    await page.getByRole("button", { name: "科普探索", exact: true }).click();
    await page.getByLabel("搜索点位", { exact: true }).fill(query!);
    await page.locator(".point-title").first().click();
    const card = page.getByRole("region", {
      name: "点位三维模型",
      exact: true,
    });
    const thumbnail = card.getByRole("button", {
      name: `加载${title}`,
      exact: true,
    });
    await thumbnail.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    const url =
      id === "apollo"
        ? "/assets/apollo-lunar-module.glb"
        : id === "rover"
          ? "/月球车_写实贴图.glb"
          : `/assets/point-models/${id}.glb`;
    expect(requested).not.toContain(url);
    await thumbnail.click();
    await expect(
      page.getByRole("button", { name: "聚焦模型", exact: true }),
    ).toBeEnabled({ timeout: 20000 });
    expect(requested).toContain(url);
    await expect(thumbnail).toContainText("定位模型");
    await expect(card.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".cesium-widget canvas")).toHaveCount(1);
    const placement = await page.evaluate(async () => {
      const path = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .find((url) => new URL(url).pathname.endsWith("/cesium.js"))!;
      const { Cartesian3, Matrix4, Math: CesiumMath } = await import(path);
      const scene = (window as any).__moonScene,
        layer = scene.pointModels,
        model = layer.model,
        point = layer.point;
      const cartographic =
        scene.viewer.scene.globe.ellipsoid.cartesianToCartographic(
          Matrix4.getTranslation(model.modelMatrix, new Cartesian3()),
        );
      return {
        longitude: CesiumMath.toDegrees(cartographic.longitude),
        latitude: CesiumMath.toDegrees(cartographic.latitude),
        expected: [point.longitude, point.latitude],
        attached: scene.viewer.scene.primitives.contains(model),
        radius: model.boundingSphere.radius,
        distance: Cartesian3.distance(
          scene.viewer.camera.positionWC,
          model.boundingSphere.center,
        ),
      };
    });
    expect(placement.attached).toBe(true);
    expect(placement.longitude).toBeCloseTo(placement.expected[0], 5);
    expect(placement.latitude).toBeCloseTo(placement.expected[1], 5);
    expect(placement.distance / placement.radius).toBeGreaterThan(2);
    expect(placement.distance / placement.radius).toBeLessThan(6);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `test-results/map-point-model-${id}.png` });
    await page.mouse.move(760, 430);
    await page.mouse.down();
    await page.mouse.move(830, 475, { steps: 6 });
    await page.mouse.up();
    await page.getByRole("button", { name: "聚焦模型", exact: true }).click();
    await expect(
      page.getByText("月球场景暂时无法加载", { exact: true }),
    ).toHaveCount(0);
  }
  // 关闭资料不删除地图模型；移除按钮才释放模型。
  await page.getByRole("button", { name: "关闭详情", exact: true }).click();
  await expect(page.getByLabel("地图模型操作", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }).check();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Math.abs((window as any).__moonScene.pointModels.ground),
        ),
      { timeout: 20000 },
    )
    .toBeGreaterThan(10);
  await page.getByRole("button", { name: "聚焦模型", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/map-point-model-dem.png" });
  await page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }).uncheck();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs((window as any).__moonScene.pointModels.ground),
      ),
    )
    .toBeLessThan(0.1);
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByRole("button", { name: "移除地图模型", exact: true }).click();
  await expect(page.getByLabel("地图模型操作", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as any).__moonScene.pointModels.model),
  ).toBeUndefined();

  // 延迟请求结束前退出工作区，模型不得在之后重新出现。
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await page.getByLabel("搜索点位", { exact: true }).fill("阿波罗 11");
  await page.locator(".point-title").first().click();
  await page.route("**/assets/apollo-lunar-module.glb", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page
    .getByRole("button", { name: "加载阿波罗登月舱", exact: true })
    .click();
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await page.waitForTimeout(1300);
  await expect(page.getByLabel("地图模型操作", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
