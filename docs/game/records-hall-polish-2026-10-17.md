# Hall of Records polish (2026-10-17)

Faiz's three asks on the Records page, game mode. Written and tested locally, not merged, not deployed.

**Visual verb + scene:** open the book. A brass-plated tome on a shelf swings its cover open on the reading desk.

## What changed
1. **Torches and arches no longer stretch.** `TorchPair` was one wide SVG forced to the page width (`preserveAspectRatio="none"`), so flames went flat on wide screens; the cornice arch row was stretched the same way. Now each torch is its own square SVG pinned to a side (shared kit, so Council and every room banner get the fix), and the arches are an SVG pattern at a fixed size, centred. Flames are a little larger so they read as flames.
2. **Brass nameplates under each tome.** Engraved name (Marcellus), a small ornament, then the act in small caps and the date. Long names wrap to 4 lines with the full name as a tooltip. The pressed tome's plate lights up.
3. **Opening animation.** Pressing a tome swings its leather cover open (about 1 s) and the desk is an open book in that tome's leather: left leaf "what you wrote" and "what would prove it wrong", right leaf price, verdict, reviews and Then and Now. Text writes in leaf by leaf. A red ribbon hangs in the spine when a review is owed. Phone: no 3D cover, the book tips up onto the desk. Reduced motion: the open book at once. Not played on page load, only after a press.

## Rules kept
No fact moved or added; words unchanged. Only transform, opacity and one short clip-path reveal animate; no filters. The cover is `aria-hidden` decoration.

## Identity checklist
Pages touched: Records (and the shared torch kit). Identity before/after: 3 / 3 (signature object is now the book itself). Look-and-judge screenshots: taken from a standalone preview of the hall at 1700 px (header, shelf, four frames of the opening); not yet seen on real data or on the live deploy.

## Faiz can still do
Draw a dedicated cover picture per action (buy, sell, trim, add, hold, pass). The cover face is a leather panel with the shelf tome picture; a painted image would slot into `.hall-cover-front`.
