# Printer P1.5: measured rate and krone sensitivity (2026-11-15)

Status: **written, not merged, not deployed.** Issue #426. Decision: #374 resolved by Faiz on 2026-11-15, "measure sensitivities first" (option 1 in [P1 doc](printer-p1-ledger-engine-2026-10-20.md)). Unblocks #413 (the Royal Mint 3D room).

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

## Honest limits

- Past behaviour over a few years is not a forecast; rate and krone effects move between regimes.
- A lever's own cell can still be Low (for example Coin Rain), and then even a measured holding coefficient gives direction only. P1.5 helps most for the Toll Gate, whose channel cells are Medium.
- Whether this is enough for #413's "a range per holding" can only be judged on Faiz's real portfolio after deploy: look at `/game/printer?pull=toll_gate:1` and count holdings with `show_amount: true`.

## Files

`services/game/printer_sensitivity.py` (pure), `services/game/printer_view.py` (`stored_rate_krone_lookup`), `services/game/printer.py` (measured coefficients), `schemas/printer.py` (`basis`), `api/game.py`. Tests: `tests/unit/test_printer_sensitivity.py`, one case in `tests/integration/test_game_printer_api.py`.
