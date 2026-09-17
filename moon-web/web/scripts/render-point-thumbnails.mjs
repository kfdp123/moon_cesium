// 保持开发服务器运行后执行。封面直接由应用的 ModelPreview 渲染。
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(
  new URL("../public/assets/point-models/", import.meta.url),
);
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((e) => new URL(e.name).pathname.endsWith("/vue.js")),
  );
  const modules = await page.evaluate(() => {
    const resources = performance
      .getEntriesByType("resource")
      .map((e) => e.name);
    return {
      vue: resources.find((url) => new URL(url).pathname.endsWith("/vue.js")),
      preview: new URL("/src/components/ModelPreview.vue", location.href).href,
    };
  });
  await page.route("**/__model-thumbnail", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><head><style>body{margin:0}#stage,.model-preview,.model-canvas,.cesium-widget,canvas{width:640px!important;height:400px!important}canvas{display:block}.model-canvas{position:absolute;inset:0}.model-preview{position:relative}.cesium-viewer-bottom,.cesium-widget-credits{display:none}</style></head><body><div id="stage"></div></body></html>',
    }),
  );
  await page.goto("http://127.0.0.1:5173/__model-thumbnail");
  for (const name of ["crater", "mare", "lander", "rover", "apollo"]) {
    const url =
      name === "apollo"
        ? "/assets/apollo-lunar-module.glb"
        : name === "rover"
          ? "/月球车_写实贴图.glb"
          : `/assets/point-models/${name}.glb`;
    const png = await page.evaluate(
      async ({ modules, url }) => {
        const { createApp, h } = await import(modules.vue);
        const { default: Preview } = await import(modules.preview);
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`Thumbnail timed out: ${url}`)),
            25000,
          );
          const app = createApp({
            render: () =>
              h(Preview, {
                url,
                onThumbnail: (image) => {
                  clearTimeout(timer);
                  resolve(image);
                  setTimeout(() => app.unmount(), 0);
                },
              }),
          });
          app.mount(document.getElementById("stage"));
        });
      },
      { modules, url },
    );
    writeFileSync(
      `${output}/${name}.png`,
      Buffer.from(png.split(",")[1], "base64"),
    );
    console.log(`Rendered ${name}`);
  }
} finally {
  await browser.close();
}
