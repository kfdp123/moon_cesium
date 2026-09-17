import { test, expect } from "@playwright/test";

test("lunar blocks render, query, animate and return to the globe", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  // 只在测试中取得实例，用真实世界坐标投影验证 Canvas 拾取。
  await page.evaluate(async () => {
    const entry = performance
      .getEntriesByType("resource")
      .map((item) => item.name)
      .find((url) => new URL(url).pathname === "/src/scene/GeologyScene.ts")!;
    const { GeologyScene } = await import(entry);
    const original = GeologyScene.prototype.setModel;
    GeologyScene.prototype.setModel = function (stage: number, phase: number) {
      (window as any).__geologyScene = this;
      return original.call(this, stage, phase);
    };
  });
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await page.getByRole("button", { name: "局部构造", exact: true }).click();
  await expect(
    page.getByLabel("月球局部构造展台", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".floating-time")).toHaveCount(0);
  await page.waitForTimeout(1800);
  await expect(page.locator(".geology-error")).toHaveCount(0);
  await page.screenshot({ path: "test-results/geology-impact.png" });
  const stages = page.getByRole("group", { name: "局部地质场景", exact: true });
  await stages.getByRole("button", { name: "01 岩浆海" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/geology-magma.png" });
  await page.getByRole("button", { name: "岩浆海熔体", exact: true }).click();
  await expect(page.getByLabel("局部构造详情")).toContainText("热量传输");
  await page.getByRole("button", { name: "关闭构造详情" }).click();
  await stages.getByRole("button", { name: "02 分异与火山" }).click();
  await page
    .getByRole("button", { name: "岩浆储集区与通道", exact: true })
    .click();
  await expect(page.getByLabel("局部构造详情")).toContainText("通道穿过月壳");
  await page.screenshot({ path: "test-results/geology-volcano-detail.png" });
  await page
    .getByRole("button", { name: "隐藏岩浆储集区与通道", exact: true })
    .click();
  await expect(page.getByLabel("局部构造详情")).toHaveCount(0);
  await page
    .getByRole("button", { name: "显示岩浆储集区与通道", exact: true })
    .click();
  const hit = await page.evaluate(async () => {
    const entry = performance
      .getEntriesByType("resource")
      .map((item) => item.name)
      .find((url) => new URL(url).pathname.endsWith("/cesium.js"))!;
    const { Cartesian3, SceneTransforms } = await import(entry);
    const viewer = (window as any).__geologyScene.viewer;
    const p = SceneTransforms.worldToWindowCoordinates(
      viewer.scene,
      new Cartesian3(3, -4.51, -0.65),
    );
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(hit.x, hit.y);
  await expect(page.getByLabel("局部构造详情")).toContainText("斜长石");
  await page.getByRole("button", { name: "关闭构造详情" }).click();
  await page.getByRole("button", { name: "剖面", exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/geology-section.png" });
  await page.getByRole("button", { name: "播放过程", exact: true }).click();
  await expect(page.getByLabel("局部演化步骤")).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "岩浆储集区与通道", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("局部演化步骤")).toHaveValue("1", {
    timeout: 7000,
  });
  await page.getByRole("button", { name: "暂停过程", exact: true }).click();
  await page.waitForTimeout(4500);
  await expect(page.getByLabel("局部演化步骤")).toHaveValue("1");
  await page.getByLabel("局部演化步骤").fill("2");
  await page.getByRole("button", { name: "透视", exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/geology-volcano.png" });
  await page.getByRole("button", { name: "俯视", exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/geology-top.png" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出场景图片", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("lunar-geology-volcanism.png");
  await page.setViewportSize({ width: 900, height: 850 });
  await page.getByRole("button", { name: "月壳", exact: true }).click();
  await expect(page.getByLabel("局部构造详情")).toBeVisible();
  await page.screenshot({ path: "test-results/geology-narrow.png" });
  await page.getByRole("button", { name: "关闭构造详情" }).click();
  await page.getByRole("button", { name: "整体月球", exact: true }).click();
  await expect(page.getByLabel("剖面展台", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "局部构造", exact: true }).click();
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await expect(
    page.getByLabel("月球局部构造展台", { exact: true }),
  ).toHaveCount(0);
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await expect(page.locator(".cesium-widget-errorPanel")).toHaveCount(0);
  expect(errors).toEqual([]);
});
