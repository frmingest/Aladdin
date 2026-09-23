# Upload validation (Vår Energi FY2025) + document/holding deletes (2026-09-23)

Faiz asked two things: (1) check that the figures on the **Deterministic metrics** panel match the
uploaded Vår Energi ESEF `.xhtml` exactly, so the upload path can be trusted; (2) make it possible
to delete uploaded documents and their data. Until now nothing could remove them, so a real clean
slate was impossible.

Commit: `be4b7e7` (local, **not pushed**, **not deployed**).

---

## 1. Validation result

An independent parser (plain `lxml`, not the app's code) read all **296 tagged numbers** in
`VarEnergiASA-2025-12-31-en.xhtml`. The app's extractor read every number correctly: scale 10⁶,
`sign="-"`, dash-as-zero, dimensional equity rows skipped, no conflicts. **Every figure on the panel
was the correct arithmetic on the facts it picked.** The problem was **which** facts it picked.

All figures are in **USD** (Vår reports in USD, trades in NOK). The old panel didn't show a
currency.

| Metric | Shown before | Problem | Now |
|---|---|---|---|
| Gross margin | 84.0% | Revenue included other income (130.0m); used "Total income" 8,095.6m | **83.7%** (revenue 7,965.7m) |
| Operating margin | 51.7% | Same revenue issue | **52.5%** |
| Net margin | 10.5% | Net income included the hybrid-capital coupon (846.4m) | **9.9%** (785.2m, to ordinary shareholders, matches EPS 0.31) |
| Free cash flow | 2,150.5m | Capex was PP&E only; left out exploration capex (363.1m) | **1,787.4m** |
| Owner earnings | 1,099.9m | Both issues above | **675.6m** |
| Net debt | 5,242.0m | Correct (bonds + RCF − cash; leases excluded by convention) | 5,242.0m |
| Net debt / FCF | 2.44 | Follows FCF | **2.93×** |
| Debt / equity | 10.61 | Arithmetic is right, but equity 560.0m **includes 799.5m hybrid capital**. Ordinary shareholders' equity is **−239.5m** | 10.61× **+ warning** |
| Net debt / EBITDA | n/a | EBIT/EBITDA never mapped | **0.83×** (EBITDA 6,344.2m = EBIT 4,184.7 + D&A 2,710.1 − impairment reversal 550.6) |
| Interest coverage | n/a | Only net finance items (−310.0m) are tagged; no interest-expense tag | **11.4×** (EBIT / cash interest paid 368.6m, labelled *proxy*) |

**Integrity checks** (new, all passed for FY2024 and FY2025): assets = equity + liabilities, assets =
E&L, current + non-current splits, profit = pre-tax − tax.

---

## 2. What changed

### 2a. Extraction (`ixbrl.py`)

| Rule | Detail |
|---|---|
| Net income | Prefers `ProfitLossAttributableToOrdinaryEquityHoldersOfParentEntity` over `ProfitLoss` |
| Revenue | `RevenueFromSaleOfPetroleumAndPetrochemicalProducts` before the `RevenueAndOperatingIncome` fallback |
| Capex | PP&E + E&E + intangibles purchases, summed and marked *derived*. A single combined tag is used as-is. |
| EBIT | `ProfitLossFromOperatingActivities` (a mapping, not a computation) |
| EBITDA | Derived in code: EBIT + D&A + impairment (loss added back, reversal removed). Never read from a company's own "EBITDA" extension tag. |
| Interest expense | Last resort: cash interest paid, confidence 0.9, labelled `proxy:` |
| Integrity checks | 5 statement identities per year; a failure sets the `integrity_check_failed` flag |
| Hybrid capital | Detected in equity (`ifrs-full:OtherEquityInterest`, or an extension tag containing Hybrid/Perpetual, same balance-sheet context). Flagged, **not** reclassified. |
| Provenance | Each mapped fact's source tag is saved in `quality_flags.ixbrl.fact_sources` |

### 2b. Metrics (`metrics.py`, `GET /holdings/{id}/metrics`)

| Change | Detail |
|---|---|
| Mixed currencies | If one period's facts come in more than one currency, **nothing is computed** and a warning is shown |
| EBIT / EBITDA fallback | For non-iXBRL sources, EBIT = operating income and EBITDA = EBIT + D&A. Each fallback is noted next to the ratio. |
| Response | New fields: `currency`, `notes`, `warnings`, `fact_details` (file, page, tag and confidence per input) |
| Frontend | Amounts shown as `USD 1,787.4m`, ratios as `2.93×`, a warnings box, notes under each ratio, and an expandable "extracted figures" source table |

### 2c. Deletes (all require `confirm=true`)

| Endpoint | Deletes | Refused when |
|---|---|---|
| `DELETE /documents/{id}` | Document, facts, pages, chunks and the stored file | A portfolio snapshot was imported from it |
| `DELETE /holdings/{id}/documents` | Everything for the holding: documents, files, facts (incl. EDGAR), analysis runs, notes, prices, company research. **The holding itself is kept.** | Same as above |
| `DELETE /holdings/{id}?cascade=true` | The above **plus** the holding | The holding is still in a portfolio snapshot |
| `DELETE /holdings/all` | Every holding and every document | Portfolio snapshots still exist. Run `DELETE /portfolio/all` first. |

- **Never deleted:** `llm_usage_events` (unlinked only, since it's spend history), FX/risk-free-rate
  reference data, and sector/macro research.
- **Stored files** are removed **after** the DB commit. If storage refuses a delete, the file is
  listed in `storage_files_failed`. It is never dropped silently.
- **UI:**
  - Each document row has a **Delete** button, plus **Delete all documents & data** on the holding page.
  - **Delete holding** now cascades.
  - The Portfolio page has a new **Clean slate — delete everything** panel. It requires typing `DELETE EVERYTHING`.

---

## 3. What Faiz needs to do

| # | Action |
|---|---|
| 1 | Push `main` and redeploy |
| 2 | On Vår Energi: **Delete** the existing `.xhtml` document, then **re-upload** it. The old facts were extracted with the old rules, and the duplicate check blocks a plain re-upload. |
| 3 | Check the panel shows the "Now" column above |

---

## 4. Open questions / known limits

| Item | Note |
|---|---|
| Hybrid capital | Kept in `total_equity` as reported, with a warning. Option: add an "ordinary equity" fact and base D/E on it. |
| IFRS cash-flow classification | Vår puts interest paid (368.6m) and lease payments (125.6m) in financing, so FCF is **before** them. A US-GAAP-comparable FCF would be about 1,293m. Not changed; needs a decision. |
| Owner earnings | Uses total capex as maintenance capex (conservative), and working-capital change is 0 |
| First-source-wins | An earlier, weaker source (e.g. a PDF) still blocks a later iXBRL value for the same year. Workaround: delete the weaker document now that deletes exist. |
| Tests | 502 of 504 backend tests pass (18 new). The 2 `test_factory` failures are pre-existing and only happen locally, because `backend/.env` sets `LLM_PROVIDER=ollama`. tsc, eslint and vite build are clean. |
