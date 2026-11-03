# 3D text pass 3: Quest log, Siege Yard, advisors, shelf signs

Date: 2026-11-03. Written, not looked at in a browser, not merged, not deployed. Source: `docs/game/game3d-text-review-2026-11-03.md`. The catalogue spreadsheet (`game3d-text-review-catalogue-2026-11-03.xlsx`) was not in the repo or on this machine, so the rewrites follow the review's glossary and its before-and-after table, not row by row.

## What changed

| Area | Now | New file |
|---|---|---|
| Quest log | "Write Your Whys", "Six-Month Look-back", chip "To do", "0 of 5 have both lines", "Sample fortress, not yours." | `questWordsV3.ts` |
| Advisors | Barren Wuffet warm and in full phrases; Marlie Chunger clipped and dry ("No why on paper? Then nothing can prove you wrong. Convenient."). Goodbye (E) closes the talk. | `dialogueV4.ts` (v1 to v3 untouched) |
| Siege Yard | Sway (hover: "1.0 moves with the market"), "Whole fortress", "Fortress test disagrees" (long note in the hover), "In fog" for untested towers, headline "A 30% market fall costs the fortress 12.3%. Crosses the storm line." | `siegeYardWordsV2.ts` |
| Shelf signs | The Whys (was The Oath), The Storm Drill (was The Storm Test), The Council; "In fog" chip; walls in plain words ("Debt vs yearly profit: 1.40 times"); low, middle, high case; no "stress scenario", "tripwire", "not surveyed" | `shelfSignsV2.ts` |

Flat mode keeps its neutral labels in `lib/fortress.ts` and `lib/siege.ts`.

## Bugs fixed

- Quest log: the Standing "next" line now gets the same full-stop guard as the watch and ledger lines (no `..`).
- "No written reason" vs the count: the quest counts a holding as done only with both lines (why and what proves you wrong). v4 says "still need words" and "have both lines".
- Hype Booth tip-note error: it had its own list that only two phases showed. It is now `noteError`, shown beside the Keep the tip note button, and cleared on retry.
- Empty Market Street: `STREET_EMPTY` now has a call site (`emptyStreetNote`, shown under the stand prompt only when the watchlist was read and holds nothing; at Sal's counter it says to press E). `SOON_AS` lives only in `worldWordsV1.ts`, which V2 replaced, so it is dead and left alone.
- Save error: the face already said "Couldn't save that." (pass 1), but the hover still said "Could not load your journal". It now comes from `saveError.ts` (never "load").

## Tests

`frontend/src/game3d/textPass3.test.tsx` pins: no buy, sell, avoid, thesis, tripwire, beta, EBITDA, stale, "not surveyed", "flat page" on these faces; no doubled full stop; word budgets (dialogue lines 28 or fewer, quest words 16 or fewer, signs 3, gap flag 3, headline 14); the both-lines count; the street hint; the save-error detail. Existing tests were updated for the new names.

## Left for pass 4 (not in this PR)

- Vault, Night Watch, ravens, temperament, realm verdict and store gate cards (the shared flat cards, and the game-voice option they need).
- Backend-written text that passes through: Night Watch lines, Council (advisor) lines, standing and wire labels, `wall_reason`, `land_reason`, margin text, and the per-tower fog reasons in the Siege Yard.
- Failed look-back save in the old-books panel (`JournalBooksPanel`) shows nothing.
- Hype Booth and Sal speech, symbol hints, "Who whispered it?" (`lib/hype.ts`, `lib/salesRep.ts`).
- Where-to menu names (Cushion, Reasons, The Wide Weather), the Stats readout, Market stall plates ("In reach · 4% over"), the Storm Drill panel itself (`stormDrillWordsV1`), the Realm panel, the Library Land shelf "Last verdict" decision.
- Not checked: any of this on screen.
