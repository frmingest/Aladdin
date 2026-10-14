# Kongsberg multiples: the wrong reason on the EV/EBITDA card (2026-10-14)

Status: **written, not yet deployed** (branch `fix/kongsberg-multiples`, stacked on `fix/equinor-beta`). Found from Faiz's live screenshot of Kongsberg's "Multiples over time".

## What was wrong

- The EV/EBITDA card said "missing: shares_outstanding (and no net income ÷ EPS to derive it)", yet shares are found for FY2020 to FY2025 (the notes under the charts say so).
- Cause: when a metric has no chart point at all, the card quoted the reason from the **first** period that had one. The first period for Kongsberg is FY2019, which holds only opening balances (cash, equity), so it says "missing shares" for every metric.
- The real, current reason is **no EBITDA**: Kongsberg's filings have no depreciation tag the extractor recognises (known gap, [data-gaps overview](data-gaps-overview-2026-10-03.md)), so EBITDA cannot be derived from EBIT + D&A either.

## What changed

- The card quotes the **newest** period with a reason and names it, e.g. "FY2025: missing: ebitda (and no EBIT + depreciation_and_amortization to derive it)" (`frontend/src/lib/multiples.ts`, tested).
- The backend message for a missing EBITDA says what it would take to derive it (`ev_to_ebitda` and `net_debt_to_ebitda`). Tested.
- The underlying gap is unchanged: Kongsberg still has no EV/EBITDA until its D&A is read from the filing (diagnosis fix #1, a separate generic feature).

## Not fixed: the Kongsberg P/S jump at FY2024

P/E and P/B fall smoothly but P/S jumps up at FY2024 and eases at FY2025. The cause is **not known**: the code pairs one share count and one price with each year's revenue, so the odd value is probably in that year's stored revenue (or its basis, for example continuing versus total after a restructuring). It needs the stored figures to say. To settle it: open the holding's "Show the extracted figures" for FY2023 to FY2025 and read revenue and net income.

## Also still open

"Multiples over time" most likely pairs the one or few stored recent prices with every year (the code takes the stored price nearest each year end, and the app only has recent prices), so older points show today's price over that year's earnings, not that year's multiple.
