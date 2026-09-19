import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { createChatHandler } from "./server/chat.mjs";

function lunarChat() {
  const handler = createChatHandler();
  const install = (server: { middlewares: import("vite").Connect.Server }) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split("?")[0] === "/api/lunar-chat") void handler(req, res);
      else next();
    });
  };
  return {
    name: "lunar-chat",
    configureServer: install,
    configurePreviewServer: install,
  };
}

export default defineConfig({
  plugins: [
    vue(),
    lunarChat(),
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
