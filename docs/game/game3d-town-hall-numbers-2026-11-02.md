# 3D courtyard S18 (PR 3): numbers on the Town Hall boards (2026-11-02)

**Status: written on `feature/game3d-town-hall-numbers`, stacked on PR #255 (the hall interior). New tests, lint and a type-check of the touched files are green; the full test run and the build did not finish on this machine (they run in CI). NOT looked at in a browser, not merged, not deployed.**

## What a sprint is for (plain words)

The Town Hall boards told you *which* page they open but not *what is on it*. This piece puts one real number on four of the six boards, so you can read the state of things from the hall without opening a page. A number is only shown when it is the same number the flat page shows, printed by the same piece of code.

## What you will see

- **The Big Board** (Dashboard): "Portfolio value: " and the whole-portfolio amount in NOK.
- **Purse and Scoreboard** (Portfolio, Performance): "Total return: " as on the Performance page (a dash when there is no usable history).
- **Storm and Cushion** (Risk, Margin of safety): how many companies the Margin of safety board could rank, and how many it could not yet ("5 ranked, 2 not ranked yet").
- **Roll Call** (Holdings, Watchlist): how many holdings you own.
- **The Wide Weather** and **Reasons and Shiny Metal** stay words only for now.
- While a number is still being read, or the read failed, the board shows its words and nothing else. No placeholder digits.

## Why it is trustworthy

- New file `lib/headlines.ts` holds one small function per number. **The flat pages now call these same functions** (Dashboard hero card, Performance total return, the "Can't be ranked yet" count on Margin of safety), so a board and its page cannot drift apart.
- The boards read through the same data calls and cache keys as the flat pages (`overview`, `board`, `performance:365`), so walking in from a page costs no extra request.
- Tests: `lib/headlines.test.ts` (each function) and `game3d/boardHeadlines.test.ts` (each board's line, the unknown state, singular and plural, and no buy, sell, red or green words).

## Files

- `lib/headlines.ts` (+ test): `portfolioValueText`, `totalReturnText`, `rankedCounts`.
- `game3d/boardHeadlines.ts` (+ test): which line goes on which board.
- `game3d/useBoardHeadlines.ts`: the four reads.
- `game3d/TownHallRoom.tsx`: the board shows the line.
- Flat pages `DashboardPage`, `PerformancePage`, `MarginOfSafetyPage`: one-line swaps to the shared functions, same output as before.

## Decisions I took (you may overrule)

- **Four boards, not six.** Macro, Thesis monitor and Precious metals work out their headline inside the page; each needs its own small shared function first. I did not copy any number by hand.
- **Watchlist has no number.** Its flat headline uses "buy" wording, which the 3D rules keep out.
- No Stitch picture is needed.

## Not done / not checked

- **Not seen in a browser** (headless or real): whether the extra line fits the board face at the camera distance. Please walk in and tell me if the text is too big or too small.
- Full `vitest` run and `vite build` did not finish here (time limit); 34 of 58 3D test files and all new tests were seen passing, none failing. One test, `artAssets` ("keeps masters and big images out of public/"), fails on your local copy because of an untracked folder `frontend/public/art/New folder/` (a 784 KB `screen.png`); it is not in git, so CI is unaffected. Delete or move that folder when you like.
- Numbers for Macro, Thesis monitor, Precious metals; the Records Hall interior (rest of S18).
- Deploy not checked.
