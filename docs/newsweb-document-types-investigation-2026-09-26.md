# Newsweb document types & other capturable sources — investigation (2026-09-26)

Faiz asked to investigate what other relevant documents Aladdin could pull from news feeds — beyond
the annual reports Sprint 15 (F17) already fetches — for use as LLM evidence or deterministic data.

**Research-only doc — no code changed.** Categories below were confirmed live against
`api3.oslo.oslobors.no` (the same keyless API `newsweb_provider.py` already calls), not just docs.

## 1. What Oslo Børs Newsweb actually publishes (confirmed live, 2026-09-26)

Every announcement carries a `category` (Norwegian + English). Pulled live from the feed
(`api3.oslo.oslobors.no/v1/newsreader/list`):

| id | Category | What it is | Useful for Aladdin? |
|---|---|---|---|
| 1001 | ANNUAL FINANCIAL REPORT | Audited annual report | ✅ Already built (F17) |
| 1002 | HALF YEAR FINANCIAL REPORT | Interim/half-year & quarterly report + slides | ⭐ **Best next candidate** — same pipeline as F17, quarterly cadence (built later as F19) |
| 1005 | INSIDE INFORMATION | Contract wins, M&A, guidance changes, tax rulings — market-moving news | ⭐ High-value qualitative evidence |
| 1006 | FLAGGING (Major shareholdings notification) | Ownership crossing a threshold (5%, 10%, ...) | ⭐ Good tripwire signal (Sprint 11 thesis tracking) |
| 1007 | Issuer's own-share trades | Buyback program updates | Useful, lower priority |
| 1008 | Voting rights & capital changes | New shares issued, capital increases | Useful for share-count accuracy (feeds DCF/multiples) |
| 1010 | Additional regulated info (catch-all) | Board changes, financial calendar, IR presentations, bond issuances, AGM/EGM notices, M&A/tender offers | Mixed bag — noisy but has real signal (board/management changes especially) |
| 1101 | EX DATE | Dividend/rights ex-dates | Low priority, already inferable from other data |
| 1102 | MANAGERS' TRANSACTION | Insider trades (buy/sell by execs & board) | ⭐ High-value — "is management buying or selling" is classic Buffett/Munger evidence |
| 1103 | PROSPECTUS / ADMISSION DOCUMENT | New listings, bond prospectuses | Low priority for existing holdings |
| 1104 | NON-REGULATORY PRESS RELEASES | General company news | Same value as 1005 but lower materiality bar — noisier |
| 1105 | ADJUSTMENT OF INTEREST RATE | Mostly savings banks/bond issuers changing rates | Low priority (not relevant to equity holdings) |
| 1202 | TRADING HALTS | Suspension/resumption | Low priority, operational only |

## 2. Recommended priority order

1. **Extend the F17 importer to quarterly/interim reports (category 1002)** — biggest lift-to-value
   ratio. Same ingestion pipeline, same ESEF/iXBRL handling already built for annual reports, just a
   different category filter and a `HALVÅR`/quarter period label instead of `FY{year}`. Closes the
   gap between annual snapshots and what's actually driving the current thesis.
2. **Insider trades (1102) as structured evidence, not just a citable link** — parse the attachment
   (usually a short structured form: name, role, transaction type, shares, price) into a few
   deterministic fields (`buy`/`sell`, shares, price) so Thesis tracking can raise a tripwire on
   "primary insider sold >X% of their holding" without an LLM ever having to read and interpret the
   PDF.
3. **Major shareholder flagging (1006)** — same idea: parse "crossed above/below N%" into a
   deterministic ownership-concentration fact, feeding both the evidence packet and a future
   tripwire ("a fund just crossed 10%").
4. **Inside information (1005) + non-regulatory press releases (1104) as evidence-packet text** —
   these are the qualitative "what's actually happening at the company" signal Gemini's Google
   Search grounding partially covers today, but pulling them structurally (title + date + category,
   already partially done) means Aladdin doesn't depend on the LLM's web search finding the same
   thing.
5. Board/management changes and AGM/EGM notices, both currently buried inside the 1010 catch-all —
   worth a keyword filter (`board`, `styret`, `CEO`, `resignation`, `annual general meeting`) rather
   than a new category, since 1010 is too broad to import wholesale.

**Not recommended right now:** ex-dates (1101), prospectuses (1103), interest-rate adjustments
(1105), trading halts (1202) — low relevance to an existing equity holding's investment thesis, and
the bond/savings-bank issuers dominating some of these categories aren't Aladdin's typical holding
type.

## 3. Other document/news sources considered (not Newsweb)

| Source | What it adds | Verdict |
|---|---|---|
| **SEC EDGAR full-text search** (`efts.sec.gov`) | Searches the actual text of 10-Ks/10-Qs/8-Ks/proxies for US filers — lets an evidence citation point at a real filing passage instead of an LLM-summarized one | Already identified in the 2026-09-21 provider research, still not built — worth revisiting alongside the Newsweb work above since it's the same kind of "primary-source qualitative evidence" upgrade, just for the SEC side |
| **GDELT Project** | Free, keyless, global news index — sentiment/volume signal | Confirmed still free; broad and noisy — a supplementary signal at best, not a citation-grade primary source. Low priority, same conclusion as 2026-09-21 |
| **Norwegian general news (E24, DN, Finansavisen, etc.)** | Broader market commentary | No free structured API for any of these — would need scraping (fragile, likely against ToS) or a paid news aggregator. Not recommended |
| **Company IR pages directly** | Investor presentations sometimes posted before/alongside Newsweb | Newsweb is the single point of truth Oslo Børs issuers must use — scraping IR pages separately would mostly duplicate what 1010/1104 already surface, with less structure. Not recommended |

## 4. What this doesn't change

No code touched this session for this investigation. If Faiz wants to move forward, the natural next
step is **#1 above (quarterly reports via Newsweb)** — it reuses `NewswebFilingProvider`,
`import_all_annual_reports_from_newsweb()`'s pattern, and the existing ingestion pipeline almost
unchanged, just widening the category filter from 1001 to 1001+1002 and adjusting the period label.
(Done 2026-09-27 as F19. Items 2–5 remain in the backlog and are scheduled in Sprint 22.)
