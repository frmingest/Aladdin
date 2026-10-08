# Own-year fact ownership (2026-10-08)

**Status: written and tested, not yet deployed.** PR: PRNUM.

## What Faiz saw

Opening the FY2021 annual reports of DNO (`dnoasa-2021-12-31.html`) and Salmon Evolution
(`…-2021-12-31-en.xhtml`) in the side-by-side reader showed **FY2020** figures (and FY2019 balance-sheet
openings), not FY2021. He suspected wrong financial years.

## Finding

Not a mislabel. The fiscal-year labels were right (DNO FY2020 net loss USD 286m matches the company's
reported result; Salmon FY2020 total assets NOK 892.8m versus ~1,706m at FY2021). The cause was **which
document owns which year**:

- A fact is stored once per (holding, metric, year) under "first source wins" (`ingestion._store_facts`).
- Reports were imported **newest-first** (Newsweb order), so each report's own year was already held by the
  *next* report's prior-year comparative column. The FY2021 report was left with FY2021 (1 figure), FY2020 (18)
  and FY2019 (2). Query result 2026-10-08, DNO: FY2025 report holds FY2025/24; FY2024 report holds FY2024 (1) /
  FY2023 (19) / FY2022 (2); the same shape for every older report. Salmon Evolution identical.
- Re-extraction (`refresh_document_facts`) runs **oldest-first**, so it gave the opposite ownership: what a
  document held depended on how it arrived.

Impact: analysis values were not wrong (DNO FY2020 checked against the reported result), but each year before the
newest was taken from the following report's comparative column (restated if the company restated), cited that
filing's page, and the reader of an older report showed mostly its prior year with no explanation. 70 reports
across 21 holdings carry "figures differ from an earlier source" notes (311 notes in total; Salmon Evolution FY2022/FY2021
files 20 and 17, Schibsted 13, Vår Energi 12, Aker BP 11, Telenor 11/10), the same mechanism.

## Rule now (independent of import order)

1. A filing's **own year** (the latest year its tags report, from `quality_flags.ixbrl.fiscal_years`) beats a
   later filing's comparative.
2. Between comparatives, the **nearest later** report wins (the earliest to show the year).
3. Files with no known own year (PDF, CSV, factsheet) keep first-source-wins and are never displaced.
4. A figure that replaces another is reported in `facts_differ_from_existing` ("replaces … this filing reports
   the year itself"); one kept out says "(kept)" as before.
5. The ESEF-index import already used own-year-first; unchanged.

The reader's figure table now labels columns older than the filing's own year "prior year".

## After deploy (Faiz)

Existing rows keep the old ownership until each company is re-extracted: **Tag review → Re-extract** for each
company with several annual reports (re-extraction rebuilds ownership with the new rule; no migration, no
schema change). Then reopen the DNO FY2021 report: expect FY2021 first, FY2020 marked "prior year".

## Tests

`backend/tests/unit/test_fact_ownership.py`: all 6 import orders give the same owners; the FY2021 report holds
FY2021; restated comparatives never replace the own-year figure (and are reported); nearest-later fills gaps;
untagged files are not displaced; refresh equals import and repairs the old state. `frontend/src/lib/statements.test.ts`
covers the "prior year" label. Against the old code 8 of these fail.
