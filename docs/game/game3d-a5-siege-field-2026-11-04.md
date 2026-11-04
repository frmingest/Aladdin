# 3D asset plan A5: the Siege Field (2026-11-04)

**Status: written and tested on `feature/game3d-a5-siege-field`, off `main` at `87a49d1` (A4 merged as #295). `tsc`, lint (0 errors), the full test run (191 files, 1704 tests) and the build pass. Never seen in a browser, no fps, not merged, not deployed.** Plan: [asset sprint plan](game3d-asset-sprint-plan-2026-11-04.md), earlier plan: [discovery plan](game3d-discovery-sprint-plan-2026-11-02.md) (S28).

## What you will see

- **A timber gate in the courtyard**, south of the drill post, with a teal pennant and a plate "Siege Field". Press E there: **"Press E to ride out to the Siege Field"**. (Two presses from anywhere near: walk up, E.)
- **A new place, the Siege Field**: open grass with a **wall line of up to twelve sections, one per tower**, worst hit first from west to east. Each section wears a plate with the tower's name and the share it loses, in the flat page's own figures at the drill's default fall (30%).
- **Breach is shape, not colour.** Under 10 percent damage: the wall stands whole. Under 30: lower, with one heap of rubble. Under 60: half height, two heaps. 60 and over: a low stump with three heaps and a gap you can walk through. A gaining tower stands whole.
- **Fog stays fog.** A tower with no usable beta is a pale ghost behind the line with a "?" and the panel's own count line. Never a height.
- **A fixed camp** in front of the wall: the five Kenney siege engines (catapult, trebuchet, ballista, ram, siege tower), eight KayKit Skeletons breathing in two ranks (idle clip only; one still frame under reduced motion), four boulders, two banners at the ends of the line and the command tent. Over the tent: the level, the headline sentence, "N more in Plain view" and "A what-if, not a forecast."
- A post at the south end: E rides you back, out beside the gate. `?at=siege` opens the field directly.

## What changed

- `siegeField.ts` (new, pure): the gate, the field, tiers, section and ghost maths, and the fixed camp lists. Takes only the siege yard's rows and fog, nothing else.
- `SiegeField.tsx`, `SiegeGate.tsx`, `siegeFieldWordsV1.ts` (new): the scene, the gate and the words (version 1 file).
- `areas.ts`, `near.ts`, `areaWordsV1.ts`, `Scene.tsx`, `Game3DPage.tsx`: `siege` becomes a real place (it was a reserved name), with its door, E answer, name plate and prompt. The courtyard's gate is mounted always; the field's watchers only inside it.
- `siegeYard.ts`, `useSiegeYard.ts`: an optional row cap (the panel keeps 8, the field uses 12 as decided in D8). Same call, same words, no backend change.
- `placeLink.test.ts`: `siege` is no longer a broken link.
- `siegeField.test.ts` (new, 22): every node and clip exists in the packed files, tiers and heights, one section per tower in order, drawn from the damage width alone, cap of twelve, gains stand whole, fog ghosts carry no number, the camp is fixed (counts, no holding or verdict import), everything stands on the field and off each other, the gate is clear of the drill post and everything else, the area is registered with its door, the spawn and return, E answers.
- **No new model file, no backend change, no migration.** The field reads `siege.glb`, `camp.glb` and the four Skeleton files, which were packed and unused.

## The art never carries a fact

Only the wall line carries a number, and only the backend's own damage width (`damageWidth`). Engines, skeletons, tent, rocks and banners are fixed lists; a test pins that the module imports no holding, theme, wall, moat or verdict. The field does not change with the weather or standing. No red or green: wall and rocks use the slate-blue and teal retint, ghosts are pale blue-white.

## Decisions (Claude's call)

- **The field draws the drill's default fall (30%), with no slider.** A slider would be a second control for the same thing; the drill post stays the place to set a fall. Say so if you want the winch and marker stones (S28 parts) next.
- **Not built yet from S28:** the fall winch, marker stones, yardstick banners, backtest. Siege tower and ram are drawn as plain still engines.
- **Skeletons stand and breathe, they do not walk or attack.** They never react to the numbers.
- **Gate placed at (-24.2, 24)**, far enough from the drill post that their reaches do not overlap (a test checks this).

## Game sprint checklist, section A

1. Pages touched: `/game3d` courtyard (gate) and the new field. 2. Identity: courtyard 3 to 3; field new, 3 (scene header = the wall line, shared kit, one fact encoded as shape, Plain view line). 3. Visual win: a wall line that reads as damage at a glance. 4. Visual verb + scene: *rehearse the siege.* Walking a wall line under a skeleton army. 5. Words: six short strings in a version-1 file. 6. Kit: `Part`, `StaticBatch`, `PAL`, the area machine. 7. Cut line: banners and rocks first. 8. Rules: above. 9. Taps: gate = walk up and 1 E; back = 1 E.

## Not checked

Everything on screen: how the squashed wall piece looks at partial height, whether skeletons and engines read at distance, plate legibility, whether the 12-section line crowds the field, draw calls and fps (press P, group "siege"), first-load number (the files load only when you ride out), phone width.
