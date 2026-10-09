# Game identity: page-scene kit and Council Chamber — 2026-10-09

Status: **written and tested, not merged, not deployed. Seen only in headless Chromium with a synthetic fixture (desktop 1280 px and phone 390 px), never with real data.** Frontend only, no backend change, no migration, no new dependency. Design: [circle-council-design-2026-10-09.md](circle-council-design-2026-10-09.md); standard: `.claude/standards/game-visual-identity.md` (added by PR #88).

## What changed

- **Page-scene kit** (`components/fortress/kit/`): `Crest` (one shield per room), `TorchPair`, `GamePageHeader`, `ParchmentPanel`, `SealMark`, `FogPanel`, `Speaker`, `CouncilChamber`. Pure mappings in `lib/seals.ts`, `lib/councilSeats.ts`, `lib/crest.ts`, `lib/plainView.ts`. CSS in `index.css` (`.parchment`, `.game-banner`, `.fog-panel`, `.chamber`, `.market-bubble-right`).
- **Banner on every fortress room except the Fortress home and the Marketplace** (they already have their own scene): `PageHeader` renders the painted banner in game mode on `/fortress/*` rooms; otherwise it is unchanged. Records, Chronicle, Siege, Circle and Map get the banner with this PR; their bodies are unchanged.
- **Plain view** (button in the banner, kept in this browser): drops the painted scene and shows the same facts as ordinary cards. A way back is always shown.
- **Council Chamber:** a round table with one chair per agenda rule (eight, fixed order). A lit chair has a wax seal, a stack of papers and the real count; an empty chair is plain and says "nothing found". Agenda items are parchment folios with a seal (triangle "!" = Warning, circle "i" = Note: shape, glyph and printed word). The unknowns are a fog panel. Advisors are portraits with speech bubbles. One footer (`GameFooter`).
- **Fix found on the way:** the Fortress tab strip was 695 px wide on a 390 px phone (the page scrolled sideways) because of `mx-auto` without `w-full`. One class.

## What it deliberately does not do

No gavel (nothing is decided here), no hourglass or timer, no "x of 8", no tick or fanfare for an empty agenda, no green anywhere. An empty chair is neutral, says "none found" and is not "all clear": when the council lists things it could not check, the chamber adds "Some rules could not be checked (see below). An empty chair is not proof of nothing." Seals never rely on colour. No new data: every picture repeats a field the list below already shows.

## Verified

`tsc` clean, ESLint 0 errors (the 2 existing warnings), vitest all passing (new: seals, council seats, crest, kit render tests including the empty agenda, no-colour-only status and the chamber's word budget), build. Chromium screenshots of the Council in game mode, Plain view and normal mode at desktop and phone width: no horizontal overflow.

## Independent review (read-only agent) and what it changed

One blocker, fixed: an empty chair read "nothing found" even where the council also listed that the rule could not be checked. Fixed with the "none found" wording and the unresolved note above, tested. Also fixed: contrast of banner links and parchment fine print (>= 4.5:1), focus returns to the toggle after Plain view is switched, 44 px target on the Plain view button, a decorative seal no longer announces a different word than the chip beside it, tests for the banner choice (`components/ui.test.tsx`).

## Not verified / look-and-judge for Faiz

Not seen on real data or in your browser. Please check: does the chamber read as the game? Is the empty-chair wording calm rather than alarming? Are the seals readable on your screen? Is the banner on Records, Chronicle, Siege, Circle and Map acceptable before their bodies are redesigned? `Council.as_of` meaning is unverified, so the data-age candle from the design was not built.

## Identity score (inferred from code, to be re-scored with screenshots)

Council 1 -> 2 (chamber, folios, seals, fog panel, Plain view). The other rooms 0-1 -> 1-2 from the banner only.
