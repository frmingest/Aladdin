# Financial-statement uploads: ESEF .xhtml + CSV/Excel (2026-09-23)

**Status:** on GitHub (`2e49de7`); deploy not verified. 486 backend tests (63 new), tsc/eslint/build clean.

---

## 1. What changed

| Area | Change |
|---|---|
| Accepted files | `.pdf .pptx .xlsx` **+ `.csv .xhtml .html .htm`** |
| `.xhtml` / `.htm` | New inline-XBRL parser (ESEF annual reports, SEC 10-K/20-F) |
| `.csv` + `.xlsx` | New shared statement-table parser for IR "factsheet" downloads |
| Duplicates | A 2nd document never overwrites a metric/year already on file; differences > 0.5 % are reported |
| Size limit | iXBRL files: 80 MB (`MAX_IXBRL_UPLOAD_SIZE_MB`); others stay 25 MB |
| Bug fix | `GET /documents` could 500 for any document with detail flags (e.g. after an SEC EDGAR import) — `quality_flags` is now `dict[str, Any]` |
| UI | New file types, a hint under the upload row, and a note per document for skipped/conflicting figures |

---

## 2. Tested on Faiz's real files

| File | Facts imported | Notes |
|---|---|---|
| Vår Energi ESEF 2025 `.xhtml` (36 MB, 209 pages) | **26** — FY2025 + FY2024 (+ FY2023 opening equity/cash) | 296 tagged numbers, 0 unreadable, parsed in < 1 s. Revenue = "Total income" (RevenueAndOperatingIncome). total_debt derived = long + short-term borrowings |
| Vår Energi Q1-26 factsheet `.csv` | 10 (FY2025 only) | Quarter/YTD columns kept as text only. Loaded after the .xhtml: all 10 matched within rounding → nothing overwritten |
| Orkla Q4-25 + Q2-26 accounting figures `.csv` | 8 (FY2024 + FY2025) | Segment tables ignored; net income = attributable to owners of the parent |

---

## 3. How reliable is each format?

| Format | Reliability for numbers | Why |
|---|---|---|
| **ESEF `.xhtml`** | ⭐⭐⭐ High | Every statement number is tagged with concept, period, unit, scale and sign — nothing is guessed from layout |
| **IR CSV / Excel** | ⭐⭐ Medium | No standard layout. Works when labels match the label table and a unit line ("NOK million") exists; otherwise rows stay text-only |
| PDF | ⭐ (text only) | Page text only — no figure extraction (an LLM-based PDF extractor was built and reverted 2026-09-23 by decision) |

### Known gaps (by design or not yet built)

| Gap | Effect | Mitigation |
|---|---|---|
| ESEF notes are only *block-tagged* | Note tables (segments, debt maturity, reserves) come in as text, not figures | Text is still in the evidence packet |
| One annual report = 2 years | Readiness wants ≥ 3 years | Upload 2 reports, or add the factsheet/CSV |
| Shares outstanding rarely tagged on the face | No per-share valuation from ESEF alone | yfinance / manual |
| Label table is exact-match | Unusual CSV labels aren't imported | Add labels to `financial_metrics.py` as seen |
| One-offs aren't separated | e.g. Orkla FY2025 profit includes a 5.1 bn discontinued-ops gain | The analysis must read the text; a future "adjusted" metric |
| Quarterly figures not stored as facts | No TTM / quarterly trend | Deliberate: keeps the annual history clean |
| ESEF `.zip` packages and `.xls` not accepted | Unzip / re-save as .xlsx first | Small follow-up if needed |

---

## 4. Where to get ESEF files

Oslo Børs issuers publish the annual report `.xhtml` (often inside a `.zip`) on their IR page and on Newsweb; many are also on **filings.xbrl.org**. A future step could fetch them automatically like the SEC EDGAR import.
