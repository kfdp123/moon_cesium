import { test, expect } from "@playwright/test";
test("rover drives, pauses, switches cameras and cleans up on exit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  await page.evaluate(async () => {
    const source = await (await fetch("/src/scene/RoverNavigation.ts")).text();
    const modulePath = source.match(/from "([^"]*cesium[^\"]*)"/)![1];
    const { Camera } = await import(modulePath);
    const lookUp = Camera.prototype.lookUp;
    Camera.prototype.lookUp = function (angle: number) {
      lookUp.call(this, angle);
      (window as any).__roverCamera = this;
    };
  });
  const cameraPose = () =>
    page.evaluate(() => {
      const camera = (window as any).__roverCamera;
      return [camera.positionWC, camera.directionWC, camera.upWC]
        .flatMap((p) => [p.x, p.y, p.z])
        .map((n) => Number(n.toFixed(6)));
    });
  await page.getByRole("button", { name: "月表漫游", exact: true }).click();
  await page.getByRole("button", { name: /^月球车轨迹行驶/ }).click();
  await page.getByText("月球车已就绪", { exact: true }).waitFor();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "暂停行驶", exact: true }).click();
  const distance = page.locator(".rover-controls .panel-note").first();
  const paused = await distance.textContent();
  await page.waitForTimeout(700);
  await expect(distance).toHaveText(paused!);
  const canvas = page.locator(".cesium-surface canvas");
  for (const view of ["固定跟随", "车载第一视角"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await canvas.focus();
    await page.waitForTimeout(500);
    const before = await canvas.screenshot();
    await page.keyboard.down("ArrowRight");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(700);
    const turned = await canvas.screenshot();
    expect(turned.equals(before)).toBe(false);
    const pose = await cameraPose();
    await page.mouse.move(850, 500);
    await page.mouse.down();
    await page.mouse.move(1050, 600, { steps: 8 });
    await page.mouse.up();
    expect(await cameraPose()).toEqual(pose);
    await page.getByRole("slider", { name: "月球车行驶速度" }).focus();
    await page.keyboard.press("ArrowRight");
    expect(await cameraPose()).toEqual(pose);
    await expect(distance).toHaveText(paused!);
  }
  await page.getByRole("button", { name: "固定跟随", exact: true }).click();
  await page.screenshot({ path: "test-results/rover-follow.png" });
  await page.getByRole("button", { name: "自由视角", exact: true }).click();
  await page.mouse.move(850, 500);
  await page.mouse.down();
  await page.mouse.move(1000, 540, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/rover-free.png" });
  await page.getByRole("button", { name: "车载第一视角", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/rover-first.png" });
  await page.getByRole("button", { name: "继续行驶", exact: true }).click();
  await page.waitForTimeout(1600);
  await expect(distance).not.toHaveText(paused!);
  await page.getByRole("button", { name: "暂停行驶", exact: true }).click();
  await page.getByRole("button", { name: "回到起点", exact: true }).click();
  await expect(distance).toContainText("0 /");
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await expect(page.locator(".rover-controls")).toHaveCount(0);
  await page.getByRole("button", { name: "漫游方式", exact: true }).click();
  await page.getByRole("button", { name: /^月球车轨迹行驶/ }).click();
  await page.getByText("月球车已就绪", { exact: true }).waitFor();
  await page.getByRole("button", { name: "固定跟随", exact: true }).click();
  await page.getByRole("button", { name: "月球探索", exact: true }).click();
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  expect(errors).toEqual([]);
});
