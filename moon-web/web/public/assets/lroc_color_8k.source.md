# 月球 8K 全球底图来源

- 文件：`lroc_color_8k.jpg`，8192 × 4096 像素，RGB。
- 来源：[NASA Scientific Visualization Studio — CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)，**2019 年版本**。
- 可视化制作：Ernie Wright（USRA）；署名：NASA's Scientific Visualization Studio。
- 基础数据：LRO / LROC WAC 全球彩色拼接影像，极区结合 LOLA 反照率数据。
- 原始 TIFF：[lroc_color_poles_8k.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif)。原文件 50,641,970 字节，下载于 2026-09-17，留存在工作区 `tmp/poi-upgrade/`。
- 转换：使用工作区已有 Pillow 12.3，将 TIFF RGB 转存为 JPEG，`quality=90, subsampling=0, optimize=True`。保留原尺寸、方向、颜色与经纬度对应关系；未裁切、调色、锐化或补绘。
- 输出大小：7,790,543 字节（约 7.43 MiB）。
- SHA-256：`2dec6a93b89f55fd3c6cb457bab80cc8a4d1012b1015359b0d00c3db99fa2c05`。

等经纬度图以 0° 经线居中。该产品为 NASA 面向三维渲染制作的全球纹理；原始科学数据、处理说明和完整署名见上方官方来源。8K 全球纹理可改善球体与区域级观察，不提供米级地面细节。
