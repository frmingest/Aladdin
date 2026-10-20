# The Printer, Sprint P1: the Ledger and the engine (2026-10-20)

Status: **written and tested in the cloud, not merged, not deployed, not seen in a browser.** Plan: [the-printer-sprint-plan-2026-10-20.md](the-printer-sprint-plan-2026-10-20.md). No pictures and no page yet: the numbers come first.

Visual verb + scene (unchanged, for P2/P3): *Stamp* in the Royal Mint. Nothing visual ships in P1.

## What was built

| Piece | File |
|---|---|
| The lever table (the Ledger of Truth): 5 levers x 6 channels x 2 horizons, each cell with low / base / high, a confidence tag, a source and a one-line basis | `backend/app/domain/game_mapping/printer_v1.py` |
| The engine (pure: no database, provider, model or clock) | `backend/app/services/game/printer.py` |
| Read path and Ledger view | `backend/app/services/game/printer_view.py`, `backend/app/schemas/printer.py` |
| Endpoints | `GET /game/printer?pull=toll_gate:1&pull=great_press:2&horizon=1`, `GET /game/printer/ledger` |
| Tests | `backend/tests/unit/test_game_printer.py` (hand-worked numbers), `backend/tests/integration/test_game_printer_api.py` |

The five core levers: Toll Gate (policy rate), Great Press (QE), Great Melt (QT), Coin Rain (helicopter money), Harbour Guard (FX intervention, with a sterilised / unsterilised toggle). Horizons 1 and 3 years (decision 2). Plain and after-inflation figures are both returned (decision 3). A wild-pull warning is returned (decision 4); the small "nudge" of the temperament meter is a game-side effect for P3 and is not built.

## How the arithmetic works (all in code, no AI)

1. Each pull adds `size x per-unit effect` to six channels: the stock market as a whole, short rate, long rate, expected inflation, the krone against the dollar, credit spreads. Uncertainty is carried as a range and summed at its widest, then capped per channel. Opposite pulls on one channel are flagged "cancelling".
2. A holding's reaction to the stock-market channel uses its own beta from the Siege Simulator (measured from stored price history: Medium; vendor beta or demo: Low). Its reaction to the other channels uses a **sector guess** (always Low).
3. Reading: a whole-percent range (rounded outward so it never narrows), NOK range, after-inflation range, a direction word (`up`, `leans_up`, `unclear`, `leans_down`, `down`), a one-line why. **Low means direction only: no NOK figure is ever returned.** A Low term only drags the reading down when it carries at least a quarter of the total uncertainty. A holding with no beta or no value is "not modelled", never defaulted.

Added to the plan: a sixth channel, the stock market itself. The plan listed five; the one sourced number for the Toll Gate (about 1% on stocks per 25 bp) is a market-wide effect and needs somewhere to sit.

## Sources actually opened (2026-10-20)

| Cell | Source | What the page said |
|---|---|---|
| Toll Gate on stocks | Bernanke & Kuttner, FEDS 2004-16 | an unexpected 25 bp cut goes with "about a one percent increase in broad stock indexes" (announcement-day effect, US) |
| Great Press on long rate | Hamilton on Williams (2013) | "15- to 25-basis-point decline in the 10-year yield" per extra $600 bn; "considerable uncertainty". Per-1%-of-GDP figure is our division |
| Great Melt on long and short rate | Fed FEDS Note 2022-06-03 | 1% of GDP of runoff raises the term premium about 10 bp, largely offset by a lower policy path (model) |
| Toll Gate on the krone | Norges Bank Staff Memo 3/2025 | +1 pp surprise gives about +2% krone vs a basket, back to start within about three months |

Everything else is marked **game judgement, Low**. No source was found for helicopter money or for the size of FX-intervention effects (the survey page read gave no numbers). The three-year column is mostly judgement.

## Finding that needs a decision (for Faiz)

**Almost nothing can show a krone amount yet.** Every lever moves several channels, and a holding's reaction to the non-market channels rests on a sector guess (Low). Only the Toll Gate has a Medium stock-market cell, and even there the long-rate and credit terms are material and Low. So with today's evidence the Realm Report would show direction words, not NOK ranges. That is the rule working as designed, but it means the "range per holding in NOK" the plan promises needs better holding profiles first. Options, cheapest first:

1. **Measure each holding's rate and krone sensitivity** from the price history the app already stores (Norwegian 10-year, USD/NOK), the same way the Siege Simulator measures beta. A small "P1.5" sprint; turns the Low terms into Medium where the fit is good.
2. Accept direction-only for v1 and make that the charm (fog until the evidence is good).
3. Loosen the Low rule. Not recommended: it would show precise-looking numbers resting on guesses.

## Not done on purpose

- The other eight levers (P2 adds them with the page).
- Any picture wiring (see the art note in the progress file).
- Nothing is stored; no migration; no link to the analysis or recommendation engines.
