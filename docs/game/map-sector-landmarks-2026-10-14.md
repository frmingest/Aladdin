# Map: sector pictures as the towers (Stitch pictures for the Map tab)

Status: **written and tested, not merged, not deployed** (2026-10-14). Game mode only; with Game mode off the map is unchanged.

History: #154 first drew the ten Stitch pictures as small scenery beside the towers. Faiz said he meant them to **replace the towers**, so this change makes each holding's own picture its sector's picture and removes the separate scenery (a second set would have doubled every farmhouse and mine).

## What it is

A holding in a sector with a theme is drawn as that sector's picture instead of the generic town, citadel, outpost or vault. Sectors are matched loosely by name (`SECTOR_THEMES` in `frontend/src/lib/mapArt.ts`):

| Sector | Picture |
|---|---|
| Materials (mining, metals, gold) | `map-gold-mine` or `map-quarry`; gold itself (the bullion structure) gets `map-gold-ingots` |
| Consumer Staples (food, agri) | `map-farmhouse` or `map-market-stall` |
| Consumer (discretionary, retail) | `map-market-stall` |
| Financials (bank, insurance) | `map-bank-vault` |
| Industrials | `map-factory` |
| Energy (oil, gas) | `map-windmill` or `map-watermill` |
| Utilities | `map-watermill` or `map-windmill` |
| Diversified Fund (fund, ETF) | `map-fountain-square` |

Where a sector has more than one picture, a stable hash of the holding's id picks one, so a holding never changes picture when its weight does. A holding with no sector, an unknown sector, or a sector with no theme (Technology, Health care...) keeps the old picture from its structure and size (town, citadel, outpost, vault, granary), and the drawn SVG tower when nothing is known. New themes are one line in `SECTOR_THEMES` plus a picture.

## Decision and what it costs (Faiz, 2026-10-14)

The old pictures showed what kind of holding it was (a stock as town or citadel by size, a fund as the outpost, gold as the vault, cash as the granary). In a themed sector that is given up on the map: a fund in Industrials is now a factory. The distinction is still in the slate you open by pressing a tower and in the Fortress; gold keeps its own picture (bars) inside Materials. Revisit if the fund/stock split is missed.

## Rules it follows

- **The picture is chosen from the sector alone** (plus bullion for the gold bars): never the survey, the weight or a verdict, so surveying never makes a tower prettier or uglier.
- **Everything else is still drawn by code.** Drawing size still comes from the weight, and the five survey patches (fog, clear, not judged) are drawn over the picture where they always were, so an unknown fact stays fog. Same tower box, same hit area, same labels and keyboard behaviour.
- Pictures follow Game mode (no separate switch); a picture that fails to load falls back to the next choice. Decorative, `alt=""`, inside the `aria-hidden` map; the provinces legend, the slate and the survey list say everything in words.

## What changed

- 10 pictures packed from the Stitch masters (done in #154: `scripts/art/manifest.json`, `frontend/src/assets/art/map-*.webp`, about 200 KB together).
- `lib/mapArt.ts`: `sectorArtId`, `holdingArtId` (sector picture, else structure picture, else none), `sectorLandmarkIds`, `SECTOR_THEMES`. The scenery placement from #154 (`placeSectorLandmarks`) is removed. `WorldMap.tsx` draws the holding's picture through `holdingArtId`.
- Tests: `mapArt.test.ts` (theming, gold bars, stable choice, themed beats structure, unthemed keeps structure, nothing known gives none, every picture fits the slot) and `mapSectorArt.test.tsx` (drawn with Game mode on, absent with it off, unthemed keeps the old picture, decorative, five patches kept).

## Game identity checklist (docs/game/game-sprint-checklist.md)

- Page touched: the Map tab only. Visual verb: **survey the sectors**, in a realm where each tower looks like what the company does.
- Look-and-judge: **not done in the real app.** The layout was checked on a schematic render of the six real sectors (windmill, vault, factory, gold bars, market stall, gold mine all read at tower size). Please look at the live Map after deploy.

## After deploy (Faiz)

- Open the Map with Game mode on, desktop and phone. Expect: Xetra-Gold as gold bars, L&G Gold Mining as the mine or quarry, Salmon Evolution as the farmhouse or stall, Vår Energi as a windmill or watermill, Alfred Berg as the vault, Xtrackers as the factory, Heimdal as the market fountain.
- Check the fog patches still sit on each picture and read at phone size, and that wide pictures (fountain, farmhouse) are not too small. If one picture reads badly, the per-picture choice and size are in `mapArt.ts`.
