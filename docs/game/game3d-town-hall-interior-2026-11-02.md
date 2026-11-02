# 3D courtyard S18 (PR 2): inside the Town Hall (2026-11-02)

**Status: written on `feature/game3d-town-hall-interior`, stacked on the Town Hall door PR (`feature/game3d-town-hall`, not merged). tsc, lint, 1257 tests and build pass. Not looked at in a browser, not deployed.**

## What a sprint is for (plain words)

The Town Hall had a door but behind it was only a menu. This piece lets you walk **inside**: a big hall with six notice boards on the walls, one for each group of main-app pages. Walk up to a board, press E, and the page opens in the side panel (or, for a pair of pages, a short menu of just those two).

## What you will see

- E at the Town Hall door now takes you **inside** (a plain wooden hall, same style as a tower library).
- Six boards: **The Big Board** (Dashboard), **Purse and Scoreboard** (Portfolio, Performance), **Storm and Cushion** (Risk, Margin of safety), **The Wide Weather** (Macro, and Sectors through it), **Reasons and Shiny Metal** (Thesis monitor, Precious metals), **Roll Call** (Holdings, Watchlist).
- A board with one page opens it straight away. A board with two opens a small menu with just those two.
- The door in the south wall (E) and the "← Back to the Town" button take you back out to the Town Hall's mat.
- The signpost menu (G) still lists every page, so nothing got harder to reach.

## Files

- `game3d/townHallRoom.ts` (+ test): the hall as data: size, six boards, reading spots, door, spawn, exit.
- `game3d/TownHallRoom.tsx`: the room, code-built, no new art or file.
- `game3d/WhereToPanel.tsx` (+ test): new `onlyRoutes` filter.
- `game3d/Scene.tsx`, `pages/Game3DPage.tsx`: the third zone (hall), teleport in and out, E, prompts, back button.

## Decisions I took (you may overrule)

- **Six boards, not five rooms.** One hall with a board per group is far lighter than separate rooms, and the Dashboard (which the plan did not place) gets the middle board.
- **Boards show words only, no numbers yet.** The rule is "numbers come from the same function as the flat page, tested". The main-app pages get their headline numbers from their own API calls, so showing one honestly needs a small shared helper per page. That is the next piece; I did not invent or copy any number.
- A test makes sure every Town Hall page in the register belongs to exactly one board, so a future page cannot be forgotten.
- No Stitch picture is needed.

## Not done / not checked

- **Not seen in a browser** (headless or real): how the hall looks, the board text size, tap counts on a phone. Please walk in and tell me what is off.
- Headline numbers on the boards, and the Records Hall interior (rest of S18).
- Deploy not checked.
