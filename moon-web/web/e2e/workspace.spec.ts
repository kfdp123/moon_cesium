import { test, expect } from "@playwright/test";

test("parameter scene, catalogs, model and navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("场景已就绪")).toBeVisible();
  await page.getByRole("button", { name: "参数模型", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "test-results/01-moon.png" });
  for (const name of ["移除一半", "完整球", "移除 ¼", "完整球", "移除一半"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(700);
    await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  }
  await page.screenshot({ path: "test-results/02-cutaway.png" });
  const warmPixels = await page
    .locator(".cesium-surface canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      const ctx = copy.getContext("2d")!;
      ctx.drawImage(canvas, 0, 0);
      const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] > 150 &&
          pixels[i + 1] > 70 &&
          pixels[i + 1] < 200 &&
          pixels[i + 2] < 150
        )
          count++;
      return count;
    });
  expect(warmPixels).toBeGreaterThan(10000);
  await page.getByLabel("月壳厚度", { exact: true }).fill("80");
  await page.getByLabel("月壳厚度", { exact: true }).press("Tab");
  await expect(page.getByLabel("总半径", { exact: true })).toHaveValue(
    "1772.4",
  );
  await page.getByRole("button", { name: "新增外部圈层" }).click();
  await expect(page.getByLabel("新增圈层厚度", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除新增圈层", exact: true }).click();
  await page
    .getByRole("button", { name: "保存当前年代参数", exact: true })
    .click();
  await page.reload();
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "参数模型", exact: true }).click();
  await expect(page.getByLabel("月壳厚度", { exact: true })).toHaveValue(
    "80.0",
  );
  await page.getByRole("button", { name: "科普探索", exact: true }).click();
  await page
    .locator(".point-title")
    .filter({ hasText: "阿波罗 11 号着陆点" })
    .click();
  await expect(
    page.getByRole("heading", { name: "阿波罗 11 号着陆点" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "加载阿波罗登月舱", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "聚焦模型", exact: true }),
  ).toBeEnabled({
    timeout: 20000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "test-results/03-point-details.png" });
  await page.getByLabel("关闭详情").click();
  await page.getByRole("button", { name: "月表漫游", exact: true }).click();
  for (const name of ["环游月面基地", "第一视角漫游", "人物第三视角"]) {
    if (!(await page.locator(".floating-panel").isVisible()))
      await page.getByRole("button", { name: "漫游方式", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.waitForTimeout(1500);
    await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
    await page.screenshot({ path: `test-results/04-${name}.png` });
  }
  await page.locator(".cesium-surface canvas").focus();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }).check();
  await expect(
    page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }),
  ).toBeChecked();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/05-dem.png" });
  expect(errors).toEqual([]);
});
