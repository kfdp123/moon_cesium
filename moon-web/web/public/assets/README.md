# 月表显示资源

- 文件：`lroc_color_2k.jpg`
- 来源页：https://svs.gsfc.nasa.gov/4720/
- 文件地址：https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg
- 署名：NASA's Scientific Visualization Studio；底层数据来自 LRO/LROC 团队。
- 下载日期：2026-09-14。
- SHA-256：`f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170`
- 来源页说明：展示用颜色图，以 0° 经度为中心；不是直接用于数值查询的科学反照率栅格。

显示时覆盖经度 -180° 到 180°，纬度 -90° 到 90°。没有采用原 HTML 中错误引用的 `DwarfWarrior` 模型，也没有通过随意镜像/旋转来校准纹理。

该图是球面展示素材；实际 DEM 高程、参考框架与地标准确性验证需分别进行。没有在本版本把贴图亮度当成重力或高程值。

## V0.2 增加的素材

| 文件 | 来源与署名 | 转换 / SHA-256 |
|---|---|---|
| lola-dem.bin | [NASA SVS / LRO LOLA](https://svs.gsfc.nasa.gov/4720/)，源文件 ldem_4_uint.tif | 1440×720，Int16 little-endian 米制高程；原值×0.5−10000 后取整。`4dc16e9a33048fb8288c904bd82413bd489bb0e61525789714cc0cf64977f546` |
| apollo11.jpg | [NASA/JSC](https://science.nasa.gov/resource/view-apollo-11-lunar-module-as-it-rested-on-lunar-surface/) | NASA 图片服务返回 900px 版本。`b4aa953596d1652e296cf61f6a556387bb6cd9de4d43e5ecfa7211b8e03ad961` |
| apollo-lunar-module.glb | [NASA/Michael D. Carbajal](https://science.nasa.gov/3d-resources/apollo-lunar-module/) | 原始 GLB 文件，未修改。`379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e` |

高程网格参考球半径为 1737400 m，行从北向南、列从 -180° 向东，像元中心约定。此次高程范围 -8878 至 10504 m，0.25° 分辨率适合概览，不是合同最终高分辨率地形。转换取整误差不超过 0.5 m。

在线 WMTS 图层地址、矩阵与来源见 `src/data/mapLayers.ts` 和项目 `docs/V0.2扩展实施与数据说明.md`。原始第三方资料需保留对应署名；模型和图像不表示 NASA 对本应用的认可。

## 地球全球影像（V0.5 新增）

- 文件：`earth-blue-marble-200409.jpg`，原始 JPEG，5400 × 2700，1,709,729 字节；未裁剪或重采样。
- 来源：NASA Earth Observatory，Blue Marble: Next Generation，2004 年 9 月无云地表合成图。NASA image courtesy Reto Stöckli and Robert Simmon。
- 说明页：https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
- 原始文件：https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/september/world.200409.3x5400x2700.jpg
- SHA-256：`ed72e87674861f72e2a6e5df52f0cc6bf3df1edd9b862664cf18ac423e2e9e0e`
- 用途：WGS84 地球椭球表面颜色，不是当前时间轴日期的实时观测。与本地静态资源一同发布；保留 NASA 来源，不暗示 NASA 对应用背书。
