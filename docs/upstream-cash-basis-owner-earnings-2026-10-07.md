# Upstream oil and gas: cash-based owner earnings (assumptions v5, 2026-10-07)

**Status:** written and tested, not merged, not deployed. Branch `feature/upstream-cash-basis-owner-earnings`, stacked on
`feature/valuation-normalised-base-certificates-insurer-roe` (PR #59): merge #59 first. Context: [valuation-v4-normalised-base-certificates-2026-10-07.md](valuation-v4-normalised-base-certificates-2026-10-07.md).

## Why

A review of the Vår Energi result argued that deducting all capex makes a producer in a build-out look cash-burning. The queries
(2026-10-07) showed the stronger problem is the other half of the formula. Net income + D&A ignores that most of a Norwegian producer's
tax expense is deferred:

| USD m | FY20 | FY21 | FY22 | FY23 | FY24 | FY25 |
|---|---|---|---|---|---|---|
| Owner earnings, net income basis | -1,877 | -340 | -389 | -743 | -797 | +434 |
| Operating cash flow − capex | -68 | 1,995 | 3,089 | 779 | 533 | 1,787 |
| Total debt | 5,584 | 4,827 | 2,953 | 3,147 | 5,137 | 5,942 |

FY2022: tax expense 4,920 of 5,856 pre-tax profit, but operating cash flow 5,682 against net income + D&A 2,384.

## What changed

| | |
|---|---|
| Who | Energy sector **and** decommissioning payments on file (`upstream_detection.py`). Oil services and refiners without them are untouched |
| Base | operating cash flow − capex − decommissioning − lease payments − interest paid in financing (the existing `free_cash_flow_to_owners`) |
| Shown | the note names the basis and the net income basis it replaces; the DCF note says v5 |
| DCF | the v4 median logic then runs on these figures (Vår Energi: median of FY2021–25 about 1.7bn USD, a hand estimate) |
| Where | assumptions v5 (default) for the DCF; the metrics panel, evidence packet and thesis metrics use it for upstream holdings regardless of version |
| Fallback | no operating cash flow or capex for a year: that year uses the net income basis |

The growth-capex argument is not adopted: capex is still fully deducted (an upstream producer's capex is largely reserve replacement).

## Not done

- Dividends paid are not extracted, so payout coverage cannot be tested (debt rose 3.1bn to 5.9bn over FY2023–25 while cash flow after capex totalled about 3.1bn).
- The panel/evidence use the cash basis even when the active version is v4 (v4 DCF does not).
- Aker Solutions and Subsea 7 are expected not to qualify (no decommissioning payments); check after deploy.

## After deploy (once #59 and this PR are merged)

1. `git pull` in `E:\Aladdin`; no `ACTIVE_VALUATION_ASSUMPTIONS_VERSION` override on Railway.
2. Refresh Margin of safety; recheck Vår Energi, Equinor, Aker BP.
3. Check that Aker Solutions and Subsea 7 still show the net income basis in their notes.
