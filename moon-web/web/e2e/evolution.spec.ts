import { test, expect } from "@playwright/test";
test("evolution guide supports pause, all phases, manual selection and exit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.getByRole("button", { name: "内部与演化", exact: true }).click();
  await page.getByRole("button", { name: "播放演示", exact: true }).click();
  const tour = page.getByRole("region", { name: "演化讲解" });
  await expect(tour.getByText("从月表出发", { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await tour.getByRole("button", { name: "暂停讲解", exact: true }).click();
  const progress = tour.getByRole("progressbar");
  const paused = await progress.getAttribute("value");
  await page.waitForTimeout(600);
  await expect(progress).toHaveAttribute("value", paused!);
  await tour.getByRole("button", { name: "继续讲解", exact: true }).click();
  for (let step = 1; step <= 7; step++) {
    await tour.getByRole("button", { name: "下一步", exact: true }).click();
    await page.waitForTimeout(step >= 4 ? 3000 : 1000);
    await page.screenshot({ path: `test-results/evolution-step-${step}.png` });
    await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  }
  await tour.getByRole("button", { name: "结束讲解", exact: true }).click();
  await expect(tour).toHaveCount(0);
  await page.locator(".timeline-track button").first().click();
  await page.getByRole("button", { name: "暂停过程", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "播放过程", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await expect(page.locator(".stage-motion")).toHaveCount(0);
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  expect(errors).toEqual([]);
});
