# 3D asset plan A8: the Siege Field tools (2026-11-05)

**Status: written and tested on `feature/game3d-a8-siege-field-extras`, off `main` at `762d063` (A7 merged as #298). `tsc`, lint (0 errors), the full test run (195 files, 1787 tests) and the build pass. Never seen in a browser, no fps, not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md). This is the "winch and marker stones" follow-up A5 left open ([A5](game3d-a5-siege-field-2026-11-04.md), S28 in the [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md)). Faiz picked it as the next sprint on 2026-11-05.

## What a sprint is for

A sprint is one small, finished piece of the game, built, tested and handed to you as a PR. Until now the Siege Field always drew one fixed what-if (the market falls 30%, measured against Oslo). This sprint lets you play with it: change the fall and the yardstick right there on the field and watch the wall line change.

## What you will see

- **A fall winch** in front of the skeleton ranks. A weight on a rope sits higher the bigger the fall; a plate says "Fall 30%". Press E to crank it up one step (5%); after the top it rolls back to the bottom.
- **Two marker stones**, "Storm line 15%" and "Siege line 34%" (the numbers are the flat Siege page's own presets). E at a stone sets the fall to that line. A small teal pennant tops the stone the fall is at. A line the range never reaches says "out of reach" and E does nothing.
- **Two yardstick banners** at the ends of the wall line: "Oslo" on the west end, "World" on the east. The one in use flies full height and says "In use"; the other hangs low. E at a banner swaps the yardstick. The choice is saved in the same place the flat Siege Simulator uses, so both pages agree.
- The **wall line, plates and command tent redraw** for the new fall and yardstick (same call as the flat page). The camp (engines, skeletons, rocks) stays a fixed size.

## What changed

- `siegeFieldTools.ts` (new, pure): the five tool spots, which one you stand at, what E does at each (`applySpot`), the plates and prompts. Takes no holding, theme, wall or verdict.
- `siegeFieldToolsWordsV1.ts` (new): the short game-voice words, version 1.
- `siegeYard.ts`: the view now carries the stones' preset falls (the flat page's `presetDrop`) and the backend's range; new `setYardBenchmark`.
- `useSiegeYard.ts`: an optional yardstick argument.
- `SiegeField.tsx`: winch, marker stones, banners that follow the choice, a watcher for the tool in reach.
- `near.ts`, `Scene.tsx`, `Game3DPage.tsx`: a `fieldSpot` stand, one more E answer, its prompt, and the page owns the fall and yardstick so E can change them.
- `siegeFieldTools.test.ts` (new, 27): winch steps and wrap, stones use the backend's own presets, unreached lines do nothing, banner swap, the five spots do not overlap and stand clear of the road back, engines, skeletons, tent and rocks, a tool beats the road back, no holding or verdict imports.
- **No new model file, no backend change, no migration.** The stones reuse a rock from `siege.glb`; the winch is code-built.

## The art never carries a fact

The winch, stones and banners only steer the same what-if; none shows a result. The numbers on them are the backend's preset falls, and the wall line still carries the only per-holding fact. The active choice reads from shape (a raised weight, a full-height banner, a pennant), not colour. No red or green.

## Decisions (Claude's call)

- **The winch is an E crank, not a slider.** A slider would be a DOM control over a 3D scene; E at the winch steps the fall by 5% and rolls round, and the stones are the quick way to the two lines. Say so if you want a real slider on the field.
- **The fall and yardstick reset to 30% and your saved yardstick when you reload.** They are not saved between visits; the yardstick is, through the flat page's key.
- **The old battlefield (backtest) and the war table are still not built** (S29).

## Not checked

Everything on screen: whether the winch reads as a winch, whether plates are legible, whether the banners are easy to find at the ends of a long wall line, fps (press P, group "siege"), phone width. The wall redraw after a change depends on the backend answering again (about a quarter of a second plus the call); a failed read shows the field's own "failed" line over the tent.

## Game sprint checklist, section A

1. Pages touched: the Siege Field only. 2. Identity: field 3 to 3. 3. Visual win: turn a winch and watch the wall break. 4. Visual verb + scene: *turn the fall.* 5. Words: seven short strings in a version-1 file. 6. Kit: `Part`, `PAL`, the area machine, `standingAt`. 7. Cut line: banners first. 8. Rules: above. 9. Taps: each tool is walk up plus 1 E.
