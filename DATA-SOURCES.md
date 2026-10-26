# Data provenance and redistribution

## Open ski database

- Publisher and download terms: https://www.openskidata.org/
- Resort records: https://tiles.openskimap.org/geojson/ski_areas.geojson
- Slope geometry: https://tiles.openskimap.org/geojson/runs.geojson
- Lift geometry: https://tiles.openskimap.org/geojson/lifts.geojson
- Build metadata: https://tiles.openskimap.org/metadata.json (preserved under `catalog.json` → `build`)
- Data schema: https://github.com/russellporter/openskidata-format
- Database license: Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/
- Attribution: Data from OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors (ODbL), Skimap.org, Who's On First, © Mapterhorn.

Downloaded once on 2026-10-26. The build finished at 2026-10-26T03:47:54.882Z; its OSM timestamp is 2026-10-25T01:00:00.000Z. Extracted operating downhill ski-area records associated with SE, NO, FI, IS or DK. Retained operating/unspecified-status LineString and MultiLineString downhill runs and lifts that refer to those area IDs. Split multiline geometry into individual lines, rounded geographic coordinates to seven decimals and elevation to decimetres, retained source IDs, names, references, difficulty and lift type, and computed metric lengths, bounding boxes and drop ranges. Feature associations can duplicate one physical line across area records. Source feature IDs are snapshot-specific hashes and must not be assumed stable between daily releases.

The modified database is shared in editable JSON form in `data/` under ODbL 1.0, with the original source links and provenance included. It can be used independently of this renderer. Data under ODbL is separate from the original rendering and game code.

## Elevation

- Distribution and encoding: https://mapterhorn.com/data-access/
- Provider and underlying-source attributions: https://mapterhorn.com/attribution/
- Tile template: https://tiles.mapterhorn.com/{z}/{x}/{y}.webp

Bundled heightfields sample 41 distinct zoom-12 tiles covering eight resorts. The tiles are Terrarium-encoded lossless WebP: height in metres = R × 256 + G + B / 256 − 32768. Each bundled `*.dem.json` contains bounds, grid size, source, encoding and references to row-group files containing a little-endian float32 base64 array. The original height bytes are preserved and covered by a SHA-256 checksum. Grids run west-to-east within each row and north-to-south between rows. They represent sampled terrain, not a new elevation survey. On-demand loading uses the same source and decoder in the browser.

The source-specific elevation attribution metadata is included in `mapterhorn-attribution.json`; preserve applicable source attribution and terms when redistributing the sampled heightfields. The fallback surface generated when DEM is unavailable is an estimate from the ODbL-licensed route-height data and is labelled approximate.

## Background map and libraries

- Natural Earth 1:50m country polygons: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
- Natural Earth public-domain terms: https://www.naturalearthdata.com/about/terms-of-use/
- Country outlines are a geographic subset of the Natural Earth data with display names retained and other properties removed.
- Three.js 0.170.0: https://www.npmjs.com/package/three/v/0.170.0 — MIT.
- Leaflet 1.9.4: https://leafletjs.com/ — BSD-2-Clause.

No proprietary ski-map imagery, Bonvo data, Bonvo music or Bonvo source code is included. Resort names identify places only. The game is independent of the resorts and data providers.

Library bundles are downloaded by `bootstrap.py` from the pinned registry distribution URLs in `vendor/manifest.json`. The manifest records SHA-256 checksums verified before the files are saved. Their license notices remain tracked in `vendor/`.

Larger vector snapshots and the resort catalogue are partitioned into referenced JSON files without dropping their source features. Country outline files include the five Nordic countries and selected nearby context; the full-country Russia polygon is omitted from this regional display.
