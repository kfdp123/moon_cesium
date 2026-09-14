"""Convert downloaded NASA/USGS data; no invented point coordinates or elevation."""
import json
import sys
import zipfile
import struct
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'tmp/data-deps'))
from PIL import Image

out = root / 'moon-web/web/public/data'
out.mkdir(parents=True, exist_ok=True)
ns = {'k': 'http://www.opengis.net/kml/2.2'}
with zipfile.ZipFile(root / 'tmp/moon-names.kmz') as archive:
    tree = ET.fromstring(archive.read('MOON_nomenclature_center_pts.kml'))
features = []
featured = {'Tycho': '第谷环形山', 'Copernicus': '哥白尼环形山', 'Mare Tranquillitatis': '静海', 'Mare Imbrium': '雨海', 'Mare Serenitatis': '澄海', 'Mare Crisium': '危海', 'Oceanus Procellarum': '风暴洋'}
for place in tree.findall('.//k:Placemark', ns):
    fields = {x.attrib['name']: x.text or '' for x in place.findall('.//k:SimpleData', ns)}
    name = fields['clean_name']
    kind = fields['type'].lower()
    code = 'CR' if kind.startswith('crater') else 'MA' if kind.startswith('mare') else 'OC' if kind.startswith('oceanus') else ''
    if code not in ('CR', 'MA', 'OC'): continue
    # Curated subset keeps the interactive catalog legible. Full original remains downloadable at USGS.
    if code == 'CR' and float(fields['diameter']) < 80 and name not in featured: continue
    coords = [float(x) for x in place.find('k:Point/k:coordinates', ns).text.split(',')[:2]]
    category = '环形山' if code == 'CR' else '月海'
    url = fields['link'].replace('http:', 'https:')
    features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': coords}, 'properties': {
        'id': 'usgs-' + url.rsplit('/', 1)[-1], 'name': featured.get(name, name), 'category': category,
        'description': f"{name}，IAU 命名月球{category}。目录直径约 {float(fields['diameter']):.1f} km。命名来源（USGS 原文）：{fields['origin']}。点表示地貌中心，不表示边界。",
        'source': url, 'visible': name in featured, 'images': [], 'modelUrl': '',
        'references': [], 'links': [{'title': 'USGS / IAU 地名记录', 'url': url}],
    }})
features.insert(0, {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [23.47314, 0.67416]}, 'properties': {
    'id': 'apollo11', 'name': '阿波罗 11 号着陆点', 'category': '着陆点', 'visible': True,
    'description': '1969 年首次载人登月任务的着陆位置，位于静海。照片为 NASA/JSC 的任务历史照片；登月舱模型由 NASA/Michael D. Carbajal 提供，不是现场三维扫描。',
    'source': 'https://www.nasa.gov/mission/apollo-11/',
    'images': [{'title': '阿波罗 11 号登月舱与奥尔德林 · NASA/JSC', 'url': '/assets/apollo11.jpg'}],
    'modelUrl': '/assets/apollo-lunar-module.glb',
    'references': [{'title': 'NASA · Apollo by the Numbers', 'url': 'https://www.nasa.gov/wp-content/uploads/2023/04/sp-4029.pdf'}],
    'links': [{'title': 'NASA 登月舱模型及署名', 'url': 'https://science.nasa.gov/3d-resources/apollo-lunar-module/'}],
}})
coordinates_source = 'https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf'
features[0]['properties']['references'].append({'title': 'LROC 人工目标坐标表（2016）', 'url': coordinates_source})
for mission, lat, lon, name in [
    ('apollo12', -3.0128, 336.5781, '阿波罗 12 号着陆点'),
    ('apollo14', -3.64589, 342.52806, '阿波罗 14 号着陆点'),
    ('apollo15', 26.13239, 3.63330, '阿波罗 15 号着陆点'),
    ('apollo16', -8.9734, 15.5011, '阿波罗 16 号着陆点'),
    ('apollo17', 20.1911, 30.7723, '阿波罗 17 号着陆点'),
    ('change3', 44.1214, 340.4883, '嫦娥三号着陆点'),
    ('yutu', 44.1208, 340.4878, '玉兔号巡视器（LROC 记录位置）'),
]:
    features.insert(1, {'type':'Feature', 'geometry':{'type':'Point','coordinates':[lon if lon <= 180 else lon - 360, lat]}, 'properties': {
        'id':mission, 'name':name, 'category':'着陆点' if mission != 'yutu' else '巡视器', 'visible':True,
        'description': '坐标由 LROC 科学团队发布，采用月球 ME 参考系。位置来自 2016 年目标目录；巡视器记录位置不是实时位置。',
        'source': coordinates_source, 'images': [], 'modelUrl': '',
        'references':[{'title':'LROC 人工目标坐标表（2016）','url':coordinates_source}], 'links':[],
    }})
(out / 'lunar-points.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False, indent=2), encoding='utf-8')
image = Image.open(root / 'tmp/ldem_4_uint.tif')
assert image.size == (1440, 720)
heights = [round(value * 0.5 - 10000) for value in image.getdata()]
(root / 'moon-web/web/public/assets/lola-dem.bin').write_bytes(struct.pack('<' + 'h' * len(heights), *heights))
print(f'{len(features)} points; DEM {image.size}; range {min(heights)} to {max(heights)} m')
