# 点位模型与缩略图

| 文件 | 内容 |
| --- | --- |
| crater.glb / crater.png | 台阶状坑壁、坑底与中央峰，圆形渐隐边缘 |
| mare.glb / mare.png | 玄武岩平原、褶皱脊与断续高地山系 |
| lander.glb / lander.png | 隔热箔、桁架、光学设备与太阳能板 |
| regolith.glb | 着陆器/巡视器周围的月壤、碎石和接地暗部 |
| rover.png | public/月球车_写实贴图.glb 的渲染封面 |
| apollo.png | 现有阿波罗登月舱 GLB 的渲染封面；NASA / Michael D. Carbajal |

地貌、着陆器和月壤为项目原创程序几何；GLB 内嵌纹理，没有外部图片依赖。地貌网格仅用于科普结构展示，不代替测绘地形。巡视器直接使用用户提供的写实贴图模型，阿波罗使用原有 NASA 模型。旧 rover.glb 为此前生成资产，当前展示不再引用。

纹理由确定性噪声、颗粒、溅射条纹、隔热层褶皱与太阳能电池网格生成；Node 内置 PNG 编码器将纹理写进 GLB。地貌高差与纹理透明度在边缘共同降到零，因此没有矩形底座或垂直展示台。

在 `moon-web/web` 下运行：

```powershell
node scripts/generate-point-models.mjs
# 保持本地开发服务器运行：
node scripts/render-point-thumbnails.mjs
```

类别映射、展示缩放、底面高度和观察角度在 `src/data/pointModels.ts`。缩略图卡片只负责触发加载，`src/scene/PointModelLayer.ts` 将模型放入主地图的月球局部东—北—天坐标系，定位到点位经纬度并聚焦。设备类额外通过 `PointModelEnvironment.ts` 放置约 60 米宽的月壤局部环境；环境不拦截拾取，随模型移除和随 DEM 高度变化而更新。地貌类采用更俯视的观察角度。

主地图同时展示一个点位模型，可以聚焦或移除。异步加载结束前离开场景时，主模型与环境都会释放。点位 GeoJSON 结构与原有模型地址字段保持不变。
