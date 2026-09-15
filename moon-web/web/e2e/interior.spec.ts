import { test, expect } from "@playwright/test";
test("interior exhibit expands, focuses and returns to exploration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await expect(page.locator(".floating-panel")).toHaveCount(0);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/exhibit-default.png" });
  await page.getByRole("button", { name: "分层展开", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: "test-results/exhibit-expanded.png" });
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "test-results/exhibit-return.png" });
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await page.getByRole("button", { name: "分层展开", exact: true }).click();
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: "聚焦外核", exact: true }).click();
  await page.waitForTimeout(1400);
  await expect(page.locator(".floating-detail")).toBeVisible();
  await page.screenshot({ path: "test-results/exhibit-focus.png" });
  await page.getByRole("button", { name: "整体观察", exact: true }).click();
  await expect(page.locator(".floating-detail")).toHaveCount(0);
  await page.getByRole("button", { name: "合拢圈层", exact: true }).click();
  for (const mode of ["full", "half", "quarter", "full", "half"]) {
    await page.getByLabel("展台剖切", { exact: true }).selectOption(mode);
    await page.waitForTimeout(400);
  }
  await page.locator(".timeline-track button").first().click();
  await page.getByRole("button", { name: "参数模型", exact: true }).click();
  await page.getByLabel("总半径", { exact: true }).fill("1900");
  await page.getByLabel("总半径", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await expect(page.locator(".interior-controls")).toHaveCount(0);
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  expect(errors).toEqual([]);
});
