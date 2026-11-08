# 3D Weather Tower: first build (2026-11-08)

**Status: written and tested in a cloud session on `feature/game3d-weather-tower`. NOT seen in a browser, NOT deployed.** Backend: ruff and the full pytest suite pass (2,031 passed). Frontend: `tsc --noEmit`, `npm run lint` (0 errors, 3 old warnings), `npm test` (206 files, 1,887 tests) and `npm run build` pass. Design: [game3d-macro-room-design-note-2026-11-08.md](game3d-macro-room-design-note-2026-11-08.md), approved the same day.

## What a sprint is for (plain words)

Give the interest-rate and macro numbers a place of their own in the 3D town, one you can walk round and read, and make sure it can grow when a new series is added.

## What you will see

- **A new building in the Town**, north of the Town Hall: "Weather Tower". Press E at its door to go in. B or the Back button walks you out to the same spot.
- **Inside:** Norway's dials on the west wall, the United States on the east wall, the computed gaps (real rates, Norway minus US, Norway curve) on the north wall. One dial for each series the app stores (18 fetched, 4 computed). Walk up to a dial and a small card shows its name, value, `stale` if old, and the 3- and 12-month change, in the same words and format as the Macro page.
- **Needle:** where today's value sits between that series' own 24-month low and high (low on the left, high on the right). It is a place on a scale, never good or bad. **Paper trace** under each dial: the last 24 months.
- **A grey dial with no needle** means no reading yet. **A hood over the top half** means the series is stale (the word "stale" is on its card too).
- **The curve rail in the middle:** one post for each point on Norway's own curve (3 months to 10 years). Post height is the yield on a fixed scale, so two visits compare. A missing maturity leaves a gap, never a guess.
- **E at the dials** opens the flat Macro page in the world panel (the Plain view). The Town Hall's "Wide Weather" board is unchanged.

## What changed

- **Backend, catalogue v3** (`app/domain/macro_series.py`): v2's series plus Norway's 6-month and 12-month T-bills and 3-, 5-, 7-year bonds from the same Norges Bank dataset (`GOVT_GENERIC_RATES`). v1 and v2 are untouched (Rule 3). `active_macro_series_version` now defaults to `v3`. No schema change, no migration. Four tests updated because they assumed the old default; one new test pins v3.
- **Frontend:** new area `weather` (parent Town), door in the Town (`townPlan.ts`, `areas.ts`, `near.ts`, `areaWordsV1.ts`), pure layout and maths in `weatherTowerRoom.ts` (tested), words in `weatherTowerWordsV1.ts`, the room in `WeatherTowerRoom.tsx`, wired into `Scene.tsx` and `Game3DPage.tsx` the same way the Hall of Records is. `/game3d?at=weather` opens it directly.
- Layout comes from the catalogue, not a hand-made list: a new series becomes a new dial. Each wall holds 24; extras are counted ("N more in the page"), never stacked.

## What this affects beyond the room (read this)

- **Analysis input changes.** Evidence packets cite every catalogue series, so a new analysis run now carries five more Norway curve items (macro evidence goes from 13 to 18 series plus 4 computed). The existing packet token budget (macro indicators capped at 2,500 tokens) still applies, and a run that has to trim says so in its evidence notes. Old runs are untouched. Regime logic reads series by name and is unchanged.
- **Macro page and Dashboard** show the five new rows too (they read the same call).

## Faiz: after deploy

1. If `ACTIVE_MACRO_SERIES_VERSION` is set in Railway, change it to `v3` (unset uses the new default).
2. Press **Refresh data** on the Macro page once. **The five new series ids follow the 3M and 10Y pattern (`B.6M.TBIL`, `B.12M.TBIL`, `B.3Y.GBON`, `B.5Y.GBON`, `B.7Y.GBON`) and have not been fetched live**: this sandbox cannot reach Norges Bank. If one fails, its dial stays grey and the System status page lists it; nothing else is affected.
3. Look over `/game3d?at=weather` (and the new building in the Town). Press P to check draw calls: each dial is a few small meshes with an ink outline, about 22 dials, not instanced yet.

## Game checklist

- **Pages touched:** one new place (Weather Tower), Town (one building added), Game3DPage (wiring).
- **Identity before -> after:** Weather Tower new, 3 on paper (scene, one kit of dials, a fact in each needle and trace and in the post heights, Plain view = flat `/macro`); to be re-scored from screenshots. Town unchanged (2 or 3).
- **Visual win:** the dial wall and the curve rail. Visual verb + scene: **read**, a ring of brass instruments in a tower. Real facts encoded: each series' place in its own 24-month range, its history, and the shape of Norway's curve.
- **Look-and-judge screenshots:** not taken (no browser in this session). Open question for the look: the Weather Tower reuses the watchtower model that the Cartographer uses, so the two outside look alike.
- **Interaction cost:** two taps from the Town (E at the door, then walk to a dial; E at the dials opens the page). Not measured in a real browser.
- **Words:** short and game-voiced, in a versioned file; no buy, sell, good or bad words (test).

## Not in this build

Needle meaning card in the panel, instancing the dials, a US curve beyond the 10y-2y spread, Printer levers moving the dials, rate sensitivity per holding (the next growth slot), NIBOR, a Norway credit spread and M2 (no free source or not stored).
