# Text pass 4i: the Council's words and the Standing labels, 2026-11-09

Two small pieces from [remaining work](../sprints/remaining-work-2026-11-06.md), in one PR. Written and tested in a local workspace; not deployed and not seen in a browser.

The text review said Council and standing labels "need a backend wording version". They do not: the Council lines carry their rule id and a fixed template, so the same 3D-only layer used for 4f and 4h works, and the flat Fortress and the backend are not edited. Version files stay new files.

## 1. The Council shelf (Library, seventh shelf)
- New `game3d/advisorLinesWordsV1.ts`: `gameAdvisorLine`, `gameAdvisorFact`, `gameAdvisorDisclaimer`. All 15 templates in `advisor_lines_v1.py` are covered, plus the 18 "Why" facts `advisors.py` writes, plus the footnote.
- Voice follows the text review: the Oracle warm in full phrases, the Partner clipped and dry. Examples: "Kongsberg is 12.3% of the portfolio and its walls are timber. A big position should have…" becomes "Kongsberg holds 12.3% of the fortress and its walls are patched. A big tower needs the strongest walls you own, not the weakest. Flip it: what has to go wrong for this to hurt?"; "Vend: 2 of the conditions you wrote down as proof the thesis was wrong has fired." becomes "Vend: 2 of the signs you said would prove you wrong have shown up." (the backend's "has fired" with a count is also fixed); facts "weight 12.3%", "wall: timber", "land: above the bull case" become "share 12.3%", "walls: patched", "price: above the high case".
- Names, shares, counts, days and correlations are copied out of the sentence; an unknown share reads "a share in fog". Wall names reuse the 3D ladder (basalt sound, granite solid, brick worn, timber patched, rotted failing); bear, base and bull become low, middle and high case.
- No line says buy, sell, add or trim (tested). The footnote keeps its meaning: "not quotes from Warren Buffett or Charlie Munger, and not advice to trade".
- An unknown sentence (a new rule, or a v2 wording) and free-text reasons the backend copies from other cards come back untouched.
- `councilShelf` in `libraryShelves.ts` runs each line, each fact and the footnote through it.

## 2. Standing labels
- Level titles, goals and torch facts are already game voice in the backend. Three strings were not: "queue the analysis", "Nothing is known." (unknown is fog) and the gap label "no tagged filing". New `game3d/standingLabelsWordsV1.ts` rewrites exactly those, by exact match; every number-bearing fact is left alone.
- Applied to the Quest log's Standing words (`Game3DPage`) and to the tower gap label (`withGaps`). The `standing.test.tsx` gap test now expects "no tagged report".

## Tests
`advisorLinesWordsV1.test.ts` (every backend template through the layer: banned words absent, names and numbers kept, singular reads as singular, no trade wording, unknown untouched), `standingLabelsWordsV1.test.ts`, and one Library test that runs a real backend sentence through `councilShelf`. `eslint` clean on the changed files.

## Still open in text pass 4
Only the Realm "Buy/Sell" call and what "Last verdict" says on the Land shelf (Faiz).

## Environment notes
- The case clash is wider than the earlier note said: 29 pairs in `frontend/src/game3d` (`Component.tsx` next to a lowercase `component.ts`, e.g. `Confetti`/`confetti`, `StaticBatch`/`staticBatch`, `KeepModels`/`keepModels`). On a case-insensitive disk `./Name` can resolve to the `.ts` file, so a local `tsc` or build fails; Linux CI is fine. Renaming all 29 is its own PR, not a quick fix.
- The sandbox's scratch disk was full during this work; tests ran with a temp folder inside the repo folder, since removed.

## Checklist section A (3D text)
1. Pages touched: `/game3d` Library (Council shelf), Quest log (Standing), towers' gap label.
2. Identity before/after: unchanged.
3. Visual verb + scene: none new; same shelf and log, words only.
4. Words: no "thesis", "tripwire", "portfolio", "positions", "valuation", "queue", "filing" on these lines. Numbers exact.
5. Rules kept: unknown is fog, flat page keeps its wording, new version files, no LLM arithmetic, no trade wording.
