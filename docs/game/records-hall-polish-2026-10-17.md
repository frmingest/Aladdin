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

## Painted book (Stitch pictures, same day)
Faiz's pictures replaced the CSS-drawn book: six painted covers (one per action; buy, add, trim, sell, hold, pass), a painted open book (split into left and right leaf, drawn with `border-image` so the ornament corners never stretch and the leaf grows with its text) and a painted ribbon. Packed through `scripts/art/pack.py` into `frontend/src/assets/art/book-*.webp` (about 175 KB; art budget raised to 3000 KB). Only the covers of actions on the page load. The cover's back face is the left leaf, so the swing lands seamlessly. Phone: leaves stack, no ribbon, no 3D swing. Masters live in gitignored `art-masters/Design_master/`. Checked in a standalone preview at 1700 px and 390 px; not seen on real data or live.
## Fixed-size book with pages (2026-10-17, after the first live look)
Every record now opens the same size book (aspect 1.55, up to 1000 px wide) instead of growing with its text, so the painted frame is never stretched. The text flows through CSS columns, one per page: title, dates and both notes first, then the facts (price, verdict, reviews, Then and Now) starting on the right-hand page. When it overflows the first two pages a brass pager appears ("Back", "Page 1 of 3", "Next page") and a painted leaf swings over the spine to turn the page. Reduced motion and phone turn instantly; phone shows one page at a time. Tabbing to a link on another page turns to it. Not seen on real data or live.

