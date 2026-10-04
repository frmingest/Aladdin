# Pareto Bank's .xhtml, Gigante Salmon, and statements for fund constituents (2026-10-04)

Faiz asked three things after the database queries: (1) why Pareto Bank (`PARB.OL`) has no facts although its
`.xhtml` previews, (2) whether Gigante Salmon having only a PDF explains its gap, (3) whether there is any
pipeline to capture statements for the companies **inside** the funds. Read-only investigation; no code changed.
Faiz then asked Claude to **decide and recommend** the open choices: see §4.

---

## 1. Pareto Bank: the file is not ESEF, so nothing is wrong with the extractor

File checked: `ParetobankASA-2025-12-31-NO.xhtml` (2.86 MB), the one Faiz attached.

| Check | Result |
|---|---|
| `ix:` elements (inline XBRL tags) | **0** |
| XBRL contexts, units, `ix:header`, `ifrs` concepts | **none** |
| Page structure | 94 page blocks, each with an embedded base64 page image and positioned text lines: the pattern of a **PDF converted to HTML**, not a tagged ESEF report. `<title>` is "Untitled" |
| Text layer | Real Norwegian text; statements are in it (income statement around page 13, cash flow 16, balance sheet 76–77 of 94; amounts in NOK 1 000) |
| Noise | Every page repeats the report's contents list (about 1.3k characters), so the stored text pages carry a lot of repeated navigation |

**What the app does with it** (read from the code):
- `extract()` sends any `.xhtml` to the inline-XBRL extractor. With no XBRL contexts it treats the file as
  plain HTML: text pages are stored, **zero figures**, and the document gets the flag `no_ixbrl_tags`. The
  document card has a note for that flag (`DocumentFlagsNote`; I have not seen it live).
- That is exactly what Faiz sees: the reader **previews** the filing, but nothing is **captured**. It matches
  the query result (`PARB.OL`: 0 facts).
- So no mapping or extractor change would help. There are no tags to map.

**One real gap:** the Newsweb fetch picks an ESEF attachment **by file extension** (`.zip` first, then
`.xhtml`/`.htm`). A `.xhtml` with no tags is therefore accepted as "ESEF" and counted as imported, with the only
sign being the document flag. Candidate fix: after extraction, if the flag is `no_ixbrl_tags`, say so in the
fetch result ("report found, but it carries no XBRL tags: text only").

**Checked 2026-10-04:** Faiz looked at the Pareto Bank Newsweb message: it carries only a PDF and the untagged
`.xhtml`, **no `.zip`**. So there is no tagged package to fetch.

**Options for Pareto Bank (a bank, so the bank method would need net income, equity, assets):**

| Option | Cost | Note |
|---|---|---|
| A. Leave it as text evidence | none | The AI analysis can read the text; no figures, so no valuation |
| B. Upload the key statement lines as a **CSV** | I can prepare it from the text layer; Faiz uploads | The CSV statement route already exists. Figures come from the report, with page references |
| C. Build a table reader for untagged HTML/PDF | large | Conflicts with the rule that figures come from filer tags; the earlier LLM-from-PDF extraction was reverted by Faiz's decision |

## 2. Gigante Salmon: yes, a PDF-only filer explains it

Consistent with the zero facts. Two details from the code: the **annual** Newsweb fetch has no PDF fallback
(`allow_pdf_fallback=False`), so it reports "no ESEF file" for such a company; the half-year fetch does fall
back to a PDF as text evidence only. Figures can only come from a CSV statement upload (option B above) or by
hand. Query 3 would confirm what documents are on file, but nothing contradicts Faiz's observation.

## 3. Statements for the companies inside funds: no pipeline exists

| Layer | Exists? | What it does |
|---|---|---|
| Holdings list of a fund (name, ISIN, weight, currency) | **Yes** | Xtrackers JSON, LGIM CSV, PDF upload or typed; stored in `fund_exposures` |
| Link a fund line to a company the app already tracks | **Yes** | Auto-link by ticker, then by normalised name; manual link survives re-import |
| One number per constituent | **Yes** | Trailing P/E from Yahoo by ISIN (Refresh look-through); feeds the look-through screen |
| **Statements of the constituents** (income, balance sheet, cash flow, line items) | **No** | Nothing fetches or stores them. Fund lines are not holdings, so Newsweb, SEC EDGAR and the ESEF index (all keyed on a holding row) never run for them |
| Per-constituent valuation, moat, debt | **No** | Only the P/E screen, which credits no growth (stated on the card) |

**What it would take (not built):** a "promote to watchlist" step for the top N lines by weight (a fund line has
only name and ISIN, so it needs a ticker, and for the ESEF index an LEI), then the existing per-company fetches
would apply. Where those reach (my estimate, not tested):
- **Xtrackers Europe Defence:** mostly EU and UK issuers; the ESEF index and Newsweb-style sources could cover
  many, with the index lagging about a year.
- **L&G Gold Mining:** mostly Canada, Australia and South Africa; few are ESEF filers, so coverage would be
  thin (a US filer like Newmont is reachable through EDGAR).
- **Heimdal Utbytte N:** mainly Norwegian companies (Newsweb), but its lines have no ISINs yet.

## 4. Decisions (Claude's recommendation, requested by Faiz 2026-10-04; awaiting his go to build)

| Question | Decision | Why |
|---|---|---|
| **Pareto Bank figures** | **No `.zip` exists (checked). Prepare a CSV for FY2025 with the FY2024 comparatives** and upload it. Do not build a table reader | Two years from one report is enough for the bank method, which needs only net income, equity and assets. A one-off CSV with page references costs minutes; a reader for untagged files costs days and breaks the rule that figures come from filer tags |
| **Gigante Salmon figures** | **Leave as text evidence for now** | A small cyclical salmon farmer: the board could not rank it with an owner-earnings DCF anyway until a method for cyclical and loss-making companies is chosen, and Salmon Evolution and Mowi already cover the sector. Revisit if you decide to buy it |
| **"No XBRL tags" message in the Newsweb fetch** | **Yes, build it** (small), together with the extractor work | Stops an untagged file looking like a successful import; every watchlist company hits this path |
| **Fund constituents** | **Do not build "promote top N to the watchlist" now. Later add a small "linked weight" readout per fund** (what share of the fund's weight is linked to a company the app already values) | Promoting lines would add dozens of companies with the same line-item gaps the watchlist has today, and a full look at each duplicates the watchlist. The P/E screen is the right depth for a fund. The readout is honest, cheap and shows where a deeper look would matter |

**Recommended build order for the data gaps** (each item needs Faiz's go):

| # | Item | Size | Unblocks |
|---|---|---|---|
| 1 | Euro-area risk-free rate series | small | Xtrackers Defence, L&G (holdings now fixed), Mowi |
| 2 | Widen the extractor with the real tags (now listed, see [tag-gaps](tag-gaps-aker-orkla-subsea-2026-10-04.md)); include the "no XBRL tags" message | medium | The DCF for five watchlist companies |
| 3 | ISINs for Heimdal's 45 holdings | medium (needs a source) | Heimdal's look-through |
| 4 | Guard: refuse an Xtrackers fetch whose fund ISIN does not match the holding | small | Prevents a repeat of the L&G mix-up |
| 5 | "Linked weight" readout per fund | small | Shows where fund constituents need attention |

## 5. Next steps

| # | What | Status |
|---|---|---|
| 1 | Check the Pareto Bank Newsweb message for a `.zip` attachment | **Done 2026-10-04: none, only PDF and `.xhtml`** |
| 2 | Upload the latest `.xhtml` of Aker BP, Orkla and Subsea 7 so the real D&A and capex tags can be listed | **Done 2026-10-04; tags listed in [tag-gaps](tag-gaps-aker-orkla-subsea-2026-10-04.md)** |
| 3 | Say go on the build order in §4 (or reorder it), and on the Pareto CSV | Waiting for Faiz |
