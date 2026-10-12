# Frontend noise audit: end-user UX review (2026-10-06)

**Goal (Faiz):** look at the whole frontend as an end user with a UX designer's eye, and cut the text bombardment.
**Status:** audit, Wave 1 (PR #56, merged), Wave 2 (PR #57, merged `224dad6`) and Wave 3 built (see §8; PR open, not merged, not deployed, not seen in a browser).

**How this was measured:** the live app (`exciting-gratitude-production-71b5…`) in the built-in browser, real data, at a phone-width pane (486 px). Word counts are the visible text of each page (`innerText`: collapsed sections are not counted). I also read the frontend code in `E:\Aladdin\frontend` (about 10,400 words of prose in the page and component files). **Not reviewed:** desktop layout, Macro, Performance, Journal, Marketplace and store pages, and the Settings page. Treat their absence as "unknown", not "fine".

---

## 1. The numbers

| Page | Visible words | Page height (phone) | Verdict |
|---|---|---|---|
| **Fund holding page (Heimdal Utbytte N)** | **5,422** | 8,687 px | Worst page in the app: 19 sections, 37 buttons |
| **Fortress (game mode)** | **16,446** | 64,814 px | Not broken down; scene text and the Ledger tab are likely in it |
| System status | 587 | 4,086 px | Plumbing, fine to be dense, but it should not leak elsewhere |
| Dashboard | 552 | 3,830 px | Too long for a "glance" page |
| Watchlist | 388 | 2,476 px | OK |
| Portfolio risk | 384 | 1,917 px | OK |
| Analysis queue | 323 | 2,317 px | OK |
| Margin of safety | 51 on a first read taken before data loaded; the full page text is about 90 lines (not re-counted) | 1,269 px at first read | Strong top, noisy bottom (see §2.3) |
| Thesis | 149 | 1,361 px | Good: this is the benchmark for the rest |

---

## 2. Findings, worst first

### 2.1 Fund holding page: the biggest single waste
- **The look-through table repeats a 22-company dropdown in every row.** 45 holdings × 22 options is about 1,000 company names, all dumped in the page text, for rows that mostly say "— not linked —". This alone is probably the largest share of the 5,422 words (not counted separately).
- **Plumbing sits above the verdict.** The first screen is "Readiness": *Can't reach Ollama at localhost:11434 (ConnectError)*, *Offline — 'DESKTOP-U0MD9TM' last seen 27 h ago*, *Research cache needs refreshing*. The **verdict (Hold) is below the first screen**. A person who owns this fund wants the verdict first.
- **Boilerplate when there is nothing to say.** "How your notes were weighed" prints a paragraph although no notes were written ("No additional information was provided…").
- **Internal IDs shown to the reader.** Thesis lines end in "(EV-003)", "(EV-010, EV-011, EV-012)". Those are evidence IDs for the code, not for a person.
- **Duplicates.** "8 sources ▾" appears twice; the thesis and the top risks say the same two things twice (fee/returns, macro exposure).
- **19 sections on one scroll,** with a row of five anchor chips (Analysis, Fund facts, Documents, Journal, Sources) acting as tabs without being tabs.
- A fund shows "Financials sector research →" and a Newsweb reports accordion, which only make sense for a stock.

### 2.2 Dashboard: a glance page that is three pages long
- **Duplicate facts:** portfolio value is in the hero card *and* in the first "Executive summary" bullet; the top-4 cards repeat the first rows of the Positions table, which repeats verdict and moat already shown in the verdict and moat cards.
- **Neutral restatements** dressed as findings: 3 of 7 bullets are info-only ("Portfolio value…", "top 5 holdings are 87.8%", "50.3% trades in other currencies"). Only the warning and the check marks earn a bullet.
- **Four nav cards with a description each** (Portfolio risk, Performance, Precious metals, Rates). The sidebar already links to these; the descriptions are pure text weight.
- **Six rate tiles** (Norges Bank, CPI, 10-year, USD/NOK, Fed funds, US 10-year) on a portfolio page. These belong on Macro.
- **A number that looks wrong:** "Analysis coverage **100%**" next to "4 of 5 equities" (the 100% is value-weighted: 99.7%). Two ways to measure the same thing on one card makes a reader doubt both.
- Allocation has four tabs, the verdict/moat cards add two more breakdowns, then the table adds a third view of the same weights.

### 2.3 Margin of safety: great top, noisy bottom
- The tiles plus the single coloured bar ("29.3% of your 705,737 kr is priced at or below base value") are the best thing in the app: one answer, one picture.
- Below it, **11 of 15 watchlist rows are a sentence of model error text** ("DCF base value of 149.03 is 3.7x the share price of 40.26 — far outside what a sound model gives…", "fewer than two periods with complete owner-earnings inputs (net_income, depreciation_and_amortization, capital_expenditures)"). Field names in snake_case reach the reader.
- "Can't be ranked yet (3)" includes a raw note: *beta unavailable from yfinance, used default beta 1.0 from assumptions v3*.
- Rows that are ranked still show "Not analyzed" as a verdict chip, which reads as a failure on a good number (Orkla, Subsea 7).
- Stray "i" tooltip glyphs sit in the table header as bare letters.

### 2.4 Fortress (game mode)
- **Repeating text:** Night Watch says "83 new report(s) landed overnight: Subsea 7 S.A, Subsea 7 S.A, Subsea 7 S.A, Subsea 7 S.A and 79 more." One line of grouped counts would carry the same information.
- Eight cards stack under the scene (Night Watch, ravens, advisors, weather, temperament, vault, spread, "what the survey could not see"). The scene itself is the point; the cards compete with it.
- The button strip overflows on a phone ("Chroni…" is cut).
- In game mode the sidebar gains **7 more links** (Fortress, Marketplace, Siege Simulator, Chronicle, Council, Records, Circle) on top of 13.

### 2.5 Cross-cutting patterns (these cause most of the noise)
1. **Three layers of explanation on every page:** a subtitle, an "i" tooltip, and a footnote. Pick one place.
2. **One colour for everything that is not fine.** Amber dots mean "your Ollama is offline" and also "your portfolio is concentrated". Infrastructure warnings and investment warnings must never share a style or a place.
3. **No warning budget.** Every check that can speak does. A page should show at most 3 items, ranked, and a count for the rest.
4. **Developer vocabulary in the reader's text:** blind pass, reconciliation pass, look-through moat, owner earnings, EV-ids, snake_case field names, "assumptions v3".
5. **Navigation depth:** 13 sidebar items in 5 groups (22 with game mode); four of them (Precious metals, Analysis queue, Status, Settings) are not daily.
6. **Raw tickers as titles:** the browser tab for the Heimdal fund reads `0P0001RFXW.IR · Aladdin`.

---

## 3. Design principles for the rework

1. **One answer per screen.** Each page opens with one sentence and one number a person can act on.
2. **Three layers, always in this order:** *Glance* (a number and a verdict) → *Detail* (a table or chart, one click) → *Evidence* (sources, IDs, raw errors, collapsed by default).
3. **A warning budget:** at most 3 visible items per page, ranked by what costs money first; the rest behind "+N more".
4. **Plumbing lives on System status.** The portfolio pages show at most one small badge ("Worker offline") that links there.
5. **Say nothing when there is nothing to say.** Empty notes, empty states and "no change" lines are hidden or collapsed to a single muted line.
6. **One vocabulary.** Plain words in the UI; code terms stay in tooltips and the docs.
7. **A text budget as a guardrail.** A frontend test fails if a page's default view exceeds a word budget (for example 150 words above the first fold, 400 total), so the noise does not creep back.

---

## 4. Proposed fixes, in waves

### Wave 1: quick wins, low risk, one PR (frontend only, no backend change)
| # | Fix | Page | Effect |
|---|---|---|---|
| 1 | Replace per-row dropdowns with one "Link to company…" picker, opened only for unlinked rows | Fund page | Removes roughly 1,000 company names (about 45 × 22) from the page; likely a lighter page (not measured) |
| 2 | Move the verdict above Readiness; Readiness collapses to one line ("Ready · 4 notes") | Holding page | Verdict on the first screen |
| 3 | Hide "How your notes were weighed" when no notes exist | Holding page | −60 words, no information lost |
| 4 | Show evidence IDs as small numbered chips, not "(EV-003)" text | Analysis | Reads as prose again |
| 5 | Remove the 3 neutral bullets and the 4 nav-card blurbs; drop the Rates tiles to a one-line link | Dashboard | Estimated about a third shorter (not measured) |
| 6 | Group unrankable watchlist rows under one "Can't value yet (11)" with a short reason chip (Loss-making / Data missing / Check inputs); long reason on expand | Margin of safety | −10 paragraphs |
| 7 | Night Watch: group repeated names ("83 reports, mostly Subsea 7") | Fortress | One line instead of a stutter |
| 8 | Fix "100%" vs "4 of 5": one coverage measure, one label | Dashboard | Removes a contradiction |

### Wave 2: structure
- **Holding page as real tabs:** *Overview* (verdict, key numbers, one risk line) · *Analysis* · *Fund facts* / *Financials* · *Documents* · *Journal*. Only Overview loads at first.
- **A "Needs attention" feed on the Dashboard:** max 3 ranked items (tripwire fired, concentration above flag, analysis stale), replacing the Executive summary list.
- **A shared `<WarningStack>` component** that enforces the budget (principle 3) and separates infrastructure from investment severity.
- **A shared `<Disclosure>`** for the glance → detail → evidence pattern, so each page stops inventing its own accordion.

### Wave 3: navigation and guardrails
- Sidebar to **4 primary items** (Dashboard, Holdings, Margin of safety, Thesis) plus a grouped "More" (Research, Tracking, System). Game mode adds **one** entry ("Fortress") with a sub-tab strip instead of 7 links.
- Fortress: cards below the scene collapse into one "Reports" panel.
- Word-budget test per page (principle 7); a one-page glossary behind the tooltips.

---

## 5. What I would not change
- The Margin-of-safety tiles and bar, the Thesis page, and the Dashboard hero number are already close to the target.
- Game-mode art stays; only the text around it is trimmed.
- No numbers or model outputs are hidden: all removed text moves one click deeper, nothing is deleted (a rule for this project: unknown stays unknown).

---

## 6. Decisions (Faiz, 2026-10-06)
1. **Wave 1: yes.** Built as PR #56. Two differences from the plan above: evidence IDs are removed from the sentence text rather than shown as chips (the per-section sources list still has them), and the Night Watch fix touched the backend, so Wave 1 is not strictly frontend-only.
2. **Sidebar "More" group: no for now.** Precious metals stays visible. Revisit in Wave 3.
3. **Rates tiles off the Dashboard: yes** ("if you think it is good"). They stay on Macro; the Dashboard has a quick link.
4. **Wave 2: go** (Faiz, 2026-10-06: "loving the new approach … proceed with next phase"). Built, see §7.

---

## 7. Wave 2 built (branch `feature/ux-noise-wave2`, off `main` `662f3af`)

Frontend only, no backend change, no migration. tsc, ESLint (0 errors), 274 frontend tests (11 new), `vite build` pass. **Not seen in a browser** (the browser pane cannot reach a dev server started from the PC shell); the Dashboard and holding page need a first look after deploy.

| # | What | Where | Effect |
|---|---|---|---|
| 1 | **Holding page as five tabs:** Overview · Analysis · Financials (Fund facts for a fund) · Documents · Journal. The tab is kept in the URL (`?tab=analysis`) so it can be linked. **Only the active tab is mounted**, so the page loads what you are looking at | Holding page | 19 stacked sections become one at a time; Overview is the tower card (game mode), then status, verdict and readiness |
| 2 | **Analysis split in two views:** `summary` (verdict, readiness, a link on to the detail) on Overview; `detail` (moat, the narrative sections, your notes, run details) on Analysis, with Thesis tracking and Company research as collapsed sections under it | `AnalysisPanel` | Verdict first, the long reasoning one click away |
| 3 | **`<WarningStack>` and `lib/warnings.ts`:** at most 3 ranked warnings, "+N more" for the rest; plumbing is never ranked against investment warnings and shows as one muted line linking to System status. Rank: high before medium before low, then investment before data, then input order | Shared | The warning budget (principle 3), with 6 unit tests |
| 4 | **`<Disclosure>`** (glance → detail → evidence; the body is mounted only when open) and **`<TabBar>`** with arrow-key support | Shared (`ui.tsx`) | One accordion pattern instead of one per page |
| 5 | **Dashboard "Needs attention"** replaces three lists: the rule summary, the thesis-check card and the tripwire banner. Fired tripwires first, then changed theses, then the overview's own warning sentences; max 3 shown; passed checks behind "Show N passed checks". **Check now** stays in the card while a tripwire is firing | Dashboard | `lib/attention.ts`, 5 unit tests. Nothing recomputed in the browser: the warnings are the backend's |
| 6 | **Metric warnings** ("Check before relying on these figures") go through the warning budget; the extracted-figures table uses `Disclosure` | Financials tab | Long warning lists stop pushing the numbers down |
| 7 | **Readiness checks:** plumbing checks (server configuration, local LLM, quota) sort last, carry a small "system" tag and never get the amber dot | Overview | An offline Ollama no longer looks like an investment warning |
| 8 | Funds no longer show the "sector research" link or the Newsweb reports card (stock-only); the browser tab shows the name, not the raw ticker | Holding page | Findings 2.1 and 2.5 (6) |

**Decisions made while building (say if you want any reversed):**
- The red tripwire banner is gone; a fired tripwire is the first row of "Needs attention" (red), with Check now beside it. The banner and the card said the same thing.
- The Newsweb reports card stays **above** the tabs (one collapsed line, Oslo Børs only), because you asked on 2026-09-26 for it to be easy to find right after opening a position.
- **Not done:** the "key numbers" row on Overview (base value, margin of safety). It needs the valuation data on the Overview tab; left for Wave 3 or a follow-up. The Fund page's 19 sections are now tabs, but the **word count after the change was not measured** (no browser).

---

## 8. Wave 3 built (branch `feature/ux-noise-wave3`, off `main` `224dad6`)

Faiz, 2026-10-07: "start developing next stage of UX/UI according to plan." Frontend only, no backend, no migration. tsc, ESLint (0 errors), 291 frontend tests (17 new), `vite build` pass. **Not seen in a browser.**

| # | What | Where |
|---|---|---|
| 1 | **Sidebar: four primary items plus "More".** Dashboard, Holdings, Margin of safety, Thesis stay on screen. More holds Portfolio (Portfolio, Performance, Portfolio risk, Precious metals), Research (Watchlist, Analysis queue, Macro), Tracking (Journal), System (Settings, Glossary). It opens by itself when you are on a page inside it. Navigation is now data in `lib/nav.ts` | `Layout.tsx`, `lib/nav.ts` |
| 2 | **Game mode adds one sidebar entry**, the Fortress. Marketplace, Siege Simulator, Chronicle, Council, Records and Circle are a tab strip on every `/fortress` page (the store pages too) and stay in Ctrl+K search. The six room buttons on the Fortress page are removed; the verdict button and the market square stay | `FortressTabs.tsx`, `FortressPage.tsx` |
| 3 | **Fortress Reports panel:** advisors, weather, temperament and ravens are one tabbed panel under the scene; only the open one is mounted; the Ravens tab says how many are new. Night Watch, the study desk, vault, spread and the "could not see" notes are unchanged | `FortressReports.tsx` |
| 4 | **Key numbers row on a holding's Overview:** price, base value, margin of safety from the stored valuation (DCF, bank price-to-book or fund look-through base case). A withheld valuation shows "Withheld"; a missing one shows one muted line; a missing margin is "—", never zero | `KeyNumbers.tsx`, `lib/keyNumbers.ts` |
| 5 | **Glossary page** `/glossary`: the "i" tooltips' own strings, A to Z, searchable, each explanation once | `GlossaryPage.tsx`, `lib/glossary.ts` |
| 6 | **Word-budget tests** (principle 7): the default sidebar (30 words), the Fortress tab strip (12), the key numbers row (30) and the warning stack with twelve warnings (60) fail the test suite if they grow. `vitest` includes `.test.tsx` | `lib/wordBudget.ts`, `wordBudget.test.tsx` |

**Decisions made while building (say if you want any reversed):**
- Precious metals, which you asked on 2026-10-06 to keep visible until this wave, now sits under More with the rest. Watchlist and Analysis queue moved there too, as the audit proposed.
- The Fortress rooms moved out of the sidebar and the page buttons into one tab strip; they are still reachable from Ctrl+K.
- The key numbers row uses the stored valuation only; it does not refresh anything. The `unavailable_reasons` text is not shown there (it lives on the Financials tab).

**Not done / not measured:** the budgets cover the pieces that decide each default view, not whole pages (a page-level count needs a browser; none was available). The Fortress scene (16,446 words in the audit) and the Ledger tab were not broken down or trimmed. The fund page's word count after Wave 2 was not re-measured. The Overview key numbers are not shown for a holding whose valuation request fails (the row is simply absent).
