# 3D: the Oracle points at the drill post, and the Quest log pill stops wrapping (2026-11-10)

Two small leftovers from the "3D ideas not built" list in [PROGRESS](../PROGRESS.md). Written and tested; not deployed, not seen in a browser.

## 1. The Oracle (and the Partner) point at the Storm Drill post
- Once every holding has both lines and no look-back is due, but no drill is written yet, both people now say where the drill post is (west side of the courtyard) and what to do there. Nothing is traded or sent, and no buy or sell wording.
- Any other state says nothing extra: a written drill, or a drill that is loading, unreadable or a sample, leaves v4 as it was. The earlier quests still speak first.
- New file `game3d/dialogueV5.ts` wraps v4's `talk` (v4 stays as shown). `DialoguePanel` takes an optional `drill` prop; `Game3DPage` passes its Storm Drill quest. Left out, nothing changes.
- Tests: `dialogueV5.test.ts` (when it speaks, when it stays quiet, order of quests, no trade words). The v1, Standing and text pass 3 dialogue tests still pass.

## 2. The Quest log pill
The status pill (for example "Done! Every holding has both lines.") was a full pill shape, so on a phone it wrapped into a fat oval. It now has a small corner radius, a tighter line height and `max-width: 100%`, so a long sentence wraps into a neat rounded box. One CSS rule (`.g3d-pill` in `index.css`).

## Checks
eslint clean on the changed files; vitest for the four dialogue and quest-log test files (53 tests) green. A local `tsc` still stops on the known case-clash files (see PROGRESS); none of the errors are in the changed files. Linux CI is the full check.

**Faiz, after deploy:** finish the Whys, then talk to the Oracle: with no drill written he should point at the drill post. Open the Quest log on a phone width and look at the green status pill.
