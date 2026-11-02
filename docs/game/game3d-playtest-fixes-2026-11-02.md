# 3D courtyard: fixes from your first walk-through (2026-11-02)

**Status: written on `fix/game3d-playtest-fixes`, off `main` after #259. New tests and lint were green on a copy of this change made on your machine; CI runs the rest. NOT looked at in a browser by Claude, not merged, not deployed.**

## What a fix pass is for (plain words)

You walked the new places and found five things that felt wrong. This pass fixes each one at its cause, not just its look.

## What you will see

1. **The old figure no longer flashes while the game loads.** While the hero's real model loads, the world now shows nothing for the hero (a moment of empty ground) instead of the old shape figure with its walking animation. If the model ever fails to load, the old figure still shows, so you never lose your character.
2. **Ravens.** You were not doing anything wrong. The perch counted every raven you had not marked seen, but the Ravens card only lists the ones from the last 48 hours; older ones hide under "Earlier". So birds could sit there with "None in the last 48 hours" in the card, and nothing to mark. The perch now shows one bird per raven the card calls "new", so every bird you see is one you can mark seen, and it leaves when you do.
3. **The report would not close (the scroll stayed on screen).** Cause: the reader closes with a short timer, and the 3D world re-draws so often that the timer was cancelled before it finished, leaving the rolled-up scroll stuck. The close timer is now safe against re-draws (`lib/closer.ts`), and pressing Escape twice closes once. This fixes the reader in the flat app too, where the same fault could hide.
4. **A stock you add at Sal's now gets a stall (up to eight).** Cause: Market Street only had seven stands, and a company you just added (no price named yet) sorts to the end of the street, so it fell off the end and was only mentioned in a small line when you stood next to a stall. There are now eight stands. Beyond eight, the line under the "Press E" prompt still says how many stalls have no stand; more stands need a bigger street, which is a layout decision for you.
5. **Tower name signs.** The two posts that stuck out below the plank and ended in the air are gone. The sign now hangs like an inn sign: one iron arm comes out of the wall above the door, a beam crosses it, and the plank hangs from the beam on two short hangers. One arm in the middle, because the plank is wider than the tower, so only the middle can touch the wall. A test checks the arm reaches into the wall for every tower size.

## Files

- `game3d/Avatar.tsx`, `game3d/Player.tsx`: `loadingFallback` (the hero passes `null`).
- `pages/Game3DPage.tsx`: perch bird count from `splitRavens(...).recent`.
- `lib/closer.ts` (+ test), `components/DocumentReader.tsx`: the close timer.
- `game3d/streetPlan.ts`: one more plot, found by searching the cobbles with the street, booth and raven-perch clearance rules.
- `game3d/TowerMesh.tsx`, `game3d/signText.ts` (+ test): the sign bracket.
- No backend change, no migration, no new endpoint.

## Open list for you

- Please look at in `/game3d`: the sign over a tower door (is the arm too thick or too thin?), the eighth stall, and the first second of loading (an empty spot where the hero will appear, is that OK?).
- **Not checked:** I could not reproduce the add-a-stock flow against real data. If your new stock still has no stall after this, tell me its name: it may be a data problem (the stock saved but without the company row the street reads).
- Not seen in a browser; deploy not checked. There is no DOM test setup in this project, so the reader fix is covered by a test of the timer helper, not of the component.
