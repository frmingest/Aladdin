# S22 PR 2: Esc, B and place links (2026-11-03)

**Status: written, not looked at in a browser, not merged, not deployed.** Branch `feature/game3d-s22-links-and-keys`, on `main` `befe90d` (S22 PR 1 is #272). Plan: [S22 and S23 sprint plan](game3d-s22-s23-sprint-plan-2026-11-02.md).

## What it is for (plain words)

Doors already fade (PR 1). This step makes the rest of moving around feel the same everywhere: Esc always closes the panel on top, B walks you back out of a room, and a link can open any place, so a reload keeps you where you were and QA can open a place directly.

## What you will see

- **Esc** closes the panel drawn on top first (the old books before the desk, a page before the menu). The report reader, the Magic Lamp and the two Market Street dialogs still close themselves.
- **B** walks back out of the Town, the Town Hall, the Hall of Records or a tower's library, once nothing is open. Not during a move, never in the courtyard.
- **`/game3d?at=town`** (also `townhall`, `records`, `library:<holdingId>`) opens that place. The address follows you with `replaceState`, so the browser's Back leaves the page instead of re-walking your steps. A broken link opens the courtyard. A library link waits for the towers to load; if that tower is gone you stay in the courtyard.

## What changed

- `game3d/layers.ts`: the pure order of what closes first (and which layers close themselves).
- `game3d/placeLink.ts`: reads and writes `?at=`, keeping other query parameters.
- `pages/Game3DPage.tsx`: one Esc/B handler, the starting place from the link, the address kept in step.
- `e2e/game3d.spec.ts`: opens town, Town Hall and Hall of Records by link, checks the title and Back button, presses B, checks the address and that nothing logs a page error. Read-only (aborts every non-GET).

## Tests

`layers.test.ts` (4), `placeLink.test.ts` (3). Checked in `frontend/`: `tsc --noEmit`, `npm run lint` (2 old warnings), `npm test` (169 files, 1452 tests), `npm run build`. The browser test was not run here (needs `SMOKE_FRONTEND_URL`).

## Not done

Quiet preloading of the next place's models (nothing to preload until S25), and a single shared "← Back" button (the four old buttons are unchanged).

## To look at (Faiz)

In `/game3d`: open a desk or the Vault, press Esc once (only the top panel closes). Walk into the Town, press B. Open `/game3d?at=records`, then `/game3d?at=nowhere`.
