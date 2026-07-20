// One-shot script — NOT part of the running server.
// Run manually: node utils/fetchLightingData.js
// Writes data/bangalore-lighting.json (~5-15MB), commit that file to the repo.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const QUERY = `
[out:json][timeout:90];
area["name"="Bengaluru"]["admin_level"="8"]->.a;
(
  way["highway"]["lit"="yes"](area.a);
  way["highway"]["lit"="no"](area.a);
);
out geom;
`;

async function main() {
  console.log('Fetching...');

  let response;
  try {
    response = await axios.post(OVERPASS_URL, new URLSearchParams({ data: QUERY }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 120000, // Overpass itself times out at 90s server-side; give the client more headroom
    });
  } catch (e) {
    console.error('Overpass request failed:', e.message);
    console.error('This is a public, rate-limited, sometimes-flaky server — just retry in a minute or two.');
    process.exit(1);
  }

  const elements = response.data?.elements || [];
  console.log(`Got ${elements.length} ways`);

  const features = elements
    .filter((el) => el.type === 'way' && Array.isArray(el.geometry))
    .map((way) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: way.geometry.map((n) => [n.lon, n.lat]),
      },
      properties: {
        lit: way.tags?.lit,
        highway: way.tags?.highway,
      },
    }));

  const geojson = { type: 'FeatureCollection', features };

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'bangalore-lighting.json');
  fs.writeFileSync(outPath, JSON.stringify(geojson));

  console.log(`Written to ${outPath}`);
}

main().catch((e) => {
  console.error('Unexpected error:', e.message);
  process.exit(1);
});
