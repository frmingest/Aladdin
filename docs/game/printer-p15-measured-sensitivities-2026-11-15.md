# Printer P1.5: measured rate and krone sensitivity (2026-11-15)

Status: **written, not merged, not deployed.** Issue #426. Decision: Faiz chose "measure sensitivities first" (option 1 in [P1 doc](printer-p1-ledger-engine-2026-10-20.md)) for #374 in chat on 2026-11-15; #374 stays open until this is merged and checked on the real portfolio. Does **not** unblock #413 by itself, see "What it can and cannot do".

## What changed, in plain words

Before: only the stock-market part of a holding's reaction was measured (its beta). How it reacts to long rates and the krone was a sector guess, always Low, so the Printer showed direction words and almost never a krone figure.

Now: for each holding the app measures those two reactions from the holding's own stored prices (in NOK), the same spirit as the Siege Simulator. A measured number replaces the guess **only when the history is long and the fit is clear**. Otherwise the sector guess stays and stays Low. Inflation and credit spreads are still sector guesses.

## The method

Weekly returns (last stored close in each week), one regression per holding:

`holding % = a + b_market x benchmark % + b_rate x change in Norway 10-year yield (pp) + b_krone x krone strengthening vs USD (%) + noise`

- The benchmark is the Siege benchmark, in NOK. The market term keeps a rate or krone number from being the market's own move in disguise.
- A coefficient is used only if: at least 60 aligned weeks; at least 2 standard errors from zero; a plausible size (long rate within 25% per pp, krone within 3% per 1%); and the whole fit explains at least 5% of the holding's moves.
- Too little history, or inputs too alike to tell apart: nothing is measured and the reason is stated. Never a default.
- All arithmetic is plain Decimal code (CLAUDE.md Rule 1); nothing is stored; no provider call, no LLM.
- Rules live in `backend/app/domain/game_mapping/printer_sensitivity_v1.py` (a change after real use is a `_v2`, Rule 3). `printer_v1.py` is untouched.

## What the Printer does with it

A measured term earns Medium (still capped by the lever table's own confidence for that channel). Every term in `/game/printer` now carries `basis`: `measured`, `sector_guess` or `beta`, so the Ledger of Truth and the Mint room can say which is which.

## What it can and cannot do (checked against the engine, 2026-11-15)

A holding's confidence is the lowest confidence among its *material* terms (a term is material when its range is at least a quarter of all terms' ranges). A term's confidence is the lower of the holding's coefficient and the **lever table's channel cell**. Measuring the holding fixes the first; it cannot fix the second, and most lever cells are "game judgement, Low" in `printer_v1.py`.

| Lever, 1 year | Equity cell | Long-rate cell | Krone cell | Effect of P1.5 |
|---|---|---|---|---|
| Toll Gate | Medium | Low | Low | **Helps, narrowly.** A measured small rate and krone sensitivity shrinks the guessed terms below "material", so the reading can become Medium and show a NOK range. A holding measured as strongly rate-sensitive stays Low (direction only). |
| Great Melt | Low | Medium | Low | None: the equity term is Low and material. |
| Great Press | Low | Medium | Low | None, same reason. |
| Coin Rain | Low | Low | Low | None. |
| Harbour Guard (sterilised) | High | High | Low | Little to change; most terms are already zero by definition. |

So after P1.5, NOK ranges are possible mainly for the Toll Gate at 1 year. The 3-year column is judgement almost everywhere and stays direction-only. Showing amounts for the other levers needs sourced evidence in the lever table (Claude researches and cites each cell), not better holding profiles. That is a separate, larger piece of work and a decision for Faiz.

## Honest limits

- Past behaviour over a few years is not a forecast; rate and krone effects move between regimes.
- A holding with no clear measurement (short history, |t| under 2, collinear inputs) keeps the sector guess and stays Low.
- Whether this is enough for #413's "a range per holding" can only be judged on Faiz's real portfolio after deploy: look at `/game/printer?pull=toll_gate:1` and count holdings with `show_amount: true`.

## Files

`services/game/printer_sensitivity.py` (pure), `services/game/printer_view.py` (`stored_rate_krone_lookup`), `services/game/printer.py` (measured coefficients), `schemas/printer.py` (`basis`), `api/game.py`. Tests: `tests/unit/test_printer_sensitivity.py`, one case in `tests/integration/test_game_printer_api.py`.
