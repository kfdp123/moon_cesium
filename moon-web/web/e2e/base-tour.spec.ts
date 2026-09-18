import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("base tour visits facilities, supports picking and free orbit, and restores the moon camera", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page.evaluate(async () => {
    // Reuse Vite's loaded module, including its cache key, to observe the real scene.
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/scene/MoonScene.ts")!;
    const { MoonScene } = await import(path);
    const original = MoonScene.prototype.setNavigation;
    MoonScene.prototype.setNavigation = function (mode: string) {
      (window as any).__moonScene = this;
      if (mode === "base-tour") {
        const camera = this.viewer.camera;
        const controller = this.viewer.scene.screenSpaceCameraController;
        (window as any).__baseReturnControls = {
          xOffset: camera.frustum.xOffset,
          minimumZoomDistance: controller.minimumZoomDistance,
          maximumZoomDistance: controller.maximumZoomDistance,
          enableTranslate: controller.enableTranslate,
        };
        (window as any).__baseReturnPose = [
          camera.positionWC,
          camera.directionWC,
          camera.upWC,
        ]
          .flatMap((value) => [value.x, value.y, value.z])
          .map((value) => Number(value.toFixed(5)));
      }
      return original.call(this, mode);
    };
  });
  const cameraPose = () =>
    page.evaluate(() => {
      const camera = (window as any).__moonScene.viewer.camera;
      return [camera.positionWC, camera.directionWC, camera.upWC]
        .flatMap((value) => [value.x, value.y, value.z])
        .map((value) => Number(value.toFixed(5)));
    });
  const settleShot = () =>
    expect
      .poll(
        () =>
          page.evaluate(() => {
            const tour = (window as any).__moonScene.navigation.baseTour;
            return (
              tour.transition === 1 &&
              tour.lastCommand === tour.controls.command
            );
          }),
        { timeout: 20000 },
      )
      .toBe(true);

  await page.getByRole("button", { name: "月表漫游", exact: true }).click();
  await page.getByRole("button", { name: /^环游月面基地/ }).click();
  const controls = page.getByRole("region", { name: "月面基地巡视控制" });
  const stops = controls.getByRole("navigation", { name: "基地巡视区域" });
  await expect(stops.getByRole("button")).toHaveCount(5);
  await controls.getByRole("button", { name: "暂停巡视", exact: true }).click();
  await settleShot();
  const overview = await cameraPose();
  await page.waitForTimeout(600);
  expect(await cameraPose()).toEqual(overview);
  await page.screenshot({ path: "test-results/base-overview.png" });

  // Find a visible label with Cesium's real pick buffer, then send a browser click.
  // This checks the map-to-tour wiring, rather than calling select() directly.
  const picked = await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname.endsWith("/cesium.js"))!;
    const { Cartesian2 } = await import(path);
    const moon = (window as any).__moonScene;
    const scene = moon.viewer.scene;
    const labels = moon.navigation.baseTour.labels;
    const bounds = scene.canvas.getBoundingClientRect();
    for (let index = 0; index < labels.length; index++) {
      const label = labels.get(index);
      const anchor = label.computeScreenSpacePosition(scene);
      for (const [dx, dy] of [
        [24, -12],
        [48, -12],
        [24, -4],
      ]) {
        const x = anchor.x + dx!;
        const y = anchor.y + dy!;
        if (
          document.elementFromPoint(bounds.left + x, bounds.top + y) !==
          scene.canvas
        )
          continue;
        const hit = scene.pick(new Cartesian2(x, y));
        if (hit?.id === label.id)
          return { x: bounds.left + x, y: bounds.top + y, index: index + 1 };
      }
    }
    return null;
  });
  expect(
    picked,
    "At least one facility label must be visible and pickable",
  ).not.toBeNull();
  await page.mouse.click(picked!.x, picked!.y);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__moonScene.navigation.baseTour.controls.index,
      ),
    )
    .toBe(picked!.index);

  await stops
    .getByRole("button", { name: "定位生活与实验舱", exact: true })
    .click();
  await expect(
    controls.getByRole("heading", { name: "生活与实验舱", exact: true }),
  ).toBeVisible();
  await settleShot();
  const habitat = await cameraPose();
  expect(habitat.slice(0, 3)).not.toEqual(overview.slice(0, 3));
  await page.screenshot({ path: "test-results/base-habitat.png" });
  await controls.getByRole("button", { name: "下一站", exact: true }).click();
  await expect(
    stops.getByRole("button", { name: "定位太阳能阵列", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await settleShot();
  expect((await cameraPose()).slice(0, 3)).not.toEqual(habitat.slice(0, 3));

  await controls.getByText("巡视设置", { exact: true }).click();
  const speed = controls.getByRole("slider", { name: "基地巡视速度" });
  await speed.focus();
  await speed.press("End");
  await expect(speed).toHaveValue("2");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__moonScene.navigation.baseTour.controls.speed,
      ),
    )
    .toBe(2);
  await controls.getByRole("button", { name: "继续巡视", exact: true }).click();
  await expect(
    controls.getByRole("heading", { name: "通信站", exact: true }),
  ).toBeVisible({ timeout: 25000 });
  await controls.getByRole("button", { name: "暂停巡视", exact: true }).click();
  await settleShot();
  await expect(
    stops.getByRole("button", { name: "定位通信站", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const labels = controls.getByRole("checkbox", {
    name: "区域标注",
    exact: true,
  });
  await labels.uncheck();
  const visibleLabels = () =>
    page.evaluate(() => {
      const collection = (window as any).__moonScene.navigation.baseTour.labels;
      return Array.from(
        { length: collection.length },
        (_, i) => collection.get(i).show,
      ).filter(Boolean).length;
    });
  await expect.poll(visibleLabels).toBe(0);
  await labels.check();
  await expect.poll(visibleLabels).toBe(1);
  await controls.getByText("巡视设置", { exact: true }).click();

  await controls.getByRole("button", { name: "自由观察", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__moonScene.viewer.scene.screenSpaceCameraController
            .enableInputs,
      ),
    )
    .toBe(true);
  const beforeDrag = await cameraPose();
  await page.mouse.move(980, 430);
  await page.mouse.down();
  await page.mouse.move(1130, 490, { steps: 6 });
  await page.mouse.up();
  await expect.poll(cameraPose).not.toEqual(beforeDrag);
  await page.evaluate(() => {
    (window as any).__baseLabels = (
      window as any
    ).__moonScene.navigation.baseTour.labels;
  });
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await expect(controls).toHaveCount(0);
  const cleanup = await page.evaluate(() => {
    const moon = (window as any).__moonScene;
    const controller = moon.viewer.scene.screenSpaceCameraController;
    return {
      baseRemoved: moon.navigation.base === undefined,
      tourRemoved: moon.navigation.baseTour === undefined,
      labelsDestroyed: (window as any).__baseLabels.isDestroyed(),
      cameraEnabled: moon.viewer.scene.screenSpaceCameraController.enableInputs,
      originalPose: (window as any).__baseReturnPose,
      cameraControls: {
        xOffset: moon.viewer.camera.frustum.xOffset,
        minimumZoomDistance: controller.minimumZoomDistance,
        maximumZoomDistance: controller.maximumZoomDistance,
        enableTranslate: controller.enableTranslate,
      },
      originalControls: (window as any).__baseReturnControls,
    };
  });
  expect(cleanup.baseRemoved).toBe(true);
  expect(cleanup.tourRemoved).toBe(true);
  expect(cleanup.labelsDestroyed).toBe(true);
  expect(cleanup.cameraEnabled).toBe(true);
  expect(cleanup.cameraControls).toEqual(cleanup.originalControls);
  expect(await cameraPose()).toEqual(cleanup.originalPose);

  await page.getByRole("button", { name: "漫游方式", exact: true }).click();
  await page.getByRole("button", { name: /^第一视角漫游/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__moonScene.navigation.mode),
    )
    .toBe("first-person");
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("base facilities stay grounded and pickable on lunar DEM, including after re-entry", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByText("场景已就绪", { exact: true }).waitFor();
  await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname === "/src/scene/MoonScene.ts")!;
    const { MoonScene } = await import(path);
    const original = MoonScene.prototype.applyMaps;
    MoonScene.prototype.applyMaps = function (...args: unknown[]) {
      (window as any).__moonScene = this;
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "图层管理", exact: true }).click();
  await page.getByLabel("LOLA 三维高程 · 0.25°", { exact: true }).check();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as any).__moonScene?.viewer.terrainProvider.credit?.html ??
            "",
        ),
      { timeout: 20000 },
    )
    .toContain("LOLA");
  await page.getByRole("button", { name: "月表漫游", exact: true }).click();
  await page.getByRole("button", { name: /^环游月面基地/ }).click();
  const controls = page.getByRole("region", { name: "月面基地巡视控制" });
  await controls
    .getByRole("button", { name: "定位生活与实验舱", exact: true })
    .click();
  await controls.getByText("巡视设置", { exact: true }).click();
  await controls
    .getByRole("checkbox", { name: "区域标注", exact: true })
    .uncheck();
  await controls.getByText("巡视设置", { exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const navigation = (window as any).__moonScene.navigation;
          return (
            navigation.baseTour.transition === 1 &&
            navigation.base.surfaces.every((primitive: any) => primitive.ready)
          );
        }),
      { timeout: 20000 },
    )
    .toBe(true);

  const facility = await page.evaluate(async () => {
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => new URL(url).pathname.endsWith("/cesium.js"))!;
    const { Cartesian2, Cartesian3, Matrix4 } = await import(path);
    const moon = (window as any).__moonScene;
    const scene = moon.viewer.scene;
    const navigation = moon.navigation;
    const ellipsoid = scene.globe.ellipsoid;
    const ground = navigation.world(new Cartesian3(0, 15, 0));
    const modelCenter = Matrix4.getTranslation(
      navigation.base.surfaces[0].modelMatrix,
      new Cartesian3(),
    );
    let modelHit: string | null = null;
    for (const x of [-18, 18]) {
      const center = navigation.world(new Cartesian3(x, 15, 6.3));
      const screen = scene.cartesianToCanvasCoordinates(center);
      for (const dx of [0, -8, 8]) {
        const hit = scene.pick(new Cartesian2(screen.x + dx, screen.y));
        // Labels are disabled: the hit must be rendered facility geometry.
        if (
          hit?.id === "base:habitat" &&
          navigation.base.surfaces.includes(hit.primitive)
        ) {
          modelHit = hit.id;
          break;
        }
      }
      if (modelHit) break;
    }
    (window as any).__firstBasePrimitives = navigation.base.primitives;
    return {
      modelHit,
      groundHeight: ellipsoid.cartesianToCartographic(ground).height,
      modelCenterHeight: ellipsoid.cartesianToCartographic(modelCenter).height,
      cameraHeight: ellipsoid.cartesianToCartographic(
        moon.viewer.camera.positionWC,
      ).height,
      distance: Cartesian3.distance(modelCenter, moon.viewer.camera.positionWC),
    };
  });
  expect(facility.modelHit, JSON.stringify(facility)).toBe("base:habitat");
  expect(facility.groundHeight).toBeLessThan(-10);
  expect(
    Math.abs(facility.modelCenterHeight - facility.groundHeight),
  ).toBeLessThan(1);
  expect(facility.cameraHeight - facility.groundHeight).toBeGreaterThan(10);
  expect(facility.cameraHeight - facility.groundHeight).toBeLessThan(300);
  expect(facility.distance).toBeGreaterThan(20);
  expect(facility.distance).toBeLessThan(500);
  await page.screenshot({ path: "test-results/base-dem.png" });

  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await expect(controls).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as any).__firstBasePrimitives.isDestroyed(),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "漫游方式", exact: true }).click();
  await page.getByRole("button", { name: /^环游月面基地/ }).click();
  await expect(controls).toBeVisible();
  await controls.getByRole("button", { name: "暂停巡视", exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).__moonScene.navigation.baseTour.transition,
        ),
      { timeout: 20000 },
    )
    .toBe(1);
  expect(
    await page.evaluate(() => {
      const navigation = (window as any).__moonScene.navigation;
      return (
        navigation.base.primitives !== (window as any).__firstBasePrimitives &&
        !navigation.base.primitives.isDestroyed() &&
        navigation.base.surfaces.every((primitive: any) => primitive.ready)
      );
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "退出漫游", exact: true }).click();
  await expect(page.getByText("月球场景暂时无法加载")).toHaveCount(0);
  expect(errors).toEqual([]);
});
