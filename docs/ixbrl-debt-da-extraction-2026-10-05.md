# Total debt and D&A from ESEF filings: audit of 11 real files and the robust extractor (2026-10-05)

**Status:** written and tested on branch `feature/ixbrl-debt-da-robust-extraction`, **not merged, not deployed**.
Faiz saw "Not available" on owner earnings, net debt, net debt / EBITDA, net debt / FCF, debt / equity, ROIC and ROCE
(missing: `depreciation_and_amortization`, `total_debt`) for many holdings and asked whether this can be extracted from the
annual-report `.xhtml` with high confidence. **Answer: yes.** The data is in the filings; the extractor read it only through a
short list of tag names.

## 1. What the 11 files showed

Run through the real extractor (`extraction/ixbrl.py`) before the change:

| Filing | Total debt | D&A | Cause |
|---|---|---|---|
| Subsea 7, Telenor, Mowi, Vår Energi | OK | OK (Subsea 7 as `proxy:`) | Standard `LongtermBorrowings` / `ShorttermBorrowings` lines |
| **Aker BP** | **missing** | `proxy:` (needs re-fetch) | Debt is tagged only as **bonds** (`NoncurrentPortionOfNoncurrentBondsIssued`, `CurrentBondsIssuedAndCurrentPortionOfNoncurrentBondsIssued`) |
| **Orkla** | **missing** | OK | Only `ORK:LongTermBorrowingsAndNonCurrentLeaseLiabilities` and `ORK:ShortTermBorrowingsAndCurrentLeaseLiabilities`: leases are inside the debt line |
| **SpareBank 1 Sør-Norge** (bank) | not applicable | OK | Funding is deposits, `DebtSecurities` and a `SubordinatedDebt` extension |
| **Salmon Evolution** | **0 facts imported** | | A `<=` in the file's embedded CSS makes it invalid XML; the HTML fallback then found no contexts and reported "no XBRL tags" although the file has 526 tagged numbers |
| Pareto Bank (2023, 2025) | | | Genuinely untagged (0 `ix:` elements). Needs the CSV route |

ESEF only requires the **primary statements** to be tagged (notes are text blocks), so debt has to come from the face of
the balance sheet. That face can be checked: on six corporate filings (Subsea 7, Telenor, Mowi, Vår Energi, Orkla, Aker BP) the
liability lines add up to the filing's own `NoncurrentLiabilities` and `CurrentLiabilities` within rounding.

## 2. What was built

| # | Change | Where |
|---|---|---|
| 1 | **Debt by structure, not a closed list.** Instant (balance-sheet) lines that are borrowings, bonds, debentures, commercial paper, loans received, convertibles are summed, current and non-current. Leases, derivatives, deposits, receivables, assets held, costs and cash flows are excluded. A tagged total (`Borrowings`) beats its parts. A lone `NoncurrentPortionOfNoncurrentBorrowings` is no longer taken alone (it was half the debt when a current line existed) | `ixbrl.py` `_resolve_total_debt` |
| 2 | **Reconciliation against the filing's own subtotals.** Lines printed above `NoncurrentLiabilities` / `CurrentLiabilities` (same context) must sum to them. Reconciled: 0.95. A concept outside the old list that cannot be reconciled: 0.85, with "could not be reconciled" in the source. A debt sum above total liabilities is rejected | `_liability_reconciliation` |
| 3 | **Orkla (decided by Faiz 2026-10-05):** a bundled borrowings-plus-leases line is stored as total debt, confidence 0.85, source and a note say "includes lease liabilities — this filing's balance sheet does not split them out". The note shows next to net debt, net debt / EBITDA, net debt / FCF and debt / equity. Used only when no pure borrowings line exists | `_DEBT_WITH_LEASES`, `holdings.py` |
| 4 | **Banks (Claude's recommendation, built):** a balance sheet with deposits from customers **and** loans to customers is flagged `reporting_bank`. No debt is extracted. The metrics endpoint and the analysis evidence packet mark net debt, debt / equity, ROIC, ROCE, owner earnings, EV / EBITDA, FCF yield and interest cover "not meaningful for a bank/insurer", **even when the holding has no sector set**. Sector still counts too (either signal is enough). ROE, P/E, P/B stay | `services/bank_detection.py` |
| 5 | **Self-diagnosing gaps.** When total debt, D&A, capex or cash is not extracted, the latest year stores the nearest tagged lines; the metrics page shows "No total debt extracted from X; closest tagged lines: …" | `_unmapped_candidates`, `holdings.py` warnings |
| 6 | **Parser repair.** Strict XML → repair (escape `<` / `&` inside CSS/JS, bare `&`) → lenient XML (namespaces kept) → HTML only if there are no inline-XBRL elements. Tags present but unreadable now flag `ixbrl_tags_unreadable`, not `no_ixbrl_tags` | `parse_ixbrl`, `_repair_xhtml` |

The ESEF-index history import stores the same notes, candidates and bank flag.

## 3. Result on the real files (re-run after the change)

| Filing | Total debt FY | Source |
|---|---|---|
| Aker BP | 8,665.8 USD m | bonds, current + non-current, 0.95 |
| Orkla | 16,742 NOK m | two bundled lines, 0.85, lease note |
| Salmon Evolution | 1,879.8 NOK m | now parses from the raw file |
| Subsea 7 / Telenor / Mowi / Vår Energi | unchanged | borrowings lines, 0.95 |
| SpareBank 1 Sør-Norge | none, by design | flagged bank |
| Pareto Bank (both files) | none | untagged: CSV |

## 4. Verification

- Backend: `ruff check .` clean; `pytest -q` 1,540 pass (19 new: 15 extractor, 4 end-to-end through the metrics API). The new extractor tests fail on the old code (checked: old code stored no debt for bonds or the bundled line, and 0 facts for the broken-CSS file).
- Test data is synthetic (the real tag structures with invented numbers); no real filing is committed.
- All 11 real files re-run through the new extractor (table above). Not run against the live database or app.

## 5. After deploy (Faiz)

Stored reports are not re-read automatically. Run *Fetch all reports* again for **Aker BP** (debt), **Orkla** (debt incl. leases), **Salmon Evolution** (the file now parses; re-upload the `.xhtml` if it came from an upload), **Subsea 7**, then open each holding's metrics. Banks need no re-fetch to be recognised once a filing is re-read.

## 6. Not covered

- Only 8 tagged companies were examined. Kongsberg, Bouvet, Equinor and the others may use other tags; the "closest tagged lines" warning will name them.
- Orkla's leases cannot be separated from the face of its balance sheet; the note says so.
- Aker BP's EBITDA stays derived by the app (EBIT + the depreciation proxy, impairments not added back).
- Game mode and the Ravens still decide "financial" from the sector only.
- Pareto Bank still needs the CSV route.
