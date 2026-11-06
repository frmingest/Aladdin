# 3D S29: the old battlefield and the war table (2026-11-06)

**Status: written and tested on `feature/game3d-s29-battlefield`, off `main` at `590896a` (A8 merged as #299). `tsc`, lint (0 errors), the full frontend test run (196 files, 1806 tests) and the build pass. Never seen in a browser, no fps, not merged, not deployed.** Plan: [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) (S29), [asset plan](game3d-asset-sprint-plan-2026-11-04.md). Also in this PR: the river outside is bluer.

## What you will see

- **The old battlefield**, a strip of scorched earth on the west flank of the Siege Field (`/game3d?at=siege`). One row per holding, in the flat Siege page's own order, up to twelve (the rest are counted: "N more in Plain view"). Each row has two bars growing east from the same line: a **dark scorch bar** for what really happened in the one stored fall, and a **pale chalk bar** for what the page's method said. A miss is as plain as a hit: the bars differ, and the plate prints both numbers and the flat page's word ("Close", "Fell harder", "Fell softer").
- **A board at the head of the strip** with the flat page's own sentence about the fall (peak, trough, trading days), a one-line legend, "N of M tested" and "One old fall. Not a forecast."
- **Fog stays fog.** A holding the method could not be tested on has a pale ghost post and a "?", no bar and no number. A gain draws no bar, as on the flat page.
- **The war table** on the east flank: a plain slab with up to three parchment notes, and a board with your newest three Storm Drill notes (the fall and date, then your own words cut to one line). Read-only. The sample fortress pins none.
- **Nothing to press.** The strip and the table have no E spot, so taps are unchanged (gate 1 E, back 1 E).
- **The river is bluer** (water `#6f93ad` to `#3f86c4`, flow `#9dbccd` to `#8fc3ea`). Still scenery, still the same for every portfolio, still no red or green.

**Visual verb + scene:** *read the old war.* Walking a scorched strip with a chalk line beside every burn.

## What changed

- `battlefield.ts` (new, pure): the strip, `battlefieldFor` (rows, bar lengths on the flat page's `barScale`), `boardLines`, `notesFor`, `tableLines`, the colours. Imports only the flat back-test helpers, its words file and types.
- `battlefieldWordsV1.ts` (new): the words, a version-1 file.
- `useBattlefield.ts` (new): one read of `getSiegeBacktest` and `getStormDrills` when the field opens. Plain GETs, no model quota, nothing written. Each fails alone.
- `Battlefield.tsx` (new), mounted in `SiegeField.tsx`: flat boxes (no colliders), the ground, the table and the plates.
- `countryside.ts`: two colour constants.
- `battlefield.test.ts` (new, 19): bar length from the stored number alone, misses drawn as plainly as hits, gains and nulls draw nothing, fog rows carry no number, twelve-row cap and count, empty states, determinism, two holdings differing only in name look the same, the board's sentence, the newest-three order, the demo pins nothing, note shortening, the module imports no holding/theme/wall/moat/verdict, colours have no red or green, clearance from the wall line, ghosts, banners, engines, skeletons, rocks, tent, exit, spawn, winch and stones, no buy/sell wording.
- **No new model file, no backend change, no migration.**

## The art never carries a fact

A bar's length is the backend's own `actual` or `predicted` for that holding on one shared scale; nothing else sets it. Ground, board and table are fixed. No theme, wall, moat or verdict colours anything. Notes are the player's own words shown back to the player; nothing here sends them anywhere (architecture rule 4 untouched).

## Decisions (Claude's call)

- **One fall only**, the stored worst fall the flat card already uses. A pick-a-fall control would be a second control for the same thing.
- **Notes shown as a board, not hand-lettered scrolls**: the parchments on the table are fixed decoration; the board carries the words.
- **Not built:** the book-level lines (replayed book, longest stretch under water) stay on the flat page. Say if you want them on the board.

## Game sprint checklist, section A

1. Pages touched: `/game3d` Siege Field only. 2. Identity: field 3 to 3. 3. Visual win: two bars side by side say "the page was right or wrong" without a word. 4. Verb + scene: above. 5. Words: a version-1 file, all short. 6. Kit: `Html` plates as the field's other plates; colours in one constant (no new shared kit piece). 7. Cut line: the table's parchments, then the legend line. 8. Rules: above. 9. Taps: no new taps.

## Not checked

Everything on screen: whether twelve one-line plates 2.4 units apart overlap at your camera distance, whether the board and table read from where you stand, the new river blue next to the meadow, draw calls and fps (press P, group "siege"), phone width, and your real back-test numbers. Tell Claude if a spot is bad.
