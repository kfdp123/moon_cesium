import { test, expect } from "@playwright/test";

test("NASA Earth imagery, atmosphere, orientation and focus work with the shared clock", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪").waitFor();
  const image = page.waitForResponse(
    (response) =>
      response.url().includes("earth-blue-marble-200409.jpg") &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "地月运动", exact: true }).click();
  await image;
  await page.getByText("场景已就绪").waitFor();
  await expect(page.getByText("地月场景加载失败")).toHaveCount(0);
  const date = page.getByLabel("模拟日期 UTC", { exact: true });
  await date.fill("2026-03-20T12:00");
  await date.press("Tab");
  await page.getByRole("button", { name: "聚焦地球", exact: true }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "test-results/earth-focus.png" });
  const canvas = page.locator(".cesium-surface canvas");
  const pixels = () =>
    canvas.evaluate((source: HTMLCanvasElement) => {
      const copy = document.createElement("canvas");
      copy.width = 500;
      copy.height = 300;
      const ctx = copy.getContext("2d")!;
      ctx.drawImage(source, 0, 0, 500, 300);
      return Array.from(ctx.getImageData(0, 0, 500, 300).data);
    });
  const withAtmosphere = await pixels();
  const land = withAtmosphere.filter(
    (v, i) => i % 4 === 0 && v > 50 && v > withAtmosphere[i + 2] * 1.2,
  ).length;
  expect(land).toBeGreaterThan(1500);
  await page.getByRole("button", { name: "运动设置", exact: true }).click();
  await page.getByLabel("地球大气光晕", { exact: true }).uncheck();
  await page.waitForTimeout(500);
  const bare = await pixels();
  expect(
    bare.filter((v, i) => Math.abs(v - withAtmosphere[i]) > 15).length,
  ).toBeGreaterThan(100);
  await page.screenshot({ path: "test-results/earth-atmosphere-off.png" });
  await page.getByLabel("地球大气光晕", { exact: true }).check();
  await date.fill("2026-03-20T18:00");
  await date.press("Tab");
  await page.waitForTimeout(500);
  const rotated = await pixels();
  expect(
    rotated.filter((v, i) => Math.abs(v - withAtmosphere[i]) > 25).length,
  ).toBeGreaterThan(1500);
  await page.getByRole("button", { name: "关闭操作面板", exact: true }).click();
  await page.getByRole("button", { name: "返回地月全景", exact: true }).click();
  await expect(date).toHaveValue("2026-03-20T18:00");
  await page.screenshot({ path: "test-results/earth-overview.png" });
  const calibration = await page.evaluate(
    async (modulePaths) => {
      const earth = await import(modulePaths[0]);
      const ephemeris = await import(modulePaths[1]);
      const cesium = await import(modulePaths[2]);
      const time = cesium.JulianDate.fromIso8601("2026-03-20T12:00:00Z");
      const rotation = earth.earthToInertial(time);
      const sun = ephemeris.lunarEphemeris(time).sun;
      const fixedSun = cesium.Matrix3.multiplyByVector(
        cesium.Matrix3.transpose(rotation, new cesium.Matrix3()),
        sun,
        new cesium.Cartesian3(),
      );
      const noonLongitude =
        (Math.atan2(fixedSun.y, fixedSun.x) * 180) / Math.PI;
      const geometry = cesium.EllipsoidGeometry.createGeometry(
        new cesium.EllipsoidGeometry({
          radii: cesium.Ellipsoid.WGS84.radii,
          vertexFormat:
            cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
          stackPartitions: 16,
          slicePartitions: 16,
        }),
      );
      const positions = geometry.attributes.position.values,
        uv = geometry.attributes.st.values;
      const offset = earth.earthMaterial(new Image()).uniforms.offset.x;
      let maxError = 0;
      for (let i = 0; i < positions.length / 3; i++) {
        const position = cesium.Cartesian3.fromArray(positions, i * 3);
        const site = cesium.Ellipsoid.WGS84.cartesianToCartographic(position);
        if (Math.abs(site.latitude) > 1.4) continue;
        const expected = site.longitude / (2 * Math.PI) + 0.5;
        const actual = (uv[i * 2] + offset) % 1;
        const delta = Math.abs(expected - actual);
        maxError = Math.max(maxError, Math.min(delta, 1 - delta));
      }
      return { noonLongitude, maxError };
    },
    [
      "/src/scene/earth.ts",
      "/src/scene/lunarEphemeris.ts",
      "/node_modules/.vite/deps/cesium.js",
    ],
  );
  expect(Math.abs(calibration.noonLongitude)).toBeLessThan(3);
  expect(calibration.maxError).toBeLessThan(1e-6);
  expect(errors).toEqual([]);
});
