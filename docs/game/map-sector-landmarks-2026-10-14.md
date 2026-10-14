# Map: sector landmarks (Stitch pictures for the Map tab)

Status: **written and tested, not merged, not deployed** (2026-10-14). Game mode only; with Game mode off the map is unchanged.

## What it is

Each sector's province on the Cartographer's table now carries one to three small scenery pictures that say what the sector is, drawn by Stitch in the Stitch Master look (ink outline, teal and slate, no text):

| Sector (matched loosely by name) | Pictures, most telling first |
|---|---|
| Materials (mining, metals, gold, commodities) | `map-gold-mine`, `map-gold-ingots`, `map-quarry` |
| Consumer Staples (food, agri, beverages) | `map-farmhouse`, `map-market-stall` |
| Consumer (discretionary, retail) | `map-market-stall` |
| Financials (bank, insurance) | `map-bank-vault` |
| Industrials (manufacturing, transport) | `map-factory` |
| Energy (oil, gas) | `map-windmill`, `map-watermill` |
| Utilities (power, electric) | `map-watermill`, `map-windmill` |
| Diversified Fund (fund, ETF) | `map-fountain-square` |

A province with no sector set, an unknown sector, the "Other sectors" fold, or a sector with no theme (Technology, Health care and so on) gets nothing. New themes are one line in `SECTOR_THEMES` (`frontend/src/lib/mapArt.ts`) plus a picture.

## Rules it follows

- **Scenery, no fact.** Same rule as the port and the island: no name, no button, no fog, no state. A landmark only repeats the sector name already printed on the land. It never reads the survey, the weight or a verdict, and looks identical whatever the survey says. The holdings stay the pressable settlements with their five fog patches drawn by code on top.
- **Small on purpose.** 18 to 34 world units tall against about 45 for a settlement and 78 for the Keep, with a soft ground shadow, so a landmark does not read as a holding (a bank vault or gold ingots next to a gold holding is the case to watch).
- **Placement is pure and deterministic** (`placeSectorLandmarks`): a fixed grid inside the province, on the mainland with a margin to the shore, clear of the capital, every settlement and the name under it, every province name, the port and island pictures, and each other. The best spot has the most room, pulled toward the province's heart. A province with no free spot gets fewer landmarks, never a covered holding.
- **Pictures follow Game mode** (no separate switch); a picture that fails to load drops out like the other map pictures. Decorative, `alt=""`, inside the `aria-hidden` map; the provinces legend and the survey list still say everything in words.

## What changed

- 10 pictures packed from the Stitch masters (`scripts/art/manifest.json`, `frontend/src/assets/art/map-*.webp`, 13 to 26 KB each, about 200 KB together; the set stays under the 2800 KB cap). Packed at `max_side` 320 since they are drawn tiny. Masters stay in the git-ignored `art-masters/` (the Stitch export folder `frontend/public/art/Map assets` is git-ignored too and was not committed).
- `lib/mapArt.ts`: `SECTOR_THEMES`, `sectorLandmarkIds`, `placeSectorLandmarks`. `lib/worldMap.ts`: `PROV_CHAR_EM` exported. `WorldMap.tsx`: draws them after the port and before the province names, so names and settlements stay on top.
- Tests: `mapArt.test.ts` (theming, determinism, on land, never on the capital, a holding, a name or another landmark, no sectors at all) and `mapSectorArt.test.tsx` (drawn with Game mode on, absent with it off, none for an unthemed sector, decorative).

## Game identity checklist (docs/game/game-sprint-checklist.md)

- Pages touched: the Map tab only. Identity before and after: the map already scored 2 or more (scene header, kit, fog patches, Plain view); this adds the sector visual verb: **"survey the sectors" in a painted realm where each province has its own landmark**.
- Visual win: a sector reads at a glance from its picture (mine, farm, vault) instead of only a printed name.
- Look-and-judge: **not done in a browser.** The placement was checked on a schematic render of your six sectors (grey boxes for the towers), not in the real app. Please look at the live Map after deploy (steps below).

## After deploy (Faiz)

- Open the Map with Game mode on. Expect: gold mine, ingots and quarry in Materials; farmhouse and stall in Consumer Staples; bank vault in Financials; factory in Industrials; windmill and watermill in Energy; market fountain in Diversified Fund.
- Check on a phone: no landmark covers a tower or a province name, and nothing looks pressable.
- If a landmark sits somewhere awkward, `KEEP_OUT` and the heights in `mapArt.ts` are the knobs.

## Not done / decisions for Faiz

- The pressable towers (settlements) are unchanged: a stock is a town or citadel, a fund the outpost, gold the vault, as decided on 2026-10-11. Making the holdings themselves sector-themed (a gold-mine picture for Xetra-Gold instead of the vault) would drop the fund/gold/stock distinction those pictures carry, so it needs your call.
- Prompts for further pictures (harbour, lighthouse, treasure isle, pine grove) were given in chat and are not generated yet.
