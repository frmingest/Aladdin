# D1 Plain lens (2026-10-13)

Status: written on `feature/d1-plain-lens`, not merged, not deployed. From the design-team review ([game-mode-team-review](game-mode-team-review-2026-10-09.md), item D1: "Painted/Plain switch redrawing the same layout as labelled blocks with the numbers; also the print form and low-GPU fallback").

## What changed

- **A third Fortress view, "Plain",** between Scene and Ledger. It keeps the Scene's arrangement (the Great Keep in the middle of the first row, the biggest holdings beside it, the rest on the terraces below, from the same `layoutTowers`) and draws every holding as a labelled block: name, ticker, structure and size, weight and value, then Moat, Walls, Analysis, Land, Thesis and Siege as words with their numbers (age in days, margin of safety, tripwires fired, the what-if fall). No pictures, no motion, no canvas.
- **Same facts, same wording as the Ledger** (`plainFacts` reuses the Ledger's label tables), so the three views cannot disagree. "Needs a look" uses the Ledger's existing `needsAttention`; it is a reading aid, not a score.
- **Selecting works as in the Scene:** "Open the survey" on a block opens the same Tower survey below; the Great Keep block opens the verdict on the whole fortress. Selected is stated in words ("Selected: survey below") as well as by the border.
- **Print form:** "Print this view" calls the browser's print. In print the app's sidebar, top bars, tabs, the night-watch card, reports, study desk and the block buttons are hidden (`print:hidden`); blocks do not split across pages. The demo banner still prints.
- **Light fallback:** the view you last used is remembered per browser (guarded localStorage, key `aladdin-fortress-view`, like the theme). A browser that has never chosen and asks to save data (`Save-Data` or `prefers-reduced-data`) starts on Plain instead of the Scene. Nothing is stored on the server.

Not changed: the Scene, the Ledger, the survey, any backend code, any stored value, any word of the existing pages. No new migration.

## Files

`frontend/src/lib/plainFortress.ts`, `frontend/src/lib/fortressView.ts`, `frontend/src/components/fortress/PlainFortress.tsx` (+ tests for each), `frontend/src/pages/FortressPage.tsx`, `frontend/src/components/Layout.tsx` (print-hide classes only).

## How to check it (Faiz, after deploy)

1. Open the Fortress, press **Plain**. The blocks follow the Scene's order; the Great Keep block sits where the keep stands.
2. Compare two or three holdings against the Ledger: moat, walls, land, thesis and siege words must match.
3. Press a block's **Open the survey**: the survey appears below. Press **Print this view** (or Ctrl+P): the print preview shows only the blocks, the survey and the page cards.
4. Reload: the Plain view is still selected.

## Not verified

No screenshots were taken and nothing was looked at in a browser in this session; the checks run were `tsc`, lint, vitest and the build (see the PR). The print layout in particular has not been seen on paper or in a print preview.

## Not built

D2 Camera (zoom and pan for the painted scene), a Plain lens for the other game rooms (the Circle, Council and Siege already have their own Plain views), a print stylesheet for pages other than the Fortress.
