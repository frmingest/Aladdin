# 3D courtyard S18 (PR 1): the Town Hall door (2026-11-02)

**Status: written on `feature/game3d-town-hall`, off `main` at #252. tsc, lint, 1248 tests and build pass. Clicked through once in headless Chrome (door, prompt, menu); not merged, not deployed.**

## What a sprint is for (plain words)

The ten main-app pages (Dashboard, Holdings, Portfolio, Performance, Risk, Margin of safety, Macro, Thesis monitor, Precious metals, Watchlist) were only reachable from the signpost menu. This first piece of S18 gives them a building in the Town, so you can walk to them like the other pages. The rooms inside (a board per page group) are the next piece.

## What you will see

- A fifth building in the Town, west of the plaza (across from the Workshop), named **Town Hall**, with a doormat.
- Stand on the mat: **"Press E to go into the Town Hall"**. E opens the "Where to?" menu showing only the Town Hall's ten pages; pick one and it opens in the world panel with the "Open the flat page" link (same as the other doors).
- Nothing is copied: every page is the flat page itself.

## Files

- `game3d/townPlan.ts`: new `townhall` building (model `market` from `town-buildings.glb`, no new art, no new file), opens the `townhall` place.
- `game3d/townPlan.test.ts`: five buildings; the "every register row has a building" test now covers the Town Hall rows, so a new main-app page cannot be forgotten.
- Screenshots: [door](img/game3d-town-hall-door-2026-11-02.png), [menu](img/game3d-town-hall-menu-2026-11-02.png).

## Decisions I took (you may overrule)

- **Model: the Builder `market` piece**, because it is centred on its own origin (the `barracks` is off-centre and would need a collider shift). It reads as a market hall with awnings, not as a grand hall. A look decides; swapping to `barracks` is a small change.
- **Rooms are the next PR**, as one interior hall with a code-built board per page group, not five separate rooms. Boards will show a headline number only where the flat page's own function gives it; anything else stays "open to read" (no invented numbers).
- No Stitch picture is needed.

## Not done / not checked

- Rooms, boards and the Records Hall interior (rest of S18).
- Only walked headless: how the building looks from the plaza side, and tap counts on a phone, are not checked.
- Deploy not checked.
