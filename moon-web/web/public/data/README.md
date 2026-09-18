# 月球科普点位

`lunar-points.geojson`：15 个用于系统展板的重点点位，包括 7 个 USGS/IAU 命名地貌中心点与 8 个 LROC 着陆目标/巡视器记录点。普通批量地貌点不随首屏目录加载。

坐标约定：月球 ME/LOLA 参考资料，东经为正，范围 [-180,180]；纬度 [-90,90]。GeoJSON 的坐标排列采用 `[经度, 纬度]`，本文件表示月球，不能直接当作地球 WGS84 数据套用。

USGS/IAU 源数据为 [Moon KMZ](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz)，来自 [GIS 下载页](https://planetarynames.wr.usgs.gov/GIS_Downloads)。系统目录保留静海、雨海、澄海、危海、风暴洋以及哥白尼、第谷等重点展板对象；完整旧目录仅用于升级旧浏览器缓存。

8 个目标坐标来自 [LROC Science Operations Team / ASU 2016 坐标表](https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf)。巡视器位置是目录记录位置，不是实时位置。

数据整理日期：2026-09-14；转换脚本为 `moon-web/scripts/prepare_public_data.py`。旧版批量目录保存在迁移文件 `data/migrations/point-catalog-v2.json`，仅用于识别用户是否编辑过已退休条目。点位资料记录各自来源；未核实的照片、模型和文献保持为空。

SHA-256：`3657666a661b2841f0446973644fef2feb83aa9e7c15dc6b991599830dc2c2b2`。

## 科研 Cesium 数据包

科研图层目录位于 `/data/cesium_data/catalog.json`，由 `catalog.json` 统一描述图像、网格、内部模型、区域专题和热演化资料。该数据包约 446 MB，不随 Git 提交；部署前将 `files/cesium_data` 复制或映射到 `moon-web/web/public/data/cesium_data`，浏览器按勾选和点击查询按需读取，不会首屏下载全部网格。
