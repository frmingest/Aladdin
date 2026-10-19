# Map: dive into a scene (2026-10-19)

Press a settlement on the Cartographer's map (Game mode) and the camera falls into it while a brass-edged round window opens onto a full painted scene of what the holding does for a living. "Back to the map" (or Escape) closes the window and pulls the camera back out.

**Visual verb + scene:** fall into the settlement; the iris opens on the mines, forge, mill, farm or exchange.

## Which scene (`frontend/src/lib/mapScenes.ts`, `sceneFor`)

Chosen from the holding's sector, name and structure only. Never from the survey, weight or a verdict, and the picture carries no fact.

| Scene | When |
| --- | --- |
| Mines | bullion structure; sector says gold, silver, copper, metals, mining, materials, commodities; or the holding's own name says Gold, Silver, Copper, Miners, Bullion... |
| Forge | industrials, defence, aerospace, manufacturing, transport |
| Mill | energy, oil and gas, utilities, power, renewables |
| Farm | consumer staples, food, agriculture, beverages |
| Exchange | financials, funds/ETFs, **and every sector with no scene of its own** (technology, health, real estate, discretionary, unknown) |

## Motion (`SceneDive.tsx`, `sceneDive.css`, `WorldMap.tsx`)

Camera flies in 900 ms (zoom blended in log space); the iris starts at 480 ms and takes 760 ms; the scene settles from a 1.7x crop and then drifts slowly. Out: iris closes in 560 ms while the camera returns to where it was. Only clip-path, transform and opacity move, no filters. Reduced motion: no flight, no iris, no drift; the scene is simply there, and Back closes it at once. Focus moves to Back when the window is wide, Tab stays on it, and focus returns to the settlement on close. The survey slate scrolls into view after you come back out, not during the dive.

Pictures: `frontend/src/assets/map/scenes/*.webp` (1280 x 714, each under 150 KB), fetched and decoded while you hover or focus a settlement. A picture that fails to load is skipped and the old behaviour (fly to the settlement) stays. Game mode only.

## Open
- Information Technology still shows the Exchange: no picture for it yet. Real estate and communications too.


## Layout follow-up (same day)
- "Back to the map" sits top right of the scene.
- On wide screens (xl) the survey slate is docked beside the map in a 23rem column, like the Fortress dock; the column is always there (a quiet "Press a tower" note when empty) so the map never jumps. Narrower screens keep it under the map.
- "Map" is the second tab, right after Fortress.
