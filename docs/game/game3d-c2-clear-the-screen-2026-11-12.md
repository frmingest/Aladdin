# 3D courtyard C2: Clear the screen (2026-11-12)

**Status: written on `feature/game3d-c2-clear-the-screen`, issue #400. `tsc --noEmit`, `npm run lint` (0 errors), `npm test` (226 files, 2024 tests) and `npm run build` passed in this session. NOT looked at in a browser by me, not merged, not deployed.**

## What a sprint is for (plain words)

When you walk in, the screen should be the world, not a dashboard around it. This piece takes three things off the screen that were only getting in the way.

## What you will see

- **The key hint** at the bottom ("Click to look around, W A S D walk...") shows on your first three visits only, then stays away. It no longer repeats Q, T and G, because the toolbar buttons already show them. It also steps aside whenever a panel or dialog is open.
- **One Back button.** The Town Hall, the Hall of Records, the Weather Tower and a holding's tower each had their own copy of "← Back outside". There is now one button, in the same place, that does the right thing for the room you are in.
- **The sidebar folds away** on `/game3d`. A small "☰ Menu" button in the top strip brings it back ("Hide menu" puts it away again). Other pages are unchanged. Phones keep their existing hamburger.

## Decisions I took (you may overrule)

- **Three visits** is my number for "first visits". It is one constant (`HINT_VISITS` in `game3d/hintLine.ts`).
- The visit count lives in this browser only. With storage blocked, the hint just shows, as before.
- "One Back button" means the four copies in the courtyard page. The Where-to panel's own Back is a different thing and was left alone.

## Files

- `game3d/hintLine.ts` (+ test): visit counter and the hint text.
- `pages/Game3DPage.tsx`: one `backOutside` button, `showHint`, `anyPanelOpen`.
- `components/Layout.tsx`: sidebar folds on `/game3d`, Menu button.

## Not done / not checked

- Not seen in a browser: please check the folded sidebar and the Menu button at desktop width, and that the hint is gone on the fourth visit (clear `aladdin.game3d.visits.v1` in local storage to see it again).
- No Stitch picture is needed.
