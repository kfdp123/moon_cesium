import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createChatHandler } from "./chat.mjs";
import { loadKnowledge } from "./knowledge.mjs";

const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const chat = createChatHandler({
  knowledge: () => loadKnowledge(new URL("../dist/data/", import.meta.url)),
});
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/lunar-chat") return chat(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const decoded = decodeURIComponent(pathname);
    const path = resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
    if (
      !path.startsWith(root + sep) ||
      decoded.split("/").some((part) => part.startsWith("."))
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file = await stat(path);
    if (!file.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "Content-Length": file.size,
    });
    if (req.method === "HEAD") res.end();
    else
      createReadStream(path)
        .on("error", () => res.destroy())
        .pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(
  Number(process.env.PORT || 4173),
  process.env.HOST || "127.0.0.1",
  () => {
    console.log(
      `Moon Web: http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 4173}`,
    );
  },
);
