# Can we fetch ESEF/XHTML annual reports for ETF/ETC holdings the way we do from Newsweb? (2026-09-27)

## 1. What Faiz asked

Investigate whether the app can find XHTML/ESEF-style annual reports for the ETF/ETC holdings,
captured the same automated way F17/F19 already pull Oslo Børs annual + half-year reports from
Newsweb.

**Research only — no code changed.**

## 2. Short answer

**No, and this isn't a gap in what we've built — it's a legal fact about these instruments.**
None of the portfolio's ETF/ETC holdings will ever have an ESEF-tagged XHTML annual report to fetch,
from Newsweb or anywhere else. The reason is the same for all of them, but for two different legal
reasons layered together:

1. **Newsweb itself doesn't apply.** Newsweb is Oslo Børs's own regulatory-announcement feed, for
   issuers listed on Oslo Børs. Every ETF/ETC actually held is listed on **Xetra (Deutsche Börse)**,
   not Oslo Børs — so Newsweb has no filings for them regardless of format.
2. **ESEF/iXBRL itself doesn't apply to these instruments**, wherever they're listed (see §4). Even
   a Xetra-equivalent "Newsweb" wouldn't produce an ESEF file, because the EU rule that forces
   ESEF tagging never reaches fund units or this kind of commodity certificate.

## 3. Current ETF/ETC holdings, checked one by one

Pulled live from `GET /portfolio/overview`:

| Holding | Ticker | Type | Domicile / issuer | Newsweb-eligible? |
|---|---|---|---|---|
| Xetra-Gold | `4GLD.DE` | Commodity ETC | Deutsche Börse Commodities GmbH (Germany) — a private company, not Oslo/Xetra-listed equity | No — not Oslo Børs, not an equity issuer |
| L&G Gold Mining ETF | `ETLX.DE` | Equity ETF | L&G UCITS ETF plc — Irish UCITS umbrella (confirmed against the 1,266-page annual report already on file, Sprint 8 §4) | No — Irish UCITS, not Oslo Børs |
| Xtrackers Europe Defence Technologies UCITS ETF 1C | `XDEF.DE` | Equity ETF | Xtrackers (DWS) — Irish/Luxembourg UCITS umbrella | No — UCITS, not Oslo Børs |

Two more holdings are tagged `equity_etf`/similar in the app but are **not exchange-traded funds at
all** — worth flagging separately since it affects how we source their documents too:

| Holding | "Ticker" | Actual type | Note |
|---|---|---|---|
| Heimdal Utbytte N | `0P0001RFXW.IR` | Norwegian open-ended mutual fund | `.IR` is a Morningstar/data-vendor fund identifier, not an exchange ticker — same instrument already flagged in the 2026-09-23 ticker decision doc as needing manual re-tagging to `equity_fund` |
| Heimdal Høyrente Pluss B / Alfred Berg Nordic High Yield II R | `0P0001XFYV.IR` / `0P0001VJ4B.IR` | Norwegian money-market / bond mutual funds | Same — Norwegian VFF-member funds, not Xetra-listed, no ESEF question at all |

So of the 8 holdings, only the first 3 are genuinely exchange-traded products where "why can't we
Newsweb them" is the live question; the other two fund names are domestic mutual funds sold directly
by the manager, sourced the way Sprint 8 already handles Heimdal's fact sheet.

## 4. Why ESEF/iXBRL doesn't reach any of them (the legal basis)

ESEF is not a general "all annual reports must be XHTML" rule — it's a specific mandate under the EU
**Transparency Directive (2004/109/EC)**, Article 4, that issuers with **shares or debt securities**
admitted to trading on an EU regulated market must file their annual financial report in a single
electronic format (iXBRL-tagged XHTML) from the 2020 financial year on. Article 1(2) of that same
directive carves out the entire category these holdings fall into:

> "This Directive shall not apply to units issued by collective investment undertakings other than
> the closed-end type, or to units acquired or disposed of in such collective investment
> undertakings."

An open-ended UCITS ETF (L&G Gold Mining, Xtrackers Defence Technologies) issues exactly those
units — so it was never in scope for ESEF in the first place, on any exchange, in any EU country.
This is confirmed by what Sprint 8 already found on file: L&G's real annual report is a 1,266-page
plain-PDF umbrella document covering 57 sub-funds, not an ESEF package — consistent with a UCITS
issuer that has no ESEF obligation to begin with.

Xetra-Gold is a different legal animal again: it's an **Exchange Traded Commodity (ETC)**, structured
as a bearer bond-like debt security backed 1:1 by physical gold, issued by **Deutsche Börse
Commodities GmbH**, a private German GmbH. It does publish a "management report" (`Jahresabschluss`)
each year — found on its own site (`xetra-gold.com/en/downloads`, e.g.
[the 2024 management report](https://www.xetra-gold.com/fileadmin/user_upload/xetra/Downloads_English/Reports/DBCo_Jahresabschluss_2024_EN.pdf))
— but that's a German commercial-register filing (`Bundesanzeiger`) for a private company, not a
Transparency Directive annual financial report, and has no ESEF requirement either. It's also
balance-sheet-thin by design: the issuer's whole business is passing gold-backed notes through, so
there's essentially no revenue/EPS/DCF-relevant content in it even if we did fetch it.

**Net effect: nothing in the fund/ETC world these holdings live in is exempt from ESEF by
accident or oversight — it's a structural, permanent exemption.** There is no equivalent of
`filings.xbrl.org`'s ESEF index for these instruments to eventually catch up to.

## 5. What actually exists for these holdings, and how it's already handled

Nothing here is new — Sprint 8 (2026-09-24) already built the right pipeline for exactly this
category of instrument, because a fund/ETC was never going to produce DCF-grade financial facts
either way:

| Source | Format | What it has | Already handled by |
|---|---|---|---|
| Provider fact sheet | PDF, 1–5 pp | Objective, holdings snapshot, costs, key risks | `fund_factsheet` document type, uploaded manually |
| PRIIPs KID | PDF (2–3 pp, semi-structured layout but not machine-tagged) | Cost figures, risk indicator, past performance | `fund_kid` document type |
| Provider annual/semi-annual report | PDF, often a large umbrella document (L&G: 1,266 pp / 57 sub-funds) | Full schedule of investments, manager commentary, audited NAV | `fund_report` document type; umbrella-report topic filter already narrows excerpts to the relevant sub-fund |
| Provider holdings/constituents file | CSV/XLSX, refreshed daily/monthly by the provider | Full current holdings + weights (the one genuinely structured, tabular source these products publish) | `holdings_import.py` (Sprint 8) — already the closest thing to a "deterministic feed" this asset class has |

All of these are already text-evidence-or-typed-in only, same as the Newsweb interim-report PDF path
— no financial facts get extracted from any of them, by the same CLAUDE.md Rule 1 / 2026-09-23
decision that keeps LLM figure-extraction out of PDFs generally.

## 6. Is there anything worth building here?

**No fetch automation is being proposed right now** — a genuine per-provider scraper (L&G's site,
Xtrackers/DWS's site, xetra-gold.com) would be far more fragile than Newsweb's stable public API
(different URL per provider, no announcement feed, likely to break silently), for a payoff that's
still just PDF text evidence, not new numbers. Not worth it unless Faiz specifically wants one
provider automated and is fine re-doing it if the provider's site changes.

One structural development is worth watching, not building against yet: the EU's **European Single
Access Point (ESAP)**, entering its implementation phase per [ESMA's 2027-2029 programming
document](https://www.esma.europa.eu/sites/default/files/2026-02/ESMA22-50751485-1625_-_2027-2029_Programming_Document.pdf),
will eventually centralize public disclosures (including some fund documents) behind one API from
around 2027 — but it's a collection point for existing filings, not a new XBRL-tagging mandate for
UCITS funds, so it wouldn't turn these into structured financial facts either. Worth a one-line
mention to Faiz now; not a backlog item until ESAP is actually live and its fund coverage is known.

## 7. Recommendation

- Don't build a Newsweb-equivalent for these holdings — there is nothing ESEF-shaped for it to find.
- The existing Sprint 8 fund pipeline (fact sheet / KID / report upload + holdings-file import) is
  already the right-shaped answer for this asset class, and needs manual upload/import to actually
  be used (per progress.md §2: "Set up your funds" is still open).
- Housekeeping while looking at this: re-tag Heimdal Utbytte N, Heimdal Høyrente Pluss B and Alfred
  Berg Nordic High Yield II R away from the (incorrect) `equity_etf` display and confirm the two bond
  /money-market funds are excluded from the fund look-through math the same way Sprint 8 excludes
  bond/money-market ETCs generally.

## 8. Status

Research-only, 2026-09-27. No code, no migration, nothing to commit.
