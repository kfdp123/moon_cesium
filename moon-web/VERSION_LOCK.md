# S1 版本基线

首次构建日期：2026-09-14。精确依赖以 `web/package-lock.json` 为准，使用 `npm ci` 重现安装。

| 组件 | 版本 |
|---|---|
| Node.js（本机） | 20.19.1 |
| npm（本机） | 10.8.2 |
| Vue | 3.5.42 |
| Pinia | 3.0.4 |
| CesiumJS | 1.132.0 |
| @cesium/engine | 19.0.0 |
| @cesium/widgets | 13.0.0 |
| @zip.js/zip.js | 2.7.70 |
| Vite | 6.4.3 |
| TypeScript | 5.9.3 |
| @lucide/vue | 1.46.0 |
| Vitest | 4.1.11 |
| Prettier | 3.5.3 |

Cesium 的间接依赖必须一起固定：默认范围曾解析到 widgets 13.2.1，并带入另一个 engine 21.0.1，造成压缩库导出路径冲突。通过 overrides 固定与 Cesium 1.132.0 对应的组合，未修改 node_modules 源码或增加运行时兼容分支。

升级 Cesium 时一起重新检查 engine、widgets、zip.js 和静态 Workers 资源，再执行构建、几何测试与浏览器烟雾测试。此基线是功能兼容记录，不是完整安全审计。
