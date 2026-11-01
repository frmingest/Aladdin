# 3D tower nameplates (2026-11-01)

Status: written and tested, seen in a headless browser with made-up holdings. Not merged, not deployed.

Faiz could barely read the tower names in the courtyard: a tiny dark pill floating above each tower.

## What changed
- Each tower's name now hangs on a **timber signboard above its door**, on the side facing the middle of the courtyard, so it reads from the spawn point. Dark ink on cream, with the tower's timber frame and two iron posts. Up to two lines; a name that does not fit is cut with an ellipsis.
- An unsurveyed tower says "not surveyed" (plus the named gap, e.g. "no tagged filing") in small italic type under the name. Unknown still reads as unknown; the sign adds no fact and no colour verdict.
- The floating HTML label is gone. The facts stay in the Towers panel.
- Sign is 5.6 x 2.0 world units, hung at about 4.3 above the pad so lamp posts and people do not cover it.

Files: `TowerMesh.tsx` (`NameSign`, painted on a canvas texture), new `signText.ts` (+ `signText.test.ts`, 6 tests). No backend, schema or art-file change.

## Verified
`tsc`, `npm run lint` (the same 2 old warnings), `npm test` (128 files, 1083 tests), `npm run build`: green. Looked at in headless Chromium with 8 made-up towers (including a long name, "Kongsberg Gruppen", and an unsurveyed one, "Jæren Sparebank"). **Not seen:** a real GPU, your real holdings, a phone.

## Look and judge (Faiz, after deploy)
Open `/game3d` and look across the courtyard from the spawn: can you read every name? Walk up to a far tower. If the boards are still too small or too big, they are `SIGN_W` and `SIGN_H` in `TowerMesh.tsx`.

## Game sprint checklist, section A
1. Pages touched: `/game3d` only. 2. Identity: 3 to 3 (names now readable in the scene). 3. Visual win: names on signs above the doors (verb "hang a sign"). 4. Words: none added; the name is the only text. 5. Kit: reuses `Part`/`PAL`/`INK`. 6. Rules: unknown stays fog (note on the sign), no new motion, no new files, one small canvas texture per tower (disposed on unmount).
