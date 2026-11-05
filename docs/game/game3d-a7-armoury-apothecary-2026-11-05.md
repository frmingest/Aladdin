# 3D asset plan A7: the armoury yard and the apothecary (2026-11-05)

**Status: written and tested on `feature/game3d-a7-armoury-apothecary`, off `main` at `7b954e7` (A6 merged as #297). `tsc`, lint (0 errors), the full test run (1760) and the build pass. Seen only in a headless lineup (a rough rebuild of the layout, not the real scene), not in the app, no fps, not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md).

## What a sprint is for

A sprint is one small, finished piece of the game, built, tested and handed to you as a PR. This one answers a simple gap: defence and health holdings still stood in the open as plain towers, even though we already owned the art to make them look like what they are.

## What you will see

- **Defence (theme `armoury`) is an armoury yard.** A barracks hut, a weapon rack (two swords, a spear, a halberd), an archery target and a shield on the ground, all inside a wooden fence ring of six pieces with a gate.
- **Health care (theme `apothecary`) is an apothecary.** A shop with a table of jars, a shelf with candles, a candle, and a line of dried herbs, with a ring of six barrels and boxes outside.
- **The Map changes too.** Defence and Health Care now show your two Stitch pictures on the flat Map (`map-armoury-yard`, `map-apothecary`), and the 3D theme follows the picture.

Both rings wear the wall ladder like the workshop and the fountain: upright on Sound, leaning and gapped on Worn, props on Patched, fallen pieces and a crack on Failing. Unsurveyed shows the pale ghost.

## Never-grows rule

Art never carries a fact. The same pieces stand for every holding of the theme; only the ladder changes the look, and only the wall tier drives it.

## Decisions

- Neutral (no data) is not drawn for these themes; only the ghost shows.
- Brown bottles from Restaurant Bits read red-orange in the colour audit, so all bottles were dropped.
- The armoury first hit 653 KB (over the 600 KB budget); the hex buildings were dropped and the town `barracks` and `market` are reused.
- Defence is classed as before (sector table); only its picture and theme changed.
- Judgment call to look at: the small boxes in the apothecary ring carry gold coins in the pack, which could read as wealth. Say so and they become barrels only (a new piece list, tests updated).

## Seen / Not checked

Seen: headless lineup only. Not checked: the real scene, fps (press P), your real holdings' themes (Kongsberg depends on its sector string), phone.

## What to look at

Walk out of the south gate in `/game3d`, find your defence and health holdings, and read the theme readout.
