# Aker BP, Orkla, Subsea 7: the real tags behind the missing line items (2026-10-04)

**Status:** read-only finding. No code changed. Source: the three FY2025 `.xhtml` files Faiz uploaded
(Aker BP `549300NFTY73920OYK69`, Subsea 7 `222100AIF0CBCY80AH62`, Orkla). All three are properly
tagged (570 / 604 / 392 numeric facts), so the "not tagged" explanation is ruled out for them.
The cause is a **concept the extractor does not look for**. Checked against the lists in
`extraction/ixbrl.py` and `providers/sec_edgar_provider.py`.

## 1. What each company tags, and what the extractor expects

| Company | Item | Tag in the filing (FY2025 / FY2024) | In the extractor's list? |
|---|---|---|---|
| **Aker BP** | D&A | `ifrs-full:DepreciationExpense` (USD 2,574.0m / 2,397.8m), also `AdjustmentsForDepreciationExpense` | **No.** The list has `DepreciationAndAmortisationExpense` only |
| Aker BP | Capex | `PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities` (6,855.6 / 4,773.7) + `PurchaseOfExplorationAndEvaluationAssets` (319.8 / 338.7) | Yes, both |
| Aker BP | Net income | `ifrs-full:ProfitLoss` (132.3 / 1,827.7) | Yes |
| **Subsea 7** | D&A | `ifrs-full:AdjustmentsForDepreciationAndAmortisationExpense` (679.2 / 622.5, cash-flow add-back); no income-statement D&A line | **No** |
| Subsea 7 | Capex | `subsea7sa:PurchasesOfPropertyPlantAndEquipmentAndIntangibleAssetsClassifiedAsInvestingActivities` (281.0 / 348.7), a **company extension** | **No** |
| Subsea 7 | Operating cash flow | `ifrs-full:CashFlowsFromUsedInOperations` (+ `...BeforeChangesInWorkingCapital`); no `...OperatingActivities` total | **No** |
| Subsea 7 | Net income | `ProfitLossAttributableToOwnersOfParent` (411.4 / 201.4) | Yes |
| **Orkla** | D&A | `ifrs-full:DepreciationAndAmortisationExpense` | Yes |
| Orkla | Capex | `ORK:PurchaseOfPropertyPlantAndEquipmentAndPurchaseOfIntangibleAssetsClassifiedAsInvestingActivities`, a **company extension** (one combined line) | **No** |
| Orkla | Net income | `ProfitLossAttributableToOwnersOfParent` | Yes |

All three match what query 2 showed on stored data (Aker BP: D&A missing; Orkla: capex missing;
Subsea 7: D&A, capex and operating cash flow missing). The cause is now confirmed, not inferred.

## 2. What to change (step 2 of the build order)

Small and additive, in the concept lists only (versioned mapping, nothing recomputed from text):

1. **D&A:** add `ifrs-full:DepreciationExpense` (Aker BP) and the cash-flow add-backs
   `AdjustmentsForDepreciationAndAmortisationExpense` / `AdjustmentsForDepreciationExpense` (Subsea 7)
   as fallbacks *after* the income-statement concept. Where only depreciation is tagged and amortisation
   is separate, say so in the source label.
2. **Capex:** extensions with a **name pattern** the way the owner's-view lines already do:
   `^Purchases?Of(PropertyPlantAndEquipment|Intangible)\w*ClassifiedAsInvestingActivities$`
   (covers Subsea 7 and Orkla). Take the combined line as-is; never add a combined line to its own parts.
3. **Operating cash flow:** accept `CashFlowsFromUsedInOperations` when the `...OperatingActivities`
   total is absent, labelled as a proxy (it is before tax and interest paid, so it overstates).
   Alternative: sum it with tax paid and interest, but that is derived work for little gain.
4. **"No XBRL tags" message** in the Newsweb fetch (as decided).
5. Tests: one fixture per company built from these three filings (concept name + value only).

Still to check after this: total debt (Aker BP, Bouvet) and Kongsberg/Bouvet D&A, which need their
own filings (not uploaded). Watch the Orkla discontinued-operations split (`ProfitLossFromContinuing...`
vs `ProfitLoss...`) so net income and capex are on the same basis.

## 3. Expected result

| Company | After the change |
|---|---|
| Aker BP | Net income, D&A, capex all present for FY2024 and FY2025 (earlier years: re-upload or re-fetch). FY2025 profit is small (132.3 vs 1,827.7), so the DCF will be sensitive; the plausibility guard may still withhold it |
| Orkla | Capex present; the DCF can run |
| Subsea 7 | D&A and capex present; operating cash flow as a labelled proxy |

Reports already stored are not re-read automatically; after the change a re-import (or "Fetch all
reports") re-extracts them.

## 4. Pareto Bank

Faiz checked Newsweb: only a PDF and the `.xhtml`, **no `.zip`**. The `.xhtml` is untagged, so the
decision stands: a CSV for FY2025 with FY2024 comparatives, uploaded through the existing statement-CSV
route. Needs Faiz's go before I prepare it.

## 5. Database note (L&G fix) — resolved

The first run of SQL 6b had `begin;` and no `commit;`, so the Supabase editor discarded it. It was re-run as
one statement with `returning` counts (see [db-contents](db-contents-and-look-through-2026-10-03.md) §4) and
is now done: 44 holdings rows and 44 stored P/Es deleted, L&G re-fetched.
