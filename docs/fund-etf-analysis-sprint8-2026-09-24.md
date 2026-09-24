# Sprint 8: Buffett/Munger analysis for funds and ETFs (F9)

**Date:** 2026-09-24 · **Commit:** `8847311` (committed locally, **not pushed, not deployed**) · **Migration:** `f8a9b0c1d2e3` (additive)

---

## 1. Why

A fund has no income statement, balance sheet or cash flow of its own. Until now an equity ETF went
through the single-company engine, where it could never get financials or a DCF, and a mutual fund
(e.g. Heimdal Utbytte A) had no instrument type at all. The only documents for a fund are a fact
sheet, a KID, the (often umbrella) annual report and the manager's monthly letter.

**Can Buffett/Munger be applied to a fund? Yes, but the thing being judged changes.** A fund is a
basket of businesses run by a steward who charges a yearly fee. The analysis asks:

| Question | What answers it |
|---|---|
| 1. Are the businesses underneath any good? | Look-through: holdings + weights, linked to the app's own companies and their figures/analyses |
| 2. What does the steward cost, and is it worth it? | Ongoing charge and its compounding drag; excess return (active) or tracking difference (index) vs the benchmark |
| 3. How is the basket built? | Concentration, sector/country/currency split, overlap with stocks owned directly |
| 4. Does it belong in this portfolio? | Role (core, income, hedge, sector bet), circle of competence, cheaper alternative |

What does **not** carry over: a DCF / intrinsic value / price target for the fund itself.

---

## 2. Decisions (asked 2026-09-24)

| # | Question | Decision |
|---|---|---|
| 23 | How do fund figures get into the app? | **Typed in on a "Fund facts" form, each row citing an uploaded document (+ page), plus a deterministic import of the provider's holdings file (CSV/XLSX).** No LLM reads a figure out of a PDF — the same line as the 2026-09-23 revert. PDFs stay text: cited excerpts only. |
| 23b | How deep is the first look-through? | **Weights + linked stocks:** concentration, splits, overlap, and weighted ROE / operating margin / net debt-EBITDA only for holdings linked to companies that have figures in the app, always with coverage %. |

---

## 3. What was built

### Data (migration `f8a9b0c1d2e3`, 3 new tables, nothing existing touched)

| Table | Holds | Notes |
|---|---|---|
| `fund_profiles` | Style (active/index), benchmark, ongoing charge %, performance fee, domicile, base currency, replication, distribution, size, inception, risk class 1-7, holdings count, stated objective, umbrella-report filter | One per fund, edited in place |
| `fund_return_periods` | Fund % and benchmark % per period (calendar year, 12 months, trailing n years, since inception), years, "already annualised" flag | Replaced as one table from the UI |
| `fund_exposures` | Rows of dimension holding / sector / country / currency with weight %, ticker, ISIN, link to the app's own holding, as-of date | Latest as-of snapshot per dimension is used; older dates kept |

Every row has `source_document_id` **NOT NULL** → a document uploaded to that same fund. Deleting the
document deletes the rows that cite it. Deleting a linked company keeps the fund's row but removes
the link.

### Instrument and document types

| Change | Detail |
|---|---|
| New instrument type `equity_fund` ("Equity fund") | Classifier catches "fund / fond / indeks / index" in the name; **Heimdal Utbytte A has no marker and must be re-tagged by hand** on the Holdings page |
| Fund path | `equity_etf` + `equity_fund` → fund analysis; `stock` → company analysis; bond / money-market / commodity ETC still excluded |
| New document types | `fund_factsheet`, `fund_kid`, `fund_report`, `fund_commentary`, `fund_holdings`. Fund documents never become financial facts |

### Deterministic metrics (`app/services/funds/metrics.py`, CLAUDE.md Rule 1)

| Metric | Formula / rule |
|---|---|
| Fee drag | 1 − (1 − fee)^n for 10 and 20 years, plus yearly fee in NOK on the position held |
| Excess return / tracking difference | fund − benchmark per period; cumulative multi-year periods annualised as (1+r)^(1/years) − 1; beat count and average over one-year periods; longest comparable period per year |
| Concentration | holdings known, coverage %, top 10, largest, HHI (a **lower bound** on a partial list); effective number of holdings only when the list covers ≥ 95 % |
| Splits | sector / country / currency as given; share outside NOK |
| Look-through quality | weighted latest ROE, operating margin, net debt/EBITDA over linked holdings with figures, each with coverage %; moat and verdict mix of linked holdings already analysed |
| Overlap | for linked holdings also owned directly: NOK held through the fund (fund value × weight) next to the direct position |

Checked against the fund's own figure: Heimdal +117.1 % since 5 Dec 2022 (3.74 years) → **23.03 % a
year** (fact sheet: 23.0 %). Fee drag over 20 years: Heimdal 1.25 % → **22.24 %**, L&G 0.55 % → **10.44 %**.

### Holdings file import (`app/services/funds/holdings_import.py`)

- CSV or XLSX; header row found in the first 40 rows by a name column + a weight column (EN + NO names)
- Decimal commas, `%` signs, fractions (0.0485 → 4.85 %), title rows, "Total" rows, blank trailing rows
- As-of date read from the rows above the table (`31/08/2026`, `2026-08-31`, `31. august 2026`), or entered
- Negative weights (derivatives, FX forwards) skipped and reported; weights > 101 % refused
- Sector / country / currency splits derived from the same rows when those columns exist
- Holdings auto-linked to the app's companies by ticker root (`EQNR` = `EQNR.OL`), then normalised name (`Equinor ASA` = `Equinor`); a hand-set link survives a re-import

### Analysis path

| Piece | Fund version |
|---|---|
| Evidence packet | `fund-v1`: identity, profile, stated objective (quoted), cost, track record + summary, concentration, top 15 holdings with link/analysis, splits, currency, look-through, overlap, macro + sector research, document excerpts. **No company research** (saves a Gemini call) and **no DCF** |
| Excerpts | Fund topics (mandate, costs & tracking, risks, manager's view, underlying companies), fund disclaimers skipped, and the **umbrella-report filter**: only passages mentioning e.g. "Gold Mining" are used |
| Schema | `fund_v1`: look-through moat (Wide/Narrow/None + **coverage caveat**), steward & costs, portfolio construction, macro stress test, valuation, role in portfolio, verdict. Reconciliation reuses v1's shape |
| Prompts | `blind_fund_v1.md`, `reconciliation_fund_v1.md` (Buffett's index-fund yardstick; manager text = marketing claims; state coverage; no fund-level intrinsic value) |
| Run | Same pipeline, fallback, notes, queue and local worker; `price_target_*` stays empty |
| Readiness | Fund profile (blocks if missing), track record, holdings; no ticker / price / financials / FRED checks |

v1 schema, v2 prompts and the v4 company packet are unchanged.

### UI

- **Fund facts** section on the holding page (replaces Deterministic metrics; Valuation and company research hidden for funds):
  summary tiles, "Not computed yet" gaps, Profile & cost form, Track record table/editor, holdings import + type-in + linking table, sector/country/currency split editor (paste `Name; 5,1` lines), overlap card
- Documents panel offers the fund document types for a fund
- Analysis view for a fund: look-through moat with coverage caveat, steward & costs, construction, macro, valuation, role in portfolio; "Price target: not applicable to a fund"

---

## 4. Tried on the three uploaded documents

| Document | Result |
|---|---|
| Heimdal Utbytte A, August 2026 (4 pp) | Extracted in 0.1 s; excerpts: mandate/fund facts, the manager's sector contributions, the top-10 page |
| L&G Gold Mining fact sheet (5 pp) | Excerpts: index description, key risks; the MAS/Singapore disclaimer is now filtered |
| L&G UCITS ETF plc annual report (1,266 pp, 57 sub-funds) | Extracted in 3.6 s. With the filter "Gold Mining", 35 of 3,537 passages qualify but almost all are number tables, so **it adds little text**. Its real value is the full schedule of investments (p. 268: all 44 holdings with weights) — see §6 |

---

## 5. Verification

| Check | Result |
|---|---|
| Backend tests | **649** (30 new: holdings parser 14, metrics 7, API + fund run 8, instrument types 1); the 2 known `test_factory` failures remain (local `.env` selects Ollama) |
| Frontend | tsc, eslint, vite build clean |
| Migration | `f8a9b0c1d2e3` upgrade → downgrade → upgrade on Postgres 16 |
| End to end | Local backend + Postgres + Vite: Heimdal entered from its fact sheet, fund run with a fake LLM, page screenshotted (fund facts, editors, analysis view) |
| Live | ❌ Not run against Supabase/Railway or a real LLM |

---

## 6. Not done / next

| Item | Why |
|---|---|
| Parse the **schedule of investments** in a fund's annual report PDF | Deterministic table parser needed (decision 23 rules out an LLM); would give the full holdings list for funds without a CSV download |
| Look-through **valuation** (weighted P/E, earnings yield) | Needs a price per linked holding; not fetched in the fund path yet |
| Fund NAV history (VFF) | Would compute returns instead of typing them |
| Auto-linking holdings not in the app | Only companies already added as holdings can be linked |
| Heimdal needs a manual type change | Its name carries no fund marker |

---

## 7. How to use it (after push + deploy)

1. Holdings page → set Heimdal Utbytte A to **Equity fund** (L&G Gold Mining is already **Equity ETF**).
2. Holding page → Documents → upload the fact sheet / monthly report as **Fact sheet** or **Monthly report**.
3. Fund facts → **Add profile** (style, benchmark, ongoing charge…, "read from" the document and page).
4. **Add returns** (fund and benchmark per period).
5. **Import** the provider's holdings CSV/Excel, or **Type in holdings** (top 10 from the fact sheet). Link the largest holdings to companies you already analyse.
6. Readiness → **Run analysis** / **Run on my PC**.
