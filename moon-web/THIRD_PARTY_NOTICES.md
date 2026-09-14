# 第三方组件与数据

项目不宣称拥有第三方组件、素材和商标。

| 项目 | 用途 | 许可证/来源 |
|---|---|---|
| CesiumJS | 三维场景渲染 | Apache-2.0，https://github.com/CesiumGS/cesium |
| Vue、Pinia | 页面与状态 | MIT，https://github.com/vuejs/core ，https://github.com/vuejs/pinia |
| Lucide | 界面图标 | ISC，https://github.com/lucide-icons/lucide |
| NASA SVS CGI Moon Kit | 月表展示纹理 | https://svs.gsfc.nasa.gov/4720/ ，按来源要求保留 NASA SVS 署名 |
| NASA / LOLA | 实际高程数据 | https://svs.gsfc.nasa.gov/4720/ ，数据来源 LRO/LOLA 团队 |
| NASA Trek | 在线影像与专题图 | https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon ，保留图层来源 |
| USGS / IAU 地名目录 | 地貌中心点 | https://planetarynames.wr.usgs.gov/GIS_Downloads ，保留每条记录链接 |
| LROC Science Operations Team / ASU | 着陆目标坐标 | https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf |
| NASA/JSC | 阿波罗 11 号照片 | https://science.nasa.gov/resource/view-apollo-11-lunar-module-as-it-rested-on-lunar-surface/ |
| NASA/Michael D. Carbajal | 阿波罗登月舱 GLB | https://science.nasa.gov/3d-resources/apollo-lunar-module/ |
| Noto Sans SC、Space Grotesk | 在线界面字体 | Google Fonts，字体各自的 SIL Open Font License |

直接复制第三方代码：本版未复制 MMGIS、Lunar Trek、MoonDemo 或 Three.js 剖切示例代码。球壳几何按本项目需求实现，参考项目用于方案调研。

显示资源来源和校验和见 `web/public/assets/README.md`。应用保留 Cesium 自带 credit 展示；构建中的库许可证注释和随包许可证不应移除。发布包若分发第三方依赖，需一并保留相应许可证文件。
