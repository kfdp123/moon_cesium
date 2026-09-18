import { expect, test } from "@playwright/test";

test("scientific data catalog loads selected imagery and reports grid values", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("场景已就绪", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "科研数据", exact: true }).click();
  await expect(
    page.getByLabel("科研数据图层树", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".scientific-group")).toHaveCount(3);

  const image = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes("/data/cesium_data/imagery/gravity/faa_raw.png") &&
      response.status() === 200,
  );
  await page.locator(".scientific-layer input[type=checkbox]").first().check();
  await image;

  const canvas = page.locator(".cesium-surface canvas");
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: {
      x: bounds!.width * 0.55,
      y: bounds!.height * 0.72,
    },
  });
  await expect(page.getByText("科研数据查询", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".scientific-query-card dl div")).toHaveCount(1);
  expect(errors).toEqual([]);
});
