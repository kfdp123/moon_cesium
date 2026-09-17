import fs from "node:fs/promises";

// Gazetteer polygons locate named features. They are not geologic contacts.
const ids = [3691, 3678, 3686, 3671, 4395, 6163, 1296];
const regions = await Promise.all(
  ids.map(async (id) => {
    const source = `https://planetarynames.wr.usgs.gov/Feature/${id}`;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const html = await response.text();
    const wkt = html.match(/MULTIPOLYGON\s*(\(\(\([\s\S]*?\)\)\))/)?.[1];
    if (!wkt) throw new Error(`Missing polygon: ${id}`);
    const coordinates = JSON.parse(
      wkt
        .replace(/\(/g, "[")
        .replace(/\)/g, "]")
        .replace(
          /(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi,
          "[$1,$2]",
        ),
    );
    for (const polygon of coordinates)
      for (const ring of polygon)
        for (const point of ring) {
          point[0] = Number(
            (((((point[0] + 180) % 360) + 360) % 360) - 180).toFixed(5),
          );
          point[1] = Number(point[1].toFixed(5));
        }
    return { id: `usgs-${id}`, source, coordinates };
  }),
);
await fs.writeFile("src/data/pointRegions.json", JSON.stringify(regions));
console.log(`Saved ${regions.length} USGS named-feature regions.`);
