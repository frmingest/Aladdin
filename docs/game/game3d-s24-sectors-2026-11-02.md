# S24: one sector table, and reading counts as opened (2026-11-02)

Status: written and tested here, not pushed, not deployed.

## What changed
- `frontend/src/lib/sectors.ts` is now the only place a sector is turned into a look. Each row holds the sector words, the Map pictures it may show, and the dive scene it opens. The 3D theme comes from the picture, so it can never drift from the flat Map.
- `mapArt.ts` and `mapScenes.ts` read from that table. Their old word lists are gone.
- `holdingTheme3d(sector, holdingId, structure)` gives the 3D theme: mine, quarry, ingots, farm, stall, bank, factory, windmill, watermill, fountain, or plain. It uses the same stable hash as the Map, gold gets ingots, and an unknown sector is plain. Tests check a table of sectors, ids and structures against `sectorArtId`.
- Reading the latest report at the 3D reading table now calls `markReportOpened`, which uses the same `saveOpened` flag as the Scrolls page. The survey's "report opened" check clears. Opened, not understood. The one-line call sits in `openReport` in `Game3DPage.tsx`; the helper lives in `game3d/libraryReport.ts`.

## Where the two lists clashed (Map pictures won)
- Consumer Discretionary and Retail: the Map shows a market stall, the dive showed the workshop. The dive now opens on the exchange floor. The workshop stays for Automobiles, Luxury, Apparel, Hotels and similar words the Map has no picture for.
- Order changed for a few mixed names: a sector that says both "fund" and "gold", or "Financial Technology", now follows the Map row that matches first (fountain, bank). Gold by name or by structure still dives to the mines.
- Health Care and Tech: the Map has no picture for them, so nothing clashes. They keep the apothecary and guild hall in the dive, and the 3D theme is plain for now. Defence also keeps the forge. A 3D theme for these needs new art.
- Metals the Map never pictured (silver, copper, platinum, quarry) keep the mines dive and a plain 3D theme. If Faiz wants a mine picture there too, it is one new row, but it would change the flat Map.

## Tests
- New `lib/sectors.test.ts`: parity with the Map for every sector, id and structure; Map and dive agree; unknown stays plain.
- New cases in `game3d/libraryReport.test.ts`: the opened flag is shared and survives blocked storage.
- `mapScenes.test.ts`: Discretionary and Retail now expect the exchange floor; one added case for Automobiles.
- Checked: tsc, lint (two old warnings), 1320 tests, build.
