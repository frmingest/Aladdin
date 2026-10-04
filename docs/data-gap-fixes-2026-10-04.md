# Data-gap fixes, one by one (2026-10-04)

> **Status update 2026-10-04 (housekeeping review):** the code described here is merged to `main` (checked in the repo at `07cf9fb`). The "not merged / PR open" wording below was true when written and is kept as history. Whether it is deployed or behaves correctly live was not checked in that review.

Faiz asked to go through the data gaps found 2026-10-03 and close them. Each item of the build order in
[pareto-gigante-and-fund-constituents-2026-10-04.md](pareto-gigante-and-fund-constituents-2026-10-04.md) §4 was checked
against the live app and the code first. **Branch `feature/data-gap-fixes-2026-10-04`, written and tested, not yet merged or deployed.**

## 1. Result per item

| # | Item | Result | What changed |
|---|---|---|---|
| 1 | Euro risk-free rate | **Closed, no code.** The series was never missing | `IRLTLT01EZM156N` was already mapped. The warm-up only fetches rates for holdings with no price, so a fund that already had a price never got its EUR rate stored. A Refresh fixed it. Live board 2026-10-04: XDEF and L&G Gold Mining rank, Mowi is valued |
| 2 | ESEF extractor + "no XBRL tags" message | **Built** | See §2 |
| 3 | Heimdal Utbytte N lines without ISINs | **Built** (partly: see §3) | Refresh look-through now links unlinked lines first, then prices ISIN-less lines through the linked holding's ticker. Migration `q1c8d9e0f1a2` |
| 4 | Wrong-fund fetch guard | **Built** | A fetch is refused (409, nothing stored) when the ISIN was already fetched for another holding, or the holding already has a list from a different ISIN |
| 5 | "Linked weight" readout per fund | **Built** | New tile "Linked to the app" on the fund page; the refresh note says how many lines were linked and priced |
| — | Pareto Bank CSV | **Waiting on Faiz** | I need the report file again (not in this session) |

## 2. Extractor (item 2)

All in `extraction/ixbrl.py`, additive. A filer that already extracts correctly is not changed: the new rules only run when the
standard concept is absent.

| Item | Rule | Label in the mapping |
|---|---|---|
| D&A (Aker BP `DepreciationExpense`, Subsea 7 cash-flow add-back) | Used only when no `DepreciationAndAmortisationExpense` line is tagged. Full D&A add-back first, depreciation alone after | `proxy:`, confidence 0.9 |
| Capex (Subsea 7, Orkla extension lines) | Name pattern `Purchase(s)Of…PropertyPlantAndEquipment / IntangibleAssets…ClassifiedAsInvestingActivities`, only when no standard capex concept is tagged. A combined line is taken as-is and never added to its own parts. Two different combined lines: not guessed | `derived:` when parts are summed |
| Operating cash flow (Subsea 7 `CashFlowsFromUsedInOperations`) | Used only when no `…OperatingActivities` total exists. Before tax and interest paid, so it overstates | `proxy:` |
| Newsweb fetch | An `.xhtml` with no XBRL tags (Pareto Bank) now imports with the warning "carries no XBRL tags … needs a statement CSV upload" instead of looking like a normal ESEF import | warning on the report |

Tests: 10 new extractor cases (one per rule, plus "standard wins" and "ambiguous is not guessed") and one Newsweb integration test.

## 3. Heimdal Utbytte N (item 3)

What the live page showed: lines are short company names ("Kongsberg Gruppen", "DNB Bank", "Aker BP"), none linked, although most of
those companies are now on the watchlist. **Cause:** auto-linking only runs when a list is imported (2026-09-25, before the
watchlist companies existed).

- Refresh look-through now re-links unlinked lines first (hand-set links are never touched).
- A line with no ISIN but a linked holding is looked up by that holding's ticker. A line with neither stays uncovered.
- **No ISIN is invented.** Companies not in the app (for example DNB Bank) stay uncovered until they are added to the watchlist,
  or a provider file with ISINs is imported.
- Not verified live: Yahoo is unreachable from the build sandbox, so the P/E lookup is covered by tests with a fake provider.

## 4. Verification

| Check | Result |
|---|---|
| Backend `pytest` | 1,458 pass |
| `ruff check` | clean |
| Frontend `tsc`, ESLint, vitest, build | clean, 0 errors, 229 tests, build OK |
| Migration `q1c8d9e0f1a2` | up, down, up on Postgres 16, one head |
| Live app (browser pane, 2026-10-04) | XDEF and ETLX ranked, Mowi valued, Heimdal lines unlinked (the finding in §3) |

## 5. After deploy (Faiz)

1. Merge the PR; Railway runs migration `q1c8d9e0f1a2`.
2. **Aker BP, Orkla, Subsea 7:** run *Fetch all reports* again (stored reports are not re-read automatically), then open Margin of safety and Refresh.
3. **Heimdal Utbytte N:** press *Refresh look-through*. The note says how many lines were linked and priced. Add the largest unlinked names to the watchlist to cover more.
4. Pareto Bank: re-attach the FY2025 report (PDF or `.xhtml`) in chat and I prepare the CSV.
