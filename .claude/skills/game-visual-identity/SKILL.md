---
name: game-visual-identity
description: How to design a game page's visual identity from real data (scene header, kit pieces, a fact encoded visually, Plain view). Use when specifying, building, reviewing or planning any game-mode page, tab or dialog, and when someone says a page "looks like the normal app".
---
# Game visual identity method
Standard: `.claude/standards/game-visual-identity.md` (ladder 0-3, anti-patterns, direction memory). Read its section 4 first.

## Steps
1. **Name the page verb** (read, weigh, judge, remember, mark). Pick the one real fact the page is about.
2. **Pick the visual verb + scene**: a noun in the existing motif list that carries that fact (tower, moat, fog, raven, scroll, seal, lamp, crest, map ring, hourglass) and a place it sits (header band, centre object, margin).
3. **Write the mapping as a pure function** `fact -> {shape, size, fill, crack, fog, label}`; unknown -> fog or "?" glyph, never a default-good draw. Name the file in `lib/`.
4. **Compose from the kit** (parchment panel, seal badge, crest, banner, frame corners). Add to the kit before inlining.
5. **Cut words**: remove the sentence the picture now says; keep one caption line; number and source in the tooltip/detail.
6. **Plain view**: same facts as labelled blocks with numbers. Colour never alone.
7. **Budget**: static composition first; at most one looping animation on the page, none under reduced motion; no animated SVG filters.
8. **Look-and-judge**: list the screenshots Faiz should look at (desktop, phone, plain, game vs normal) and one question each.

## Recipes (page type: scene header / hero object, fact encoded, unknown state)
- **Council (agenda).** A long table with banners: one pennant per agenda item hung on a rail, pennant length = weight in the book, fray/crack = knife-edge distance, empty rail = "nothing due" shown as a bare rail with the next-bell date. Unknown: grey blank pennant with "?".
- **Records (journal and reviews).** Shelf of sealed scrolls: wax seal intact = review not yet due, cracked = 6/12-month review open, ribbon = written. Scroll length = days held. Unknown outcome: sealed, never a verdict colour.
- **Circle of Competence.** A map ring: sectors as wedges of a drawn circle, inside = marked within circle, outside = beyond, hatched = unmarked (fog). Wedge arc = portfolio weight. Replaces the marking table as the first view.
- **Siege Simulator.** A cross-section of the walls: each tower drawn at its modelled loss as a breach height on the wall; unmodelled towers stay fogged (no beta) with a small "not modelled" banner; headline coverage as a fog band across the horizon, not four empty tiles.
- **Chronicle (time).** A scroll timeline or frieze: one panel per stored frame (hourglass for gaps, a bare wall segment for "worker off"), changed lines as illuminated initials. Two frames shows two panels and a blank scroll end, honestly.
- **Marketplace street and Store.** A street of shopfronts: awning colour never status; sign shape = verdict word + glyph; price band as a plank gauge; stores with no price grouped as one shuttered row. Store header = merchant stall with the single decision on the sign.
- **Scriptorium/Scrolls library.** Shelves per tower: scroll size by report type, seal broken when opened (labelled opened, not understood).
- **Dialogs (Sal, Genie, Hype booth).** A character plate (existing `GenieFigure`/advisor art) beside at most three lines; answer first.

## Review score (0-3) quick test
Cover the text: can you say which game page it is and what fact it shows? Overlay it on normal mode: does it differ in composition, not just colour? Both yes and kit used = 2; plus a signature object = 3.
