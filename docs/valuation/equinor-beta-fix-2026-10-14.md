# Equinor beta fix: reject betas that cannot be right (2026-10-14)

Status: **written, not yet deployed** (branch `fix/equinor-beta`). Found from Faiz's live screenshot of the Equinor valuation (beta -0.66).

## What was wrong

- The DCF discount rate is CAPM: risk-free rate + beta x equity risk premium. The beta is Yahoo's `beta` figure for the ticker, stored and used as it came.
- For EQNR.OL Yahoo gave **-0.661**. CAPM then gave a cost of equity of 2.3%, below the 5.24% USD risk-free rate. A negative beta for an oil producer is a data error (Yahoo measures an Oslo listing against a different, thinly traded market), not a finding.
- The 8% floor on the cost of equity (assumptions v2 onward) happened to catch it, so the discount rate looked normal while the real input was wrong. The page did say "a low beta understates equity risk", which suggests a merely low beta, not a nonsense one.

## What changed

- **New assumptions version v5** (`app/domain/valuation_assumptions/v5.py`, active by default): identical to v4 except a vendor beta **below 0 or above 3** is not used. The default beta (1.0, the same fallback already used when no beta can be fetched) is used instead, and the valuation warning says which beta was rejected and why. v1 to v4 are untouched and behave as before.
- The two valuation paths that use CAPM (DCF and the bank price-to-book model) share one function, so both are covered.
- The rejected value is kept on the result (`rejected_beta`) for tests; the stored beta itself is not changed.

## Effect on Equinor

The cost of equity moves from the 8.0% floor to about 9.7% (5.24% + 1.0 x 4.5%). A higher discount rate lowers the DCF value and the margin of safety (45% before). The exact new figures show after Refresh on the Equinor page.

## Limits and follow-ups

- 1.0 is a conservative stand-in, not Equinor's real beta. A measured beta from stored price history (the Siege Simulator already does this for downside beta against OSEBX) would be better; that is a separate piece of work.
- The Siege Simulator still falls back to Yahoo's beta where price history is missing, and says so. It does not use this check.
- Only values that cannot be right are rejected. A low-but-positive beta is left to the cost-of-equity floor.
