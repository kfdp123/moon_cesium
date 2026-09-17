import { test, expect } from "@playwright/test";

test("NASA tiles load in the browser and layer settings survive refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  for (const [name, product] of [
    ["LROC WAC 全球影像", "LRO_WAC_Mosaic_Global_303ppd_v02"],
    ["LOLA DEM 彩色晕渲", "LRO_LOLA_ClrShade_Global_256ppd_v06"],
    ["LOLA DEM 阴影地形图", "LRO_LOLA_Shade_Global_256ppd_v06"],
    ["月球统一地质图", "Unified_Geologic_Map_of_the_Moon_RASTER"],
  ]) {
    const tile = page.waitForResponse(
      (r) => r.url().includes(product) && r.status() === 200,
      { timeout: 20000 },
    );
    await page.getByLabel(name, { exact: true }).check();
    await tile;
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `test-results/layer-${product}.png` });
    await page.getByLabel(name, { exact: true }).uncheck();
  }
  await page.getByLabel("LROC WAC 全球影像", { exact: true }).check();
  await page.getByRole("button", { name: "保存图层配置", exact: true }).click();
  await page.reload();
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await expect(
    page.getByLabel("LROC WAC 全球影像", { exact: true }),
  ).toBeChecked();
});

test("point create, edit, map picking, export, import and persistence", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await page.getByRole("button", { name: "资料管理", exact: true }).click();
  await page.getByRole("button", { name: "新增点位", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "编辑点位" });
  await dialog.getByLabel("名称", { exact: true }).fill("测试点位");
  await dialog
    .getByLabel("文字介绍", { exact: true })
    .fill("测试资料，不是科学结论");
  await dialog.getByRole("button", { name: "保存点位", exact: true }).click();
  await page.reload();
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await page.getByLabel("搜索点位", { exact: true }).fill("测试点位");
  await page.locator(".point-title").first().click();
  await expect(
    page.getByRole("heading", { name: "测试点位", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByLabel("关闭详情").click();
  const canvas = page.locator(".cesium-surface canvas");
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } });
  await expect(
    page.getByRole("heading", { name: "测试点位", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await page.getByRole("button", { name: "资料管理", exact: true }).click();
  await page.getByLabel("搜索点位", { exact: true }).fill("测试点位");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  expect((await exported).suggestedFilename()).toBe("moon-points.geojson");
  await page.getByRole("button", { name: "编辑测试点位", exact: true }).click();
  await dialog.getByLabel("名称", { exact: true }).fill("测试点位已修改");
  await dialog.getByRole("button", { name: "保存点位", exact: true }).click();
  await page
    .getByRole("button", { name: "编辑测试点位已修改", exact: true })
    .click();
  await dialog.getByRole("button", { name: "删除点位", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "编辑测试点位已修改", exact: true }),
  ).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles({
    name: "test.geojson",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [12, 3] },
            properties: { id: "imported", name: "导入样例" },
          },
        ],
      }),
    ),
  });
  await page.getByLabel("搜索点位", { exact: true }).fill("导入样例");
  await expect(
    page.getByRole("button", { name: "导入样例 自定义", exact: true }),
  ).toBeVisible();
});

test("narrow window keeps the workspace usable", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "参数模型", exact: true }).click();
  await page.getByRole("button", { name: "移除 ¼", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/narrow.png", fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(760);
});
