# 3D: a fingerpost to the Siege Field gate (2026-11-19)

Issue #462, follow-up of #460. **Status: written on `feature/game3d-siege-gate-signpost`, off `main` at `85b4ce0`. `tsc`, lint (0 errors), the full frontend test run (240 files, 2238 tests) and the build were run in a cloud workspace. Not seen on a real GPU, no fps, not deployed.** Earlier: [the gate moves outside](game3d-siege-gate-outside-2026-11-19.md).

## What was wrong

#460 put the Siege Field gate on the west lawn, about 28 units off the gate road. Nothing pointed to it, so a player leaving the fortress had no reason to look west.

## What you will see

- **A timber fingerpost on the west edge of the gate road**, level with the gate (x -4.4, z 72), between the Town Hall's row and the Cartographer's. A plank (3.2 wide, hung under the arm on the west side of the post, so the post never covers the words) facing the player walking out of the fortress reads "Siege Field" with one small line, "Out on the west lawn". An arm above it ends in a teal point and turns toward the gate.
- The direction is told by the arm's shape, not an arrow glyph: the plank's back face would flip a glyph the wrong way.
- It is furniture: no prompt, no fact, nothing moves. One thin collider on the post.
- **The gate has its own group in the press-P overlay**, `siegegate`, instead of being counted under `drill`. The fingerpost counts there too.

**Visual verb + scene:** *follow the arm.* Walking south out of the fortress, a post at the road's edge points west across the lawn. Fact to shape: none (furniture, carries no data). Words: two short lines added, none deleted.

## What changed

- `siegeFieldWordsV2.ts` (new): every v1 line unchanged plus `fingerpostLabel` and `fingerpostWhere`. `siegeFieldWordsV1.ts` is untouched; its four importers now read v2. A test pins that v2 carries every v1 line.
- `siegeFieldLogic.ts`: `SIEGE_FINGERPOST`, its facing and its arm yaw (`yawToward` the gate).
- `SiegeFingerpost.tsx` (new), mounted in `Scene.tsx` with `SiegeGate` in a `siegegate` perf group.
- `siegeFieldLogic.test.ts`: the post stands off the road and outside the wall, its arm points west, it is clear of every Town building, door reach, person, tree, boulder, the river, the fields and the tracks.
- No backend change, no migration, no new model file, no new art.

## Game sprint checklist (short)

1. Pages touched: the courtyard area of `/game3d` (the gate road).
2. Identity: courtyard 2 to 2 (furniture, no fact).
3. Visual win: the gate is now announced from the road.
4. Words: two new short lines in a v2 file; v1 kept.
5. Kit: existing `Part`, `StaticBatch`, `WorldSign`; no new piece.
6. Cut line: no prompt, no quest line, no menu entry (see open items).
7. Fortress rules: no number, no fact, no buy or sell wording.
8. Taps: no change at the gate itself (one E). The post removes the search for it.
9. Draw calls: three more batched pieces (post, arm, tip, each with its ink outline) and one plank drawn on both faces. **Not measured**; press P on a real GPU is Faiz's.

## Open items

- **Screen readers (follow-up issue #464).** The fingerpost is painted in the world, so it tells a screen-reader user nothing. The gate's own E prompt is real text; the post is not. A spoken hint (a polite line when you pass the post) would need a new "near" spot kind and a place in the HUD, and was left out of this change.
- **Line of sight** from the post to the gate (the Town's rows may hide it) was not checked.
- **Second plank line** ("Out on the west lawn" says where; the game-designer suggests the player's act instead) is Faiz's call; v2 can still change before merge.
- **A "Where to?" menu entry** for the Siege Field may serve keyboard and screen-reader players better than a spoken hint; to weigh in #464.
- **A quest line or Guide step** that sends a new player west was not added.

## Seen so far

A headless run (software WebGL, demo data, `playtest-qa`, screenshots kept out of the repo) showed the plank with the post standing in front of its middle ("Sieg Field"); the plank was then moved off the post. **The moved plank has not been looked at again.** The arm pointed west at the gate; the gate prompt is real DOM text reached by Tab in two presses, and E opened the field; no console errors. The Quests panel, open by default, hides the left of the screen where the post stands (not changed here).

## Not checked

Everything on screen: how the post reads from the fortress gate, whether the arm clears the Town Hall's roofline from the road, phone width.
