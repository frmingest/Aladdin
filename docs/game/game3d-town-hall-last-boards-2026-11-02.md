# 3D courtyard S18 (PR 4): numbers on the last two Town Hall boards (2026-11-02)

**Status: written on `feature/game3d-town-hall-last-boards`, branched from `main` after #256 (the first four board numbers) merged. In this session `tsc --noEmit`, `npm run lint` (0 errors, 2 old warnings in files not touched), `npm test` (154 files, 1273 tests) and `npm run build` all passed. NOT looked at in a browser, not merged, not deployed.**

## What a sprint is for (plain words)

Four of the six boards in the Town Hall already showed one real number. This piece gives the last two boards theirs, so every board in the hall now tells you something without opening a page. As before, a number appears only when it is the same number the flat page prints, from the same piece of code.

## What you will see

- **The Wide Weather** (Macro): "Norway policy rate: " and the rate as the Macro page prints it. If the series is old the word "(stale)" is kept. No value, no line.
- **Reasons and Shiny Metal** (Thesis monitor, Precious metals): two short lines. "Reasons: 1 tripwire fired, 4 intact" (most urgent first, empty groups left out, "Nothing watched yet" with no rows) and "Metals: " with the precious-metals total in NOK. Either line is left out until its number is known.
- A board whose reads failed or are still loading shows its words only. No placeholder digits.
- The board text now allows a line break, so the two-line Reasons board stacks cleanly.

## Why it is trustworthy

- `lib/headlines.ts` gained `MACRO_HEADLINE_KEYS`, `macroHeadlineIndicators`, `policyRateText`, `THESIS_STATUS_ORDER`, `thesisStatusCounts`, `THESIS_STATUS_WORDS`, `thesisSummaryText` and `metalsValueText`.
- **The flat pages call the same functions:** the Dashboard Macro strip (`MacroHeadlineStrip`) uses `macroHeadlineIndicators`, the Thesis monitor status bar uses `thesisStatusCounts` and `THESIS_STATUS_ORDER`, and the Precious metals "Total value" tile uses `metalsValueText`. Output on those pages is unchanged.
- The backend's own thesis labels start with a red or green dot, which the 3D rules keep out, so the board says the status in plain words (`THESIS_STATUS_WORDS`); the counts still come from the page's own function. A test checks the board text has no picture characters.
- The boards read through the same calls and cache keys as the flat pages (`macro-indicators`, `thesis-monitor`, `precious-metals-overview`), so walking in from a page costs no extra request.
- Tests: `lib/headlines.test.ts` (each new function), `game3d/boardHeadlines.test.ts` (each new board line, the unknown state, every board gets a number once its data is in, and no buy, sell, red or green words).

## Files

- `lib/headlines.ts` (+ test): the eight new exports above.
- `game3d/boardHeadlines.ts` (+ test): `weather` and `reasons` cases.
- `game3d/useBoardHeadlines.ts`: three more reads.
- `game3d/TownHallRoom.tsx`: `whitespace-pre-line` on the number line.
- Flat pages `MacroIndicatorsPanel`, `ThesisMonitorPage`, `PreciousMetalsPage`: one-line swaps to the shared functions.

## Decisions I took (you may overrule)

- **One number per page, Macro shows only the policy rate.** The Dashboard strip lists six; the board shows the first, the one the Town Hall line can carry.
- **Sectors and Watchlist add no number.** Sectors has no shared headline function yet; the Watchlist headline uses "buy" wording that the 3D rules keep out.
- No Stitch picture is needed.

## Not done / not checked

- **Not seen in a browser** (headless or real): whether the Reasons board with two lines fits the board face at the camera distance. Please walk in and tell me if it is too tall or too small.
- Deploy not checked.
- Still open in S18: the Records Hall interior (time capsules on shelves, same-size books).
