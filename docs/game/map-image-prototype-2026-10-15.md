# Map on the painted Stitch picture (prototype)

Status: prototype merged (#161) behind `?map=image`; Faiz saw it live and approved (2026-10-15), so it is now the default in Game mode (branch `feature/map-image-default`, written, not yet deployed). The old drawn map comes back with `?map=classic` on the Map tab's address.

## What it is, in plain words

Today the Map draws a made-up continent from code. This prototype lays the same settlements, fog patches and flags on the new hand-painted Stitch map instead: two continents, thirteen regions, a small island in the strait for the Great Keep and a dashed islet for holdings with no sector. The land is only scenery. What the map says still comes from your holdings.

## What changed in how the map works

- A sector is always the same region, so the map never moves when weights change (today the provinces can move). Table: Materials, Energy, Industrials, Consumer Staples, Consumer Discretionary in the west; Information Technology, Financials, Health Care, Diversified Fund, Communication Services, Real Estate, Utilities and "Other sectors" in the east. Real-economy sectors are in the west; the busiest sectors sit in the biggest regions.
- A holding with no sector is drawn on the dashed islet, named "No sector set" (or "Sector unknown"). A sector that matches none of the twelve goes to "Other sectors". Both truth rules from the current map are kept: unknown stays visible and is never folded into a real sector.
- A holding is never drawn in a region other than its own. When a region is crowded the pictures shrink and sit closer (floor about 0.24 of full size); they never spill into a neighbour.
- The picture of a holding is chosen exactly as before (sector picture, fog patches on top). Roads, ships, serpent, compass, sea and the brass frame are not drawn in this mode: the painted picture carries the scenery.
- The Great Keep stands on the strait island, drawn at 62 percent size.

## Files

- `frontend/src/assets/map/map-base.webp`: the picture (93 KB, from `frontend/public/art/New map/screen.png`; kept out of `assets/art` so the art manifest guard is not touched).
- `frontend/src/lib/imageMapRegions.ts`: generated outlines of the regions, from `frontend/public/art/New map/regions.json` (traced from the picture by flood fill). If the picture changes, trace it again.
- `frontend/src/lib/imageMap.ts`: pure placement (`placeImageRealm` returns the same `Realm` shape as `placeRealm`), sector-to-region table, `?map=image` switch.
- `WorldMap.tsx` gets an `imageMap` prop (default false; the old map is untouched); `RealmMapBody.tsx` reads the switch.
- Tests: `lib/imageMap.test.ts`, `components/fortress/kit/worldMapImage.test.tsx`.

## Look and judge (Game identity checklist)

Page touched: the Map tab only. Visual verb: **survey the sectors** on a drawn world. Look-and-judge: **not done in the live app.** The real component was rendered with test data (a normal 11-holding book and a 31-holding stress case) and viewed in Chromium at 1000 x 640. Seen: pictures sit centred in their regions, names readable in a normal book, the Keep fits its island, the dashed islet carries "no sector" holdings. Please open the live Map with `?map=image` once deployed.

## Known limits

- Five or more holdings in one small region (for example 5 in Information Technology) are cramped at zoom 1; names and pictures overlap until you zoom. The biggest regions take about 5 comfortably, the smallest about 3.
- The picture is 1376 x 768 and is fitted to the world's width, so there is a plain parchment band above and below it. Zoom is still the old 1 to 4.5; the ink lines go soft past about 2.5. A larger version of the same picture would fix both.
- Province tints (the legend swatches) are drawn faintly over the regions so the legend and the map agree; they are categorical colour, never a state.
- Region wording on screen is the map's ("Information Technology"); the app's own sector strings are matched loosely.
- The 13th region ("Other sectors") is rarely used. The Keep island is about 60 px across, so the Keep is small.

## Decisions taken (Faiz, 2026-10-15)

All of: use the 13-region picture as it is (no split or merge), 12 sectors + "Other sectors", the dashed islet as "No sector set", the sector-to-region assignment above, and a prototype behind a flag first.

## After deploy (Faiz)

Open the Map with Game mode on and `?map=image` on desktop and phone: check the fog patches read on each picture, how crowded your busiest sector looks, and whether you want the larger re-render from Stitch (a bigger copy of the same map picture, same regions, so the zoom stays sharp).
