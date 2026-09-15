import { expect, test, type Page } from "@playwright/test";

async function setDate(page: Page, value: string) {
  await page.getByLabel("模拟日期 UTC", { exact: true }).fill(value);
  await page.getByLabel("模拟日期 UTC", { exact: true }).press("Tab");
}
async function groundPixels(page: Page) {
  return page
    .locator(".cesium-surface canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = 500;
      copy.height = 300;
      const context = copy.getContext("2d")!;
      context.drawImage(canvas, 0, 0, 500, 300);
      const data = context.getImageData(0, 100, 500, 180).data;
      return Array.from(data).filter((_, i) => i % 4 === 0);
    });
}

test("native timeline controls one clock across lunar rotation and Earth orbit views", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "展开时间轴", exact: true }).click();
  await setDate(page, "2026-09-15T12:00");
  await page.getByRole("button", { name: "前进一天", exact: true }).click();
  await expect(page.getByLabel("模拟日期 UTC", { exact: true })).toHaveValue(
    "2026-09-16T12:00",
  );
  await page.getByLabel("时间倍速", { exact: true }).selectOption("86400");
  const before = await page.locator(".cesium-surface canvas").screenshot();
  await page.getByRole("button", { name: "播放天体运动", exact: true }).click();
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: "暂停天体运动", exact: true }).click();
  const date = page.getByLabel("模拟日期 UTC", { exact: true });
  const paused = await date.inputValue();
  expect(paused).not.toBe("2026-09-16T12:00");
  expect(
    (await page.locator(".cesium-surface canvas").screenshot()).equals(before),
  ).toBe(false);
  await page.waitForTimeout(500);
  await expect(date).toHaveValue(paused);
  const bar = page.locator(".cesium-timeline-bar");
  const bounds = await bar.boundingBox();
  await bar.click({ position: { x: bounds!.width * 0.65, y: 10 } });
  await expect(date).not.toHaveValue(paused);
  const scrubbed = await date.inputValue();
  await page.screenshot({ path: "test-results/time-moon.png" });
  await page.getByRole("button", { name: "地月运动", exact: true }).click();
  await page.getByText("场景已就绪").waitFor();
  await expect(date).toHaveValue(scrubbed);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/time-orbit.png" });
  const orbitBefore = await page.locator(".cesium-surface canvas").screenshot();
  await page.getByRole("button", { name: "前进一天", exact: true }).click();
  await page.waitForTimeout(400);
  expect(
    (await page.locator(".cesium-surface canvas").screenshot()).equals(
      orbitBefore,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "运动设置", exact: true }).click();
  await page.getByLabel("真实大小与距离比例", { exact: true }).check();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/time-real-scale.png" });
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await page.getByText("场景已就绪").waitFor();
  const saved = await date.inputValue();
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await page.locator(".timeline-track button").nth(1).click();
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await page.getByRole("button", { name: "展开时间轴", exact: true }).click();
  await expect(date).toHaveValue(saved);
  expect(errors).toEqual([]);
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  await expect(page.getByText("地月场景加载失败")).toHaveCount(0);
});

test("base shadows change ground pixels without moving the camera", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "展开时间轴", exact: true }).click();
  await setDate(page, "2026-09-15T12:00");
  await page.getByRole("button", { name: "光照设置", exact: true }).click();
  await page
    .getByRole("button", { name: "前往基地看阴影", exact: true })
    .click();
  await page.waitForTimeout(2000);
  const shaded = await groundPixels(page);
  await page.screenshot({ path: "test-results/time-shadow-on.png" });
  await page.getByRole("button", { name: "光照设置", exact: true }).click();
  await page.getByLabel("基地模型地面投影", { exact: true }).uncheck();
  await page.waitForTimeout(1000);
  const plain = await groundPixels(page);
  const darkerPixels = plain.filter(
    (value, i) => value - shaded[i] > 20,
  ).length;
  expect(darkerPixels).toBeGreaterThan(40);
  await page.getByRole("button", { name: "关闭操作面板", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "退出漫游", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/time-shadow-off.png" });
  expect(errors).toEqual([]);
});
