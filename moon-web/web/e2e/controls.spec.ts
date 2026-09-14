import { expect, test } from "@playwright/test";

test("layer branches and parameter sliders are operable", async ({ page }) => {
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  const thickness = page.getByRole("slider", {
    name: "月壳厚度滑块",
    exact: true,
  });
  await thickness.focus();
  await thickness.press("ArrowRight");
  await expect(page.getByLabel("月壳厚度", { exact: true })).toHaveValue(
    "46.0",
  );
  await expect(page.getByLabel("总半径", { exact: true })).toHaveValue(
    "1738.4",
  );
  await thickness.hover();
  await page.mouse.wheel(0, -100);
  await expect(page.getByLabel("月壳厚度", { exact: true })).toHaveValue(
    "47.0",
  );
  await page.screenshot({ path: "test-results/parameter-sliders.png" });
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByRole("button", { name: "月表影像分组", exact: true }).click();
  await expect(
    page.getByLabel("NASA LRO 展示影像", { exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "月表影像分组", exact: true }).click();
  await expect(
    page.getByLabel("NASA LRO 展示影像", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("显示全部月表影像", { exact: true }).check();
  await page.getByLabel("显示全部月表影像", { exact: true }).uncheck();
  await expect(
    page.getByLabel("NASA LRO 展示影像", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("LROC WAC 全球影像", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("NASA LRO 展示影像", { exact: true }).check();
  await page
    .getByRole("button", { name: "NASA LRO 展示影像设置", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "NASA LRO 展示影像透明度", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/layer-tree.png" });
});

test("outdoor walking remains available away from the base, with and without DEM", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "漫游场景", exact: true }).click();
  await page.getByRole("button", { name: /^第一视角漫游/ }).click();
  await page.waitForTimeout(2500);
  const canvas = page.locator(".cesium-surface canvas");
  const before = await canvas.screenshot();
  await canvas.focus();
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(18000);
  await page.keyboard.up("KeyS");
  await page.keyboard.up("ShiftLeft");
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.screenshot({ path: "test-results/surface-walk-away.png" });
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }).check();
  await expect(
    page
      .locator(".catalog-layer")
      .filter({ hasText: "LOLA 三维高程 · 0.25°" })
      .getByText("已加载", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "漫游场景", exact: true }).click();
  await page.getByRole("button", { name: /^人物第三视角/ }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "test-results/surface-walk-dem.png" });
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  expect(errors).toEqual([]);
});
