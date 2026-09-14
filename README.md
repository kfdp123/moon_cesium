# 月见 · Moon Explorer

面向科普演示的月球 Web 系统，使用 Vue、TypeScript 和 CesiumJS。当前是 S1 三维技术原型，不是完整合同交付版。

## 已实现

- NASA LRO 月表影像、经纬网、两个探索地标。
- 月表与内部结构切换。
- 参数化球壳、完整球/移除半球/移除四分之一，包含真实封口网格。
- 圈层显隐、三维拾取和与模型配置一致的说明面板。
- 3 个早期阶段与现今状态的示意配置、阶段播放和暂停。
- 场景图片导出，保留数据来源或模拟说明。

内部半径和阶段变化全部是模拟示意。月表目前是影像球面，尚未接入 DEM 地形、真实重力成果、数据库或管理后台。

## 本地运行

需要 Node.js 20.19 及以上兼容版本；本次使用 Node 20.19.1 验证。

```powershell
cd moon-web/web
npm ci
npm run dev
```

浏览器打开终端显示的 `http://127.0.0.1:5173/`。页面占用该端口时会报错，不自动切换到其他端口。

```powershell
npm test
npm run build
npm run preview
```

`build` 包含 TypeScript 类型检查。`dist/` 是静态构建产物，必须通过 HTTP 服务访问，不能直接双击 HTML。第一版支持在线使用，字体来自 Google Fonts；未完成断网验收。

月表资源可通过 `.env.local` 中的 `VITE_MOON_TEXTURE_URL` 指定。默认使用仓库附带的 NASA 2K 展示贴图。不要把凭据写进前端环境变量。

## 代码结构

```text
moon-web/web/src/
  data/moon.ts              # 阶段、圈层、地标与来源配置
  scene/shellGeometry.ts    # 独立于渲染引擎的球壳网格生成
  scene/MoonScene.ts        # Cesium 生命周期、相机、显示与拾取
  stores/explorer.ts        # 页面和场景的共享状态
  components/              # 场景容器、圈层列表
  App.vue                  # 页面布局和演示控制
```

几何生成测试检查封闭边、体积比例、法向和阶段边界。避免重复边界校验和预先抽象，具体约定见实施方案第 11.1 节。

## 设计与开发记录

- [详细实施方案](docs/月球Web科普系统详细实施方案.md)
- [开发任务清单](docs/开发任务清单.md)
- [开源调研](docs/开源调研与复用评估.md)
- [版本说明](moon-web/VERSION_LOCK.md)
- [第三方与素材说明](moon-web/THIRD_PARTY_NOTICES.md)

原合同、原始演示文件、压缩包、原始大数据和本地临时工具不进入 Git。设计文档中指向这些本地材料的链接在纯源码 checkout 中不可用。

本项目尚未指定自身代码的开放许可；第三方组件与素材按各自许可证和署名要求处理。
