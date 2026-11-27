# Geographic data attribution

Version 0.2 source update (27 November 2026): additional raw inputs and derived
terrain for Åre, Trysil and Thredbo are under `data/featured/resorts/<slug>/`, with exact
source URLs and hashes in each `sources.json`. Their piste/lift databases and
derived distance grids retain ODbL 1.0; elevation retains Mapterhorn's per-source
licences and the included full attribution catalogue. No single blanket licence
is asserted for all elevation providers. Romme's original inputs remain below.

Downloaded on 26 November 2026 (UTC). This notice applies to the standalone HTML
as well as the data folder. Geographic files keep their original licences.

## Pistes, lifts and derived piste-distance grid

© OpenStreetMap contributors. Data processed by OpenSkiMap/OpenSkiData and Bonvo.
Available under the Open Database License (ODbL) 1.0.

- Attribution: https://www.openstreetmap.org/copyright
- Licence: https://opendatacommons.org/licenses/odbl/1-0/
- Bonvo's explicit data reuse statement: https://bonvo.ski/en/credits
- Release: `2026-09-22-f6378027`
- Romme resort identifier: `f54edf4eb846b74ae58ad68a608eef4ae1599627`

The original `runs.geojson` and `lifts.geojson` are included unchanged. Local
route coordinates in `data/featured/resorts/romme-alpin/metadata.json` and `piste-distance.u16` are derivative data,
offered under ODbL 1.0. Changes: projection to local coordinates, selection of
operating downhill line features, direction ordering by terrain height, route
length calculation, and rasterisation of distances to piste centre lines.
Polygons are not used as playable route centre lines.

Source files:

- https://data.bonvo.ski/data/v2/releases/2026-09-22-f6378027/resorts/f54edf4eb846b74ae58ad68a608eef4ae1599627_runs.geojson
- https://data.bonvo.ski/data/v2/releases/2026-09-22-f6378027/resorts/f54edf4eb846b74ae58ad68a608eef4ae1599627_lifts.geojson

## Terrain

© Mapterhorn and the underlying elevation-data providers. Original source
attribution catalogue: `data/mapterhorn-attribution.json` and its referenced
parts, retained from https://download.mapterhorn.com/attribution.json. The
catalogue is split into local files for repository transport.

- Data access and encoding: https://mapterhorn.com/data-access/
- Attribution: https://mapterhorn.com/attribution/
- Tile source: `https://tiles.mapterhorn.com/13/{x}/{y}.webp`
- Selected tiles: x = 4445..4447, y = 2360..2362.

The catalogue identifies Swedish source `se`, **Markhöjdmodell Nedladdning**, from
**Lantmäteriet**, under **CC0**:
https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/markhojdmodell-nedladdning/.

It also lists the global Copernicus GLO-30 source, under the COPERNICUS full,
free and open licence. Retained producer notice:

Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
2014-2018, provided under COPERNICUS by the European Union and ESA.

The complete catalogue covers the world; it does not establish the source of
each individual pixel in these nine tiles. Preserve the catalogue and relevant
source notices when redistributing derived terrain.

Changes: Terrarium RGB decoding, bilinear sampling, reprojection to a local
east/south grid, and storage as little-endian Float32 elevations. `height.f32`
and route heights are derived from these tiles. The original terrain is not
sculpted to imitate Bonvo's piste grooming.

## Renderer and application

Three.js 0.172.0 / r172: MIT, original notice in `vendor/THREE-LICENSE.txt`.
The npm tarball's SHA-512 integrity was verified before its renderer modules were
included. See `vendor/provenance.json`.

Original application code is under `LICENSE.txt`. Its MIT licence does not
relicense the geographic data. Procedural rider and tree geometry were created
for this prototype. No original Bonvo model or application bundle is included.
