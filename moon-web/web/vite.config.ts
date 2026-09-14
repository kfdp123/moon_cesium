import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: ["Workers", "Assets", "Widgets", "ThirdParty"].map((folder) => ({
        src: `node_modules/cesium/Build/Cesium/${folder}`,
        dest: "cesium",
      })),
    }),
  ],
  define: { CESIUM_BASE_URL: JSON.stringify("/cesium/") },
  server: { port: 5173, strictPort: true },
});
