# Valuation guardrails — build (2026-09-29)

> **Status update 2026-10-04 (housekeeping review):** the code described here is merged to `main` (checked in the repo at `07cf9fb`). The "not merged / PR open" wording below was true when written and is kept as history. Whether it is deployed or behaves correctly live was not checked in that review.

**Status:** written and tested on branch `feature/valuation-plausibility-and-financials`, PR open. **Not merged, not deployed, not checked live. No migration.**
Follows [sb1no-implausible-dcf-investigation-2026-09-29.md](sb1no-implausible-dcf-investigation-2026-09-29.md).

## Problem
SB1NO.OL showed a DCF of ~3,953 NOK against a 229.50 NOK price → "Strong Buy", target 3,170–4,899. Prices were right; the valuation was wrong.

## What changed
| # | Fix | Where |
|---|---|---|
| 1 | **Growth cap + fade** — base growth capped at 10%, fading linearly to 2.5% terminal; cost-of-equity floor 8% | new `valuation_assumptions/v2.py` (default). `v1` untouched (Rule 3) |
| 2 | **Plausibility guard** — value >3× or <⅓ of price is withheld, reason shown, rejected numbers displayed as "do not use" | `holding_valuation.py`; all consumers use `headline_values()` |
| 3 | **Banks/insurers → justified P/B** = (ROE − g)/(Ke − g) × book value; interest coverage, leverage, EV/EBITDA etc. marked not meaningful | `valuation/financials.py`, `metrics.py`, evidence packet |
| 4 | **Old stored runs** — read-time `price_target_warning` when stored target is outside the 3× band vs the price at run time | `services/analysis/target_check.py`, `GET /analysis/...` |
| 5 | **"rf 428.6%" label** → `rf 4.3%` | `ValuationPanel.tsx` |

## UI
Holding page: bank P/B card, "Valuation withheld — not reliable" panel, growth-cap/fade notes. Analysis panel: red "Price target not reliable" box. Watchlist: "Not reliable" in DCF cell. Margin-of-safety board shows the reason.

## Tests
Backend 1066 pass / 2 fail (same 2 pre-existing on untouched `main`); ~42 new tests incl. SB1NO regression v1 vs v2. ruff clean. Frontend tsc 0 errors, eslint 0 errors, vitest 22/22, build OK.

## After merge (Faiz)
1. Check Railway has no `ACTIVE_VALUATION_ASSUMPTIONS_VERSION=v1` override.
2. Re-run analysis for SB1NO.OL, SPOG.OL and other banks — old stored verdicts stay in the DB (flagged, not deleted).
3. Not covered: sector list is keyword-based (financ/bank/insur); dividend-model for insurers not built.
