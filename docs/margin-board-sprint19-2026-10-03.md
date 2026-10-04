# Sprint 19: make the Margin-of-safety board rank more (2026-10-03)

> **Status update 2026-10-04 (housekeeping review):** the code described here is merged to `main` (checked in the repo at `07cf9fb`). The "not merged / PR open" wording below was true when written and is kept as history. Whether it is deployed or behaves correctly live was not checked in that review.

Branch `feature/sprint-19-board-ranks-everything`. Backend plus one frontend line. **No migration.**
Written and tested; **not merged, not deployed, not run against your real data.**

## What changed

| # | Item | Result |
|---|---|---|
| 1 | **Loss-making first year no longer blocks the DCF** | New valuation assumptions **v3** (now the default). Growth is measured over the *latest unbroken run of profitable years* instead of from the earliest year on file. Years elapsed are real calendar years (a missing filing does not shrink the span). Older loss years are listed in the valuation notes, never hidden. v1 and v2 are untouched (CLAUDE.md Rule 3) |
| 2 | **Fund holdings from a PDF** | The fund holdings importer now reads a **text-layer PDF** (annual report or monthly report portfolio table) with PyMuPDF's table finder: header found by name + weight columns, a table continuing on the next page without a header is joined, the as-of date is read from the text above the table. A scanned PDF is refused with that reason. The Fund facts upload now accepts `.pdf` |
| 3 | **Norwegian funds tagged correctly on import** | Names that start with Heimdal, Alfred Berg, Skagen, Holberg or Delphi and carry no other marker become *Equity fund*. "Heimdal Høyrente Pluss" stays money-market, "Alfred Berg Nordic High Yield" stays bond fund. Affects new imports only; the three existing holdings still need re-tagging by hand (see Needs) |

## What v3 does and does not do

| Case | v2 (before) | v3 (now) |
|---|---|---|
| Every year profitable | CAGR first to last | **Identical result** (tested) |
| Early loss year, profitable since (2 or more years) | Unavailable: "earliest period's value is not positive" | Valued; note names the years left out |
| Latest year is a loss | Unavailable | Unavailable: "latest period (FYxxxx) is not profitable" |
| Only one profitable year | Unavailable | Unavailable: "only one profitable year on file" |

v3 keeps every other v2 guardrail: growth cap 10% fading to 2.5%, cost-of-equity floor 8%, the 3x plausibility check, the bank method.

**Honest limit:** this fixes the "early loss year" case only. If Salmon Evolution has a single profitable year, or its latest year is a loss, it stays unrankable and says exactly why. Valuing a pre-profit company needs a different model (price-to-book, asset-based); that is a product decision, not something to slip into the DCF.

## Verification

- Backend: **1,376 tests pass** (new: 7 growth, 5 v3 valuation scenarios + assumptions diff test, 5 PDF parser, 1 classifier), Ruff clean.
- Frontend: tsc clean, ESLint 0 errors, 197 tests, build OK.
- PDF tests build real PDFs with ruled tables (title and date above, decimal commas, total row, a table continuing on page 2, a blank/scanned page, a text-only PDF).
- **Not tested:** a real fund annual report. Real PDFs vary a lot; expect to try a few and tell me which fail.

## What is not in this sprint's code

| Item | Why |
|---|---|
| Newsweb fetch for Vår Energi and Salmon Evolution | Already built; it is a click on each holding page (**Fetch all reports**) |
| Tavily fallback | Already built; needs your free `TAVILY_API_KEY` and `RESEARCH_FALLBACK_PROVIDER=tavily` in `backend/.env` and Railway |
| Re-tagging the three Norwegian funds | Data change on the Holdings page, yours to do |
