# Stitch design pass (2026-10-10)

Status: pass 1 (component language) merged as #97, deploy not verified. Pass 2 (room looks) in progress on `feature/stitch-room-looks`: **written, PR open, not merged, not deployed**.

## What was reviewed
Faiz's seven Stitch exports in `frontend/public/art/new/` (untracked, not committed): Fortress, Council, Circle, Chronicle, Records, Marketplace, Map. Each has `screen.png` and `code.html`; six have a `DESIGN.md` (Council, Chronicle, Records, Marketplace carry the same 13.7 KB file; Map has its own). One painted citadel image sits in the Fortress folder.

## Verdict
Good enough to adopt the **component language**, not the **content**. The palette in DESIGN.md is the palette the app's study skin already uses, so no token changed. Not adopted, because they break the hand-off pack's Part 3 checklist: invented figures and quotes, new taglines and labels ("Value Canon", "Sovereign Regent", "Rebalance Keep"), emoji-style icons, a baked-in single-castle backdrop, 8-10 px text, EB Garamond + Inter as extra fonts (the app keeps Marcellus + Inter), the rooms listed in both sidebar and tab strip.

## Adopted (CSS only, `frontend/src/stitch-skin.css`, scoped to game mode)
- Gilded primary button (dark ink, soft bloom on hover, 1 px press), iron-bound secondary, outline danger.
- Recessed inputs with a gold focus glow; italic faint placeholders.
- Riveted level-2 panels with a lantern highlight on the top edge; gilded top rule on stat tiles.
- Lozenge hairline under every page title; rule running out from section titles.
- Room tab strip and page tabs in the display face with a gold underline glow and lozenges between rooms.
- Sidebar rooms lit by an amber pool; level-3 dialogs with a gold edge; candle vignette on the canvas (dark only); ledger heads and row hover; iron scrollbars.
Class hooks added to `Button`, `Card`/`PageHeader`/`StatTile`/`Modal`/`TabBar` (`ui.tsx`), the sidebar link (`Layout.tsx`) and `FortressTabs.tsx`. No text, data or layout changed. Game mode off = unchanged.

## Not done yet (per-room follow-ups, each needs a spec with the real fact it encodes)
- Records: tome cards with a top edge by seal state (reviewed / owed), as in the Records screen.
- Chronicle: timeline spine with gap blocks drawn as gaps.
- Marketplace: booth header plates; Circle: the corner-framed chart plate; Map: legend strip.
- Fonts: EB Garamond was not adopted; say if you want it instead of Marcellus.

## Pass 2: room looks
- **Chronicle (done in pass 2):** "Every change, newest first" is now a time-strata spine (`kit/TimeStrata.tsx`, `strata.css`, helpers `strata()` / `timeStrip()` in `lib/chronicle.ts`, unit-tested). Changes are lozenge nodes grouped by day; days the worker stored nothing are hatched dashed gap blocks with a slashed ring, placed between the changes either side. A strip under the frame slider shows where stored frames, rebuilt frames and gaps fall in time (decorative; the spine carries the same facts). The gap text moved from the "cannot show" card into the spine, and the spine opens by itself when any gap exists. No new words, no invented dates.
- **Records (skipped on purpose):** the stone hall of tomes with wax seals (PR #93) already carries more identity than the Stitch card grid, and seal state is already shape plus word. Revisit only if you want the Stitch layout over it.
- **Still to do:** Marketplace booth header plates, Circle chart plate, Map legend strip (each needs a spec with the fact it encodes).
