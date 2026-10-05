# ESEF ingestion validated against the printed annual reports: Aker BP, Orkla, Salmon Evolution, Subsea 7 (2026-10-05)

> **Status 2026-10-05 (later):** H1, H2, H3 and the cash-flow tie (G3) are built on branch `feature/owner-basis-profit-walk` (written and tested, not merged, not deployed). G1 is done as continuing/discontinued facts plus continuing-profit basis; the full profit walk check, G4–G8, G10 and the smaller captures are the next PRs.

**Status:** read-only validation of the live app after PR #52 (`b056ec7`) was merged and deployed, documents wiped and *Fetch all reports* re-run. **No code or data changed.** Fixes below need Faiz's go.

**Questions asked:** (1) do we capture everything we agreed to from the `.xhtml` files? (2) is every ingested value correct against the annual report?

---

## 1. Answer in five lines

| | |
|---|---|
| **Raw figures** | **80 of 80 stored FY2025 figures match the printed statements** (Aker BP 22, Orkla 18, Salmon Evolution 21, Subsea 7 19). No transcription error found. |
| **Derived ratios** | Every ratio on the four screenshots recomputes exactly from the stored figures (FCF, owner earnings, net debt, coverage, ROCE, ROE, EV, P/E, P/B, P/S, FCF yield). The arithmetic is sound. |
| **What is wrong** | Not the numbers, but **what two of them mean** and **one number that is missing**. Three findings change a conclusion (§2 H1–H3). |
| **Capture** | 6 gaps against the agreed list (§4): Subsea 7 lease payments and cost of sales, Orkla pre-tax profit and total liabilities, share counts for Orkla and Salmon Evolution. |
| **PR #52 itself** | Delivered what it promised: Aker BP debt 8,665.8m USD, Orkla 16,742m NOK with the lease note, Salmon Evolution's file parses (1,879.8m NOK). All three confirmed live and on the printed balance sheets. |

---

## 2. Findings that change a conclusion (fix before trusting these companies)

### H1. Orkla: net income includes a 5,120m NOK profit from discontinued operations

The printed income statement (NOK m, 2025):

| Line | Value |
|---|---|
| Profit before tax (continuing) | 8,379 |
| Tax | (1,442) |
| **Profit from continuing operations** | **6,937** |
| **Profit from discontinued operations** | **5,120** |
| Profit for the year | 12,057 |
| Minority share | 584 |
| **Owners' share (stored as net income)** | **11,473** |

The app stores 11,473 and nothing separates the 5,120. FY2024 net income was 6,057, so the one-off doubles the line.

| Metric | Stored | Without the discontinued profit |
|---|---|---|
| Net margin | 16.1% | about 9.8% |
| Owner earnings | 10,932m | about **5,800–6,400m** (depends on the minority share and whether capex/leases include the sold business) |
| ROE | 22.2% | about 13% |
| DCF base growth | "28%/yr, capped 10%" | the 28% is mostly this one-off |

Operating cash flow (9,271) probably also includes the sold business until the sale date; that is not separable from the face of the statements.

### H2. Subsea 7: lease payments are not captured, so FCF and owner earnings are overstated by about a third

The printed cash-flow statement shows **lease principal (266.8m USD)** and **lease interest (25.1m USD)** in financing activities. Neither is stored (the metrics note for FCF reads "operating cash flow − capex − interest paid", with no lease line and no warning).

| Metric | Stored | With lease principal | Also lease interest |
|---|---|---|---|
| Free cash flow | 1,123.4m | 856.6m | 831.5m |
| Owner earnings | 809.6m | 542.8m | 517.7m |
| FCF yield | 11.5% | about 8.7% | about 8.5% |
| DCF base value / share | 69.64 USD | about 46.7 USD | about 44.5 USD |
| **Base margin of safety** | **52.6%** | **about 29%** | **about 26%** |

The last three rows are an approximation (the DCF scales with the owner-earnings base). The margin-of-safety figure is the one a decision would lean on, so this is the most urgent item. Aker BP, Orkla and Salmon Evolution all had their lease payments captured, so this is a tag-pattern gap in Subsea 7's filing, not a design gap.

### H3. Orkla: equity that includes minorities is treated as if it excluded them

Orkla's printed equity: owners 48,664 + minorities 3,483 = **52,147**. The extractor prefers `EquityAttributableToOwnersOfParent` (Subsea 7 has it), and **falls back to total `Equity` when that tag is absent** (Orkla). The metrics layer then assumes `total_equity` excludes minorities and adds them again.

| Metric | Stored | Corrected |
|---|---|---|
| Invested capital FY2025 | 70,328m (= 66,845 + 3,483 again) | 66,845m |
| ROCE | 10.0% | about 10.5% |
| ROE | 22.2% (owners' profit ÷ total equity) | 23.7% on owners' equity (and about 13% without H1) |

Root cause is a silent change of meaning when the extractor falls back to another concept.

---

## 3. Smaller findings

| # | Company | Finding | Effect |
|---|---|---|---|
| M1 | Aker BP | Interest coverage 67.6× uses P&L interest 70.4m (net of capitalised interest). Cash interest paid is 394.8m | About **12.1×** on cash interest; the stored figure is the flattering one |
| M2 | Aker BP | Impairment of **2,021.4m** is printed and not separated. The app's own note says "impairments not separated" | EBITDA 7,334m instead of 9,355m; net debt / EBITDA 0.86× instead of 0.68× (the stored value is the conservative direction) |
| M3 | Aker BP | ROIC 0.8% rests on a 97.1% effective tax rate (tax 4,474.8m on 4,607.1m). Cash tax paid was 3,061.3m | Arithmetic is right, meaning is distorted. At the 78% petroleum rate ROIC would be about 5.9% |
| M4 | Aker BP | Share count 631,330,056 is the **weighted average** (`WeightedAverageShares`), shown as "annual report (year-end)" | Label is wrong; the number is close |
| M5 | Orkla, Salmon Evolution | No share count in the tagged statements (stored: none) | DCF and market multiples unavailable until Yahoo or a manual count supplies one |
| M6 | Orkla | Pre-tax profit (printed 8,379) and total liabilities (printed 36,551) are not extracted | ROIC shows "missing: income_before_tax"; the balance-sheet identity cannot be checked |
| L1 | Aker BP | "Gross margin" 89.0% = revenue − production expenses (tagged `CostOfSales`). Excludes depreciation, exploration, impairment | Not comparable with a true gross margin; relabel for oil and gas |
| L2 | Subsea 7 | Gross margin "not available", but the income statement prints **gross profit 1,074.9m** and operating expenses 6,011.4m | Capture gap |
| L3 | Salmon Evolution | Operating margin −43.9% uses reported operating profit (includes +15.6m biomass fair-value gain). EBIT (−158.9m) excludes it. "Materials margin" ignores the +43.7m inventory change | Two margins on one page use two bases |
| L4 | Subsea 7 | Operating cash flow is stored as a "proxy" and the code comment says it is before tax. The printed 1,470.7m **is after tax** (taxes paid 198.6m are above it) and reconciles: 1,470.7 − 213.6 − 873.8 = 383.3 = change in cash | Value right, code comment wrong |
| L5 | Salmon Evolution | The stored filing text shows broken Norwegian characters ("Elnesvågen/Ålesund" reads "ElnesvÃ¥gen/Ã…lesund") | Numbers are unaffected; text evidence for the analysis is. Not checked whether the damage is in the stored copy only |
| L6 | Subsea 7, Salmon Evolution | "Interest expense" is total finance costs (87.3m, 32.6m) | Conservative, but mislabelled |
| L7 | Aker BP, Orkla, Salmon Evolution | Share price missing. *Delete all documents & data* removes price observations (by the code in `delete_holding_documents`), so prices need Refresh or the worker pass. Subsea 7 has one | Not an extraction error |
| L8 | Aker BP | "11 figures differ from an earlier source (earlier kept)" on the FY2021 file, "1 figure" on FY2024 | Not examined; which values differ and which source wins should be visible |

---

## 4. Capture check: the agreed list (27 canonical metrics) against the four filings

✓ captured · ⚠ captured, meaning needs care · ✗ printed in the filing, not captured · – does not apply to this company

| Metric | Aker BP | Orkla | Salmon Evolution | Subsea 7 |
|---|---|---|---|---|
| revenue | ✓ | ✓ | ✓ | ✓ |
| cost of goods sold | ⚠ production expenses | – by nature | – by nature | ✗ (gross profit printed) |
| operating income / EBIT | ✓ | ✓ | ✓ | ✓ |
| net income | ✓ | ⚠ **incl. discontinued (H1)** | ✓ | ✓ |
| depreciation & amortisation | ✓ proxy | ✓ | ✓ | ✓ proxy |
| total assets | ✓ | ✓ | ✓ | ✓ |
| total equity | ✓ | ⚠ **incl. minorities (H3)** | ✓ | ✓ owners' |
| total liabilities | ✓ | ✗ (36,551 printed) | ✓ | ✓ |
| operating cash flow | ✓ | ✓ | ✓ | ✓ proxy label (value right) |
| shares outstanding | ⚠ weighted average | ✗ | ✗ | ✗ (Yahoo supplies) |
| total debt | ✓ bonds | ⚠ incl. leases, by decision | ✓ | ✓ |
| cash | ✓ | ✓ | ✓ | ✓ |
| capex | ✓ | ✓ | ✓ | ✓ |
| interest expense | ✓ | ✓ | ✓ finance costs | ✓ finance costs |
| interest paid (financing) | ✓ | – inside operating | ✓ | ✓ (lease interest 25.1 ✗) |
| lease payments | ✓ | ✓ | ✓ | ✗ **266.8 printed (H2)** |
| decommissioning payments | ✓ | – | – | – |
| pre-tax profit | ✓ | ✗ (8,379 printed) | ✓ | ✓ |
| tax | ✓ | ✓ | ✓ | ✓ |
| lease liabilities | ✓ | ✗ bundled in debt | ✓ | ✓ |
| minority interests | – | ✓ | – | ✓ |
| basic EPS | ✓ | ✓ | ✓ | ✓ |
| raw materials | – | ✓ | ✓ | – |
| hybrid capital and distributions | – | – | – | – |

**Not on the agreed list, but needed to read these four correctly:** profit from continuing operations, profit from discontinued operations, impairment, gross profit, equity attributable to owners.

---

## 5. How each value was checked

- **Source of stored values:** each holding's *Show the N extracted figures* list in the live app (value, source tag, file, page).
- **Source of printed values:** the filing opened in the app's reader (income statement, balance sheet, cash flow, equity statement), read digit by digit.
- **Subtotal checks:** Aker BP bonds 8,358.6 + 307.2 = 8,665.8; Aker BP leases 712.7 + 359.4 = 1,072.1; Orkla debt 14,965 + 1,777 = 16,742; Subsea 7 borrowings 402.4 + 181.3 = 583.7 and leases 184.9 + 164.9 = 349.8; Salmon Evolution debt 1,545.2 + 334.6 = 1,879.8.
- **Read indirectly (not digit by digit):** Orkla basic EPS 11.51 (consistent with 11,473 ÷ 996.8m shares) and the last digit of Orkla operating cash flow (9,27x on screen, 9,271 stored); Aker BP interest paid 394.8 (confirmed through the financing subtotal −1,352.9).
- **FY2024 comparatives:** spot-checked on Orkla (assets 89,966, equity 51,372, minorities 3,328, debt 18,536) and Subsea 7 (owners' equity 4,250.4); they match. **FY2020–FY2023 were not tied out individually.**
- **Limits:** the sandbox cannot reach Newsweb or the live backend, and reading the app's API key was refused, so I worked through the app's own screens. I could not list the raw XBRL tag names for the missing items (Subsea 7 lease lines, Orkla pre-tax profit, share counts), so the fixes in §6 need the four files run through the extractor first.

---

## 6. Guardrails: how the app can earn trust, not just report numbers

Today's guards (tag provenance, confidence, liability reconciliation, five statement identities) caught nothing here because **every stored number was right**. The failures were of meaning and of omission, so the next layer has to check those.

| # | Guardrail | Would have caught |
|---|---|---|
| G1 | **Profit walk:** EBIT + finance items + associates = pre-tax; pre-tax − tax = continuing profit; + discontinued = profit for the year; − minorities = owners. Flag any non-zero discontinued line and base owner earnings on continuing profit. On Orkla every step reconciles exactly (7,086 + 2,181 + 110 − 864 + 21 − 155 = 8,379; 6,937 + 5,120 = 12,057; 12,057 − 584 = 11,473) | H1 |
| G2 | **Equity identity:** total equity = owners + minorities, both stored; ordinary equity always means owners. When the extractor falls back to total equity it subtracts minorities and records the derivation | H3 |
| G3 | **Cash-flow tie:** operating + investing + financing + currency effect = change in cash. Passes on Subsea 7 (confirms the proxy is after tax); would reject a pre-tax proxy elsewhere | L4 |
| G4 | **Completeness manifest per filing:** all canonical metrics listed as extracted, not applicable (with reason) or missing, with the nearest tagged lines for each missing one (today only debt, D&A, capex and cash get this). A "data coverage" chip per holding | H2, M5, M6, L2 |
| G5 | **Fail-visible ratios:** a ratio whose input is known to be missing is labelled incomplete, not computed silently. Rule: lease liabilities exist but lease payments missing → FCF and owner earnings carry an amber "may be overstated" | H2 |
| G6 | **One-off and distortion flags** on the affected ratio: discontinued operations above 10% of net income; associates above 20%; effective tax above 60% or below 0; cash interest more than 3× P&L interest; impairment above 10% of EBIT | H1, M1, M2, M3 |
| G7 | **Golden-file tests:** the 80 verified FY2025 values from this report become expected values (numbers only, no filing committed), run against local copies of the four files on every extractor change | regressions in all of the above |
| G8 | **Re-import diff:** after each *Fetch all reports*, list every figure whose value changed and which source won (the "earlier kept" notes become a visible list) | L8 |
| G9 | **Tie-out stamp (optional):** a per-company, per-year "checked against the printed statement by you on <date>" mark, set from the reader. Machine-extracted and human-checked values look different on the page | all |
| G10 | **Text sanity check** on stored filing text (broken-encoding detector), so evidence never carries damaged characters | L5 |

### Recommended order (each needs Faiz's go)

1. **Owner-basis PR:** G1, G2, G3 plus the Subsea 7 lease pattern and discontinued-profit facts. Fixes H1–H3.
2. **Visibility PR:** G4, G5, G6, G8. Makes the next gap show itself.
3. **Safety net:** G7 golden tests (needs the four files on the PC), G10.
4. **Smaller captures:** share counts from the notes, impairment, gross profit, Orkla pre-tax profit and total liabilities, relabel M4 and L1.
5. **Later:** G9.

### What I need to start

Copy the four FY2025 `.xhtml` files into a folder on the PC that Git excludes (for example `E:\Aladdin\.claude-wt\samples\`). I then list the real tag names for the missing items and write the fixes against them instead of guessing.

---

## 7. Related

[Debt and D&A extraction (PR #52)](ixbrl-debt-da-extraction-2026-10-05.md) · [tags in the three filings](tag-gaps-aker-orkla-subsea-2026-10-04.md) · [FY2025 uploads checked 2026-09-23](fy2025-uploads-external-validation-2026-09-23.md)
