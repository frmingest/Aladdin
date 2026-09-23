# FY2025 upload figures vs. published reports: Vår Energi + Salmon Evolution (2026-09-23)

Faiz asked whether the figures the app shows after uploading an ESEF annual report (`.xhtml`) match
what the companies actually published. This goes one step further than the
[earlier validation](upload-validation-var-energi-and-deletes-2026-09-23.md), which checked the app
only against the file itself.

**Method**

- Ran the app's own extractor and metrics code (`ixbrl.py`, `metrics.py`, repo `5e6c3eb`) on both
  uploaded files. These produce the **Deterministic metrics** panel.
- Compared the output with each company's own published report:
  - Vår Energi: [Q4/FY2025 interim report](https://mb.cision.com/Public/21086/4305025/bd1a0561bff4ea5b.pdf)
  - Salmon Evolution: [Annual report 2025](https://storage.mfn.se/899895ea-e824-48d2-96d4-541bad97d6df/salme-2025-annual-report.pdf) and [SeafoodSource, 25 Feb 2026](https://www.seafoodsource.com/news/business-finance/salmon-evolution-posts-losses-in-fy-2025-but-company-entering-scale-up-phase)
- Not checked: the live screen. The panel shows whatever facts are stored, so these results only
  apply if the file was re-uploaded after `be4b7e7` was deployed.

Legend: ✅ matches · ≈ differs only by a stated definition · ❌ app figure is misleading

---

## 1. Verdict

| Company | Raw figures | Derived figures | Verdict |
|---|---|---|---|
| **Vår Energi** (USD) | ✅ All 15 inputs match the report | ❌ FCF (and owner earnings) are too high by the decommissioning spend | **Mostly trustworthy.** One mapping fix needed. |
| **Salmon Evolution** (NOK) | ✅ All inputs match the report | ❌ EBITDA includes the biomass fair-value gain. ❌ Ratios with a negative denominator are shown as numbers. | **Raw data is fine. 3 of the ratios shouldn't be read at face value.** |

No figure was misread, mis-scaled or given the wrong sign. The problems are all about **definitions**:
which items the app includes when it builds a derived metric.

---

## 2. Vår Energi ASA: FY2025, USD million

| Metric | App shows | Company reports | Status | Note |
|---|---:|---:|:---:|---|
| Revenue (petroleum) | 7,965.7 | 7,965.6 | ✅ | Rounding |
| Operating profit (EBIT) | 4,184.7 | 4,184.7 | ✅ | |
| Net profit to ordinary shareholders | 785.2 | 785.2 | ✅ | EPS 0.31 ✅ |
| D&A / impairment reversal | 2,710.1 / 550.6 | 2,710.1 / 550.6 | ✅ | |
| Cash flow from operations | 4,607.1 | 4,607 | ✅ | |
| Capex (PP&E + exploration) | 2,819.7 | 2,456.6 + 363.1 | ✅ | |
| Cash / total assets / equity | 699.9 / 26,145.3 / 560.0 | same | ✅ | Hybrid 799.5 flagged ✅ |
| Borrowings | 5,941.9 | 5,941.9 | ✅ | |
| EBITDA | 6,344.2 | EBITDAX 6,590 | ≈ | EBITDAX also adds back exploration expense (245.4): 6,344.2 + 245.4 = 6,589.6 |
| Net debt | 5,242.0 | NIBD 5,258 | ≈ | Company adds accrued interest (~16) |
| Net debt / EBITDA | 0.83× | 0.8× (NIBD/EBITDAX) | ≈ | |
| **Free cash flow** | **1,787.4** | **1,671** | ❌ | App leaves out **decommissioning payments (116.4)**. Same gap in FY2024: 533.4 vs 467 (66.8). |
| Owner earnings | 675.6 | — | ❌ | Same gap → **559.2** once decommissioning is included |
| Net debt / FCF | 2.93× | — | ❌ | **3.14×** on the company's FCF |

**Why it matters.** Taking down old oil and gas fields is a real, recurring cash cost for an E&P, and
it grows as fields age. Vår tags it in its own taxonomy extension
(`VAR:PaymentsForRemovalAndDecommissioningOfOilAndGasFieldsClassifiedAsInvestingActivities`), so the
extractor can find it.

---

## 3. Salmon Evolution ASA: FY2025, NOK million

| Metric | App shows | Company reports | Status | Note |
|---|---:|---:|:---:|---|
| Total operating revenue | 326.0 | 326.0 | ✅ | Farming sales 325.2 (the figure quoted in the press) |
| EBIT (after fair value) | −143.3 | −143.3 | ✅ | |
| Net loss | −171.6 | −171.6 | ✅ | EPS −0.37 |
| Cash | 163.4 | 163.4 | ✅ | |
| Equity / total assets | 2,062.7 / 4,215.6 | same (equity ratio 49%) | ✅ | |
| Cash flow from operations / capex | −59.1 / 1,264.4 | same (investing CF −1,252.4) | ✅ | |
| **EBITDA** | **−63.1** | **Operational EBITDA −78.7** | ❌ | App includes the **+15.6 biomass fair-value gain**. The industry excludes it because it's non-cash. FY2024: 60.9 vs 71.4. |
| Operational EBIT | not shown | −158.9 | — | The standard measure for salmon farmers |
| Net debt | 1,716.4 | NIBD 1,757.4 | ≈ | Company includes leases (41.1). The app excludes them by convention. |
| **Net debt / EBITDA** | **−27.2×** | — | ❌ | Negative EBITDA makes this **not meaningful**. It should say "n/m". |
| **Interest coverage** | **−4.4×** | — | ❌ | Negative EBIT makes this not meaningful. The interest figure is also understated: P&L finance costs are 32.6, but **36 was capitalised** into the Phase 2 build and **92.1 was paid in cash**. |
| Net debt / FCF | −1.30× | — | ❌ | Negative FCF, so not meaningful |
| Owner earnings | −1,355.8 | — | ⚠️ | Counts all 1.26bn of Phase 2 **growth** capex as maintenance. The number is correct arithmetic but says little about the steady-state business. |

---

## 4. Checked through a Buffett/Munger lens

The question here is whether the panel would mislead an owner. It is not an investment view.

| Principle | Vår Energi | Salmon Evolution |
|---|---|---|
| **Owner earnings are real cash** | ❌ Missing decommissioning makes cash look ~116m/yr better than it is | ⚠️ Growth capex treated as maintenance, so the business looks worse than steady state |
| **Measure what the industry measures** | ≈ EBITDA vs EBITDAX is explained | ❌ Fair-value biomass gains inflate EBITDA |
| **Inversion: where could the numbers fool me?** | Hybrid capital hides negative ordinary equity (already flagged ✅) | Negative-denominator ratios look like numbers. Capitalised interest hides the real interest burden. |
| **Result** | **PASS with one fix** | **FAIL for ratios until fixed.** Raw figures PASS. |

---

## 5. Recommended fixes

> **Update 2026-09-23:** Faiz approved fixes 1–3 plus a wider owner's-view definition (hybrid capital as debt; FCF also net of interest, leases and hybrid coupons). They were built in `34beec7`, see [owner-view-metrics-and-local-worker-plan-2026-09-23.md](owner-view-metrics-and-local-worker-plan-2026-09-23.md). Fixes 4 and 5 remain open.

| # | Fix | Where | Effect |
|---|---|---|---|
| 1 | Subtract decommissioning/abandonment payments from FCF. IFRS has no standard tag for this, so match an extension concept containing `Decommissioning` in investing activities, and mark the result *derived*. | `ixbrl.py` + `metrics.py` | Vår FCF 1,787 → 1,671, matching the company |
| 2 | Take biological-asset fair-value adjustments (`ifrs-full:GainsLossesOnFairValueAdjustmentBiologicalAssets`) out of EBITDA, the same way impairments are handled now | `ixbrl.py` | Salmon EBITDA −63.1 → −78.7, matching the company |
| 3 | Show **"n/m"** plus the reason when a ratio's denominator is ≤ 0 (EBITDA, EBIT, FCF, equity) | `metrics.py` + panel | No more −27.2× |
| 4 | Interest coverage: use the **larger** of P&L finance cost and cash interest paid, and note capitalised interest | `ixbrl.py` / `metrics.py` | More honest coverage during a build-out |
| 5 | Optional: show EBITDAX for E&P companies, operational EBIT for salmon farmers, and net debt incl. leases as a second line | Panel | Figures line up with the company's own reports |

Fix 3 is a pure presentation fix. Fixes 1, 2 and 4 change what the analysis engine is given, so a
real analysis run would see different numbers. Do them **before** the first real run.
