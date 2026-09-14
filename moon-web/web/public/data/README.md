# 月球科普点位

`lunar-points.geojson`：388 个点，包括 380 个 USGS/IAU 地貌中心点与 8 个 LROC 着陆目标/巡视器记录点。

坐标约定：月球 ME/LOLA 参考资料，东经为正，范围 [-180,180]；纬度 [-90,90]。GeoJSON 的坐标排列采用 `[经度, 纬度]`，本文件表示月球，不能直接当作地球 WGS84 数据套用。

USGS/IAU 源数据为 [Moon KMZ](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz)，来自 [GIS 下载页](https://planetarynames.wr.usgs.gov/GIS_Downloads)。筛选月海、月洋和直径 ≥80 km 的主环形山，并保留精选名称。

8 个目标坐标来自 [LROC Science Operations Team / ASU 2016 坐标表](https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf)。巡视器位置是目录记录位置，不是实时位置。

数据整理日期：2026-09-14；转换脚本为 `moon-web/scripts/prepare_public_data.py`。点位资料记录各自来源；未核实的照片、模型和文献保持为空。

SHA-256：`01a3ed09bc8c1e3c4879dd225a68f109e0579bdac53d506e642d2b7041973681`。
