# Game-mode noise audit: end-user UX review (2026-10-07)

**Goal (Faiz, 2026-10-07):** apply the approach of the [2026-10-06 frontend noise audit](ux-noise-audit-2026-10-06.md) to the game-mode pages and views.
**Status:** audit, then Waves G1, G2 and G3 built the same day (branch `feature/ux-noise-game-mode`, PR open, **not merged, not deployed, not seen in a browser**; see §7). Faiz left the decisions in §5 to Claude.

**How this was measured:** the live app (`exciting-gratitude-production-71b5…`) in the built-in browser, game mode on, real data, at a 486 px pane (phone width). Word counts are the visible text of `<main>` (`innerText`: collapsed or unmounted sections are not counted; SVG text is not counted separately, about 50 words on the Fortress). Section heights are rendered pixels. I also read the page code names in `frontend/src/pages` and `components/fortress`.
**Important baseline:** the live Fortress already shows the Wave 3 changes (single sidebar entry, tab strip, tabbed Reports panel), so this audit is a **second pass on top of Wave 3**, not a measurement of the old page.
**Not reviewed:** desktop layout, the Ledger tab, a holding page's tower card in game mode, the Hype Booth and Sal dialogs, the Genie wishes, the Reports tabs other than Advisors, the Circle's marking controls, and a store with a fired tripwire or a valuation. Treat absence as "unknown", not "fine". Sound, motion and the painted scene are not text and were not judged.

---

## 1. The numbers

| Page | Visible words | Page height (phone) | Verdict |
|---|---|---|---|
| **Store (Marketplace → one company)** | **1,339** | 6,753 px | Worst game page: 9 sections, two of 400+ words; section chips are links, not tabs |
| **Marketplace street** | **767** | 7,849 px | 24 stores at about 290 px and 25 words each; 16 of 24 say "No price to compare" |
| **Fortress (scene page)** | **675** | 3,453 px | Already light after Wave 3; the remaining noise is repetition (§2.1) |
| Siege Simulator | 462 | 2,332 px | Six of seven towers say the same thing; footer says it again |
| Chronicle | 439 | 2,072 px | Two frames; the towers table repeats the Ledger |
| Circle of Competence | 345 | 2,304 px | Not read in detail |
| Council Chamber | 194 | 1,269 px | Good: short, one list |
| Hall of Records | 141 | 1,269 px | Good |

For comparison, the 10-06 audit measured the Fortress at 16,446 words and 64,814 px. That figure is not comparable with 675: it was measured before Wave 3 and, from the size, probably included the SVG scene and an unmounted-state difference I cannot confirm. **Do not claim a 96% cut from these two numbers.**

Fortress, by block (phone): Night Watch 96 words / 348 px · scene frame with the realm strip and verdict button 95 / 1,083 px · **legend 161 / 340 px** · Reports panel 106 / 428 px · study desk 14 / 76 px · Vault 67 / 498 px · "what the survey could not see" 39 / 206 px · footer 26.

---

## 2. Findings, worst first

### 2.1 Fortress: the same fact is said up to six times
- **"No cash entered" appears six times** on one page: the resource bar ("Cash not entered"), the vault "?" badge, the vault card ("No cash entered yet…"), "0 of 5 accounts have a cash figure", the Oracle's advisor line ("I cannot judge your powder: no cash has been entered…") and the "could not see" list ("No cash entered on any account; the vault is unsurveyed"). One state, one place. (Sources: `lib/fortress.ts:347`, `VaultCard.tsx:67`, `advisor_lines_v1.py:134`, `services/game/state.py:469`.)
- **The legend is the largest block of text on the page** (161 words, 14 lines) and is permanently open. The scene's own signs are meant to be learned once. It belongs behind a "Legend" disclosure, opened by default only until it has been seen once, or at least collapsed.
- **Night Watch says "quiet" three ways:** the title "Quiet night", "A quiet night: nothing is firing.", and "0 tripwire(s) on 0 holding(s), 0 newly fired, 0 cleared". Plus "One fortress frame is stored; changes show from the second one" and "The watch walked the walls 0 hours ago". When nothing happened, the card should be one line.
- **Plumbing leaks into the page:** "Updated 2 h ago", "The lamp is lit: the portfolio snapshot is from today", the clock, "Rules version v1", "Lines v1", "Written for Aladdin in the spirit of…" disclaimer. The disclaimer is right to exist (G7b rule), but it can be one line under the advisor card, not a paragraph with version numbers.
- **The realm is listed twice:** the resource bar (value, vault, towers, weather, temperament) and "THE REALM 7 holdings" both sit above the scene, and the Spread card repeats positions / top holdings.
- **Possible contradiction to check:** Night Watch says "**213** new reports landed overnight" while the Ravens tab says "**576 new**". They may measure different things (reports vs ravens, a 36 h window vs 45 days), but two numbers with no label is the same trap as "100% vs 4 of 5" on the Dashboard. I did not trace this in code.
- **Raw tickers as names:** the Reports and Chronicle use truncated names and raw codes (`0P0001R`, `0P0001V`, "Heimdal Utbyt…", "Salmon …"). A fund's code is not a name.

### 2.2 Store page: a decision page that reads like a report
- **1,339 words, 6,753 px.** The two big blocks are **the gates (248 words, 1,468 px)** and **the moat tour (404 words, 1,432 px)**; "the case" adds 212 words.
- **The decision is not alone at the top.** The first block is the verdict plus where the store stands (119 words, 661 px). The merchant intro is 49 words, 418 px, before it. On a phone the person scrolls past a merchant to reach the answer. The 10-06 principle was "one answer per screen".
- **Section chips look like tabs but are anchor links** (Decision, Gates, Price board, Moat tour, Numbers, The case, Tripwires, Your price): the same pattern flagged on the fund page in the 10-06 audit, which Wave 2 fixed with real tabs.
- **Empty and unknown states are loud:** "No valuation is on the board. DCF unavailable: fewer than…", "No tripwires are set yet. Set them on the thesis page so a change you care about rings a bell.", "6 open · 0 ajar · 0 closed · 2 unknown".
- **Two lines of boilerplate at the bottom** ("Where to go next…", "Rules market-v1. Shown only from stored data… Nothing on this page trades, scores or rewards anything").
- **The moat tour probably repeats the analysis page** (stored moat text, laid out source by source). I did not compare it with the holding page's Analysis tab line by line.
- **The model name leaks:** "Written by qwen3:8b from…".

### 2.3 Marketplace street: 24 cards that look alike
- **24 stores at about 290 px each = 7,170 px**, 25 words per card, of which most are labels ("Price", "Your price", "Versus yours") and five round marks.
- **16 of 24 say "No price to compare"**, so for most of the street the "price range" idea does not apply. These could be one collapsed group ("16 stores have no price of yours yet"), the way Wave 1 grouped the unrankable watchlist rows.
- **Stray symbols:** a bare "?" and "? ? ? ?" in cards for companies without analysis, and "Not analyzed" as a verdict chip next to a price: the same reading-as-failure problem the 10-06 audit found on Margin of safety.
- **Sal's booth takes 336 px (47 words) at the top** of every visit, before the first store, although adding a stock is occasional. A single button would do.

### 2.4 Siege Simulator: the same row six times
- **Six of seven rows say "no stored beta, so it is not modelled" + "?" + "Not modelled"**, then the footer repeats the six tickers ("Not modelled (no stored beta or no value): VAR.OL, 4GLD.DE…"), and a fourth time in the verdict ("only 0.2% of the portfolio value has a stored beta; at least 50.0% is needed…").
- **The headline is four dashes:** Modelled book "—", What-if loss "—", Weighted beta "—", Coverage "0%". When the answer is "cannot judge", four empty tiles add nothing.
- **Raw fund codes as titles** (`0P0001RFXW.IR`) and a full fund name that wraps to three lines.
- **A real design fact worth fixing at the source:** the page is useless until betas are stored, and the fix is on another page ("Open the holding or the Watchlist once so its beta is stored"). A button on this page, or an automatic worker pass, would be better than text.

### 2.5 Chronicle, Council, Records, Circle
- **Chronicle:** the "Towers in this frame" table (8 rows with five columns, repeating the wall/moat/thesis wording already in the Fortress Ledger) is a large part of the 404-word block (not counted separately). "What changed on this day" is the real content (7 lines). The table could be one disclosure ("Towers in this frame (8)"). The two-frame state needs one line, not the opening paragraph plus a closing "What the record cannot show" section.
- **Council (194 words) and Records (141 words)** are close to the target already: one list, one lead sentence. Use them as the benchmark for the game pages, as the Thesis page was for the main app.
- **Circle (345 words, 2,115 px in one block):** not read in detail; likely the sector marking table. Flag for the next pass.

### 2.6 Cross-cutting patterns (game-mode versions)
1. **A disclaimer on every page.** "Nothing on this page trades, scores or rewards anything" and a rules version appear in the footer of the Fortress, Chronicle, Siege and store pages (seen); Council and Records not checked. Say it once (the Fortress footer or a Glossary entry), link to it, and keep the guardrail wording tests.
2. **Unknown state is repeated instead of summarised.** Same as the Siege and cash cases: one "what we could not see" place, with counts, linked from the page.
3. **Fiction text next to facts.** The merchant, Sal, the Oracle/Partner introductions and "Rub me!" are the product's charm; they should stay, but they do not need to come before the answer on a page the person opens to decide.
4. **Developer vocabulary again:** "Rules market-v1", "Lines v1", "siege-v1", "scenarios v1", "qwen3:8b", "snapshot", "frame", "stored beta". Plain words in the page, codes behind a disclosure or on System status.
5. **No word budget on any game page.** Wave 3 added budgets for the sidebar, the tab strip and the key numbers row, not for these pages.

---

## 3. What I would not change
- The scene, the art, sound, motion, the lamp and Genie, and the Council and Records pages.
- Nothing is hidden: as in the 10-06 audit, removed text moves one click deeper, nothing is deleted. Unknown stays unknown.
- The game rules (read-only, no points, no buy/sell wording; the tests that enforce them) are untouched. The advisor disclaimer is kept, just shortened.

---

## 4. Proposed fixes, in order

### Wave G1: quick wins, frontend only, no backend change
| # | Fix | Page | Effect |
|---|---|---|---|
| 1 | Collapse the legend into one "Legend" disclosure (closed by default) | Fortress | about 160 words and 340 px off the first screens |
| 2 | **One cash message:** keep the vault card; the resource bar says "Vault ?" with a link; drop the "0 of 5" line when nothing is entered; the "could not see" list and the Oracle line say it only once between them | Fortress | six mentions become two |
| 3 | Night Watch quiet state becomes one line ("Quiet night · 1 frame stored · 213 new reports"); details behind "Details" | Fortress | about 70 words off |
| 4 | Siege: group "Not modelled" rows into one muted line with the tickers once; replace four dash tiles with the "Cannot judge yet" sentence and one action | Siege | about 150 words off |
| 5 | Marketplace: group stores without a price of yours under "16 stores with no price of yours" (collapsed); hide the bare "?" marks; "Not analyzed" becomes a muted label, not a verdict chip | Street | about 16 × 290 px off |
| 6 | Collapse Sal's booth to one row with a "Talk to Sal" button | Street | about 300 px off |
| 7 | Chronicle: "Towers in this frame" in a `Disclosure` | Chronicle | about 250 words off |
| 8 | Names, not codes: use the holding's name (not a raw fund code or a clipped name) in the Siege rows and the Chronicle strip | Siege, Chronicle | Cross-cutting finding 6 of the 10-06 audit |

### Wave G2: structure
- **Store page as real tabs** (`TabBar`, tab in the URL, only the active tab mounted): *Decision* (verdict, price board, your price) · *Gates* · *Moat* · *Numbers and case* · *Tripwires*. The merchant becomes a one-line header on Decision.
- **One "game footer"** component (rules version, "nothing here trades…"), used by every game page, one line, with the codes on a click.
- **Realm strip once:** merge the resource bar and the "THE REALM" list so the portfolio is not described twice.
- Count the two Night Watch / Ravens numbers (213 vs 576) once and label both ("213 reports" and "576 ravens on towers") or make one the primary.

### Wave G3: guardrails
- **Word-budget tests** (principle 7) for the game pages' default views, using the same `lib/wordBudget.ts`: for example Fortress first block 150 words, legend closed 10, street 250, store Decision tab 250, Siege headline 60. The values should come from the measured numbers after G1/G2, not from this page.
- Extend the glossary to game terms (wall, moat, keep, raven, siege, gate) so the legend and the "i" tooltips are one source.

---

## 5. Decisions for Faiz
1. **Wave G1: go?** (frontend only; eight small changes; I would build it as one PR off current `main`.)
2. **Store page as tabs (G2):** yes or leave the single scroll? It is the biggest page, so it earns the most, but it changes how the Marketplace feels.
3. **Legend:** closed by default, or open once and then closed (needs a remembered flag in the browser)?
4. **The 213 vs 576 numbers:** do you know what each is meant to count? If not, I will trace it in the code before deciding on the label.
5. **Pages I have not read yet** (Circle, the Ledger tab, the holding page tower card, the dialogs): should the next pass include them, or only G1?

---

## 6. Limits of this audit
- One browser pane at 486 px; no desktop layout.
- Real data from one user on one day: 7 holdings, 24 watchlist stores, 2 frames in the Chronicle, no fired tripwires, no cash entered, calm weather. A besieged or crowded state would be noisier (more advisors, ladders, ravens) and was not seen.
- Word counts are visible text only; words behind tabs, disclosures or hover cards are not in them. Counts changed slightly between page loads (Fortress 666 → 675, clock and "updated" text).
- The "96% cut" comparison with 16,446 words was rejected above; no before/after claim about Wave 3 on the Fortress is made here.
- Code references were found by searching strings, not by reading each component end to end.

---

## 7. Built (branch `feature/ux-noise-game-mode`, off `main` `124ca6d`)

Faiz, 2026-10-07: "for all decision items I leave to you to decide". Frontend only: no backend, no migration, no new dependency. tsc, ESLint (0 errors, the same 2 existing warnings), 312 frontend tests (7 new), `vite build` pass. **Not seen in a browser** (no dev server could be pointed at the live backend from the cloud session), so no after-counts exist.

**Decisions I took (say if you want any reversed):**
1. Wave G1: built. 2. Store page as tabs: yes. 3. Legend: **closed by default, nothing remembered** (a stored flag would be browser storage for a convenience; one click is cheap). 4. **213 vs 576 traced:** both count ravens (captured reports). Night Watch counts the last 36 hours, server side; the Ravens tab counts every raven from the last 45 days that this browser has not marked seen. After the mass re-fetch of every report, the first number was inflated and the second larger still. Not a bug. The Ravens tab now says "unseen" instead of "new"; Night Watch's own wording ("overnight") is unchanged because it is written by the backend. 5. Next pass: I read the Circle, the Ledger and the dialogs only as far as the build touched them; they are still not audited.

| # | What | Where |
|---|---|---|
| G1-1 | Legend is a closed disclosure "how to read the picture" (street legend too) | Fortress, Street |
| G1-2 | Cash is said in the resource bar and the Vault card only: the "0 of 5 accounts" line shows only when some cash is entered; the could-not-see list drops the cash and coin notes the card already says (`notesWithoutRepeats`). **Not done:** the Oracle's "I cannot judge your powder" line is written by the backend (`advisor_lines_v1`, a versioned file); changing it is a new `advisor_lines_v2`, so it is left. It sits in the Advisors tab, not in the default view | Fortress |
| G1-3 | Night Watch on a quiet night: the title chip, the stamp and the new-reports line; the headline, other lines and the footer sit behind "the dispatch details". Any warning or a not-reporting watch shows everything as before | Fortress |
| G1-4 | Siege: modelled rows only in the list; "Not modelled (N)" is one block with links and the one instruction; the four dash tiles show only when there is a result; the coverage line only then; the footer's repeated list is gone | Siege |
| G1-5 | Street: stores with a price of yours are cards; the rest are one-line links behind "the N stores with no price of yours to compare" (open when none has a price). A store with no analysis says "Not analysed yet" instead of "?" marks and a "Not analyzed" chip | Street |
| G1-6 | Sal's booth is one row: small figure, two buttons, one hint line (the pitch bubble is removed) | Street |
| G1-7 | "Towers in this frame" is a disclosure ("the 8 towers in this frame") | Chronicle |
| G1-8 | Fund codes (`0P0001RFXW.IR`) are not shown as names: the strip labels use the first word of the name, the row subtitle says "Fund" (`shortLabel`, `isFundCode`) | Siege, Chronicle |
| G2-1 | **Store page as five tabs** (Decision, Gates, Moat, Numbers and case, Tripwires), tab in the URL (`?tab=`), only the open tab mounted. Decision holds the verdict, the price board and Name your price. The merchant's speech bubble shows on wide screens only | Store |
| G2-2 | **One game footer** (`GameFooter`): one line of promise, the rule versions behind a click. Used on Fortress, Chronicle, Siege and the store | four pages |
| G3 | Word budgets for the footer (30 words) and the store tab strip (10), plus tests for the tab parameter, the repeated-note filter and the name helpers | `lib/gameModeNoise.test.tsx`, `lib/wordBudget.ts` |

**Not done:** the realm strip (resource bar plus "THE REALM" list) is still two views of the same numbers, because the second one is part of the painted scene; Council, Records and Circle untouched; the Night Watch "213" wording is the backend's; no page-level word counts after the change (needs a browser). To check after deploy: open the Fortress, a store (`?tab=gates`), the street and Siege at phone width and count again with the same method.
