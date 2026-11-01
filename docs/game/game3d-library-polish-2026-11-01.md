# 3D library polish (2026-11-01)

Status: written and tested, seen in a headless browser with made-up data. Not merged, not deployed.

Four fixes after Faiz walked the first tower library (#234).

1. **Sideways walk that would not stop.** Not reproduced. Likely cause: a key release lost (mouse-look lock changes, a held Ctrl/Cmd/Alt, focus leaving the page) or ignored while a field had focus, so the "held" key stayed on. Now `applyKey` always honours a release, and all keys reset on blur, context menu, pointer-lock change and tab hide. Three new tests.
2. **Books.** Rounded covers, a cream page edge, two gold spine bands, uneven widths and heights, packed from the left, the last book of a part-full board leans. Cover colours are fixed by slot (no red or green, so colour never reads as a verdict); the number of books is still the only fact. Shelf bays now have solid colliders so the hero cannot stand inside them. Arrival spot moved to the left of the hall.
3. **One shelf per page.** E at a shelf shows only that shelf (title, question, lines, Not surveyed / Doesn't apply chip). The other five are not listed.
4. **Centre table opens the latest report.** Stand on the south side of the table, press E: the newest annual or quarterly report (by Newsweb date, else upload date; annual wins a tie) opens in the normal `DocumentReader`, so an annual `.xhtml` gets the side-by-side filing with searchable stored figures. No report: "No report on the table yet." Fetch fails: "Couldn't fetch the report. Try again." View-only; nothing stored. E is ignored while the reader is open.

Files: `useKeys.ts`, `Library.tsx`, `libraryRoom.ts`, `libraryReport.ts`, `ShelfPanel.tsx`, `Scene.tsx`, `pages/Game3DPage.tsx`. No backend or schema change.

Verified: tsc, eslint, vitest (1077), build, headless Chromium look (books, single shelf, table prompt, reader opens).
