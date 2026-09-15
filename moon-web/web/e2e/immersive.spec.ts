import { expect, test } from "@playwright/test";

test("canvas fills the window and floating tools never resize it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  const canvas = page.locator(".scene-canvas");
  expect(await canvas.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 1600,
    height: 1000,
  });
  await expect(page.locator(".floating-panel")).toHaveCount(0);
  await expect(page.locator(".native-timeline")).toBeHidden();
  await page.screenshot({ path: "test-results/fullscreen-default.png" });
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await expect(
    page.getByLabel("NASA LRO 展示影像", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "参数模型", exact: true }).click();
  await expect(page.locator(".floating-panel")).toHaveCount(1);
  await expect(
    page.getByLabel("NASA LRO 展示影像", { exact: true }),
  ).toHaveCount(0);
  expect(await canvas.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 1600,
    height: 1000,
  });
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await page.locator(".timeline-track button").nth(1).click();
  await page.getByLabel("总半径", { exact: true }).fill("1800");
  await page.getByLabel("总半径", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await expect(page.locator(".floating-panel")).toHaveCount(0);
  await expect(page.locator(".timeline-track")).toHaveCount(0);
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await expect(page.getByLabel("总半径", { exact: true })).toHaveValue(
    "1800.0",
  );
  await page.screenshot({ path: "test-results/fullscreen-interior.png" });
  for (const width of [1366, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "月球探索", exact: true }).click();
    await page.getByRole("button", { name: "展开时间轴", exact: true }).click();
    await page.getByRole("button", { name: "图层管理", exact: true }).click();
    await page.screenshot({ path: `test-results/fullscreen-${width}.png` });
    expect(await canvas.boundingBox()).toEqual({
      x: 0,
      y: 0,
      width,
      height: 900,
    });
    const lastScene = await page
      .getByRole("button", { name: "地月运动", exact: true })
      .boundingBox();
    expect(lastScene!.x + lastScene!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(900);
    const panel = await page.locator(".floating-panel").boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    await page
      .getByRole("button", { name: "关闭操作面板", exact: true })
      .click();
    await page.getByRole("button", { name: "收起时间轴", exact: true }).click();
  }
  expect(errors).toEqual([]);
});

test("roaming restores the observation camera and keyboard input stays in the focused control", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "月表漫游", exact: true }).click();
  await page.waitForTimeout(1000);
  const canvas = page.locator(".cesium-surface canvas");
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(900, 500, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1800);
  const pixels = () =>
    canvas.evaluate((source: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = 300;
      copy.height = 200;
      const ctx = copy.getContext("2d")!;
      ctx.drawImage(source, 0, 0, 300, 200);
      return Array.from(ctx.getImageData(0, 0, 300, 200).data);
    });
  const before = await pixels();
  await page.getByRole("button", { name: /^第一视角漫游/ }).click();
  await expect(page.locator(".floating-panel")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await canvas.focus();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  await page.getByRole("button", { name: "展开时间轴", exact: true }).click();
  await page.getByLabel("模拟日期 UTC", { exact: true }).focus();
  await page.waitForTimeout(800);
  const stopped = await pixels();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  const focused = await pixels();
  const changedWhileTyping = stopped.filter(
    (value, i) => Math.abs(value - focused[i]) > 15,
  ).length;
  expect(changedWhileTyping / stopped.length).toBeLessThan(0.01);
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await page.waitForTimeout(1000);
  const restored = await pixels();
  const changed = before.filter(
    (value, i) => Math.abs(value - restored[i]) > 15,
  ).length;
  // Allow globe tile refinement, while rejecting a reset to the default view.
  expect(changed / before.length).toBeLessThan(0.03);
});
