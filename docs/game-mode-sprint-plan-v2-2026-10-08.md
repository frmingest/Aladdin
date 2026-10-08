# Game mode: review and updated sprint plan (v2) — 2026-10-08

Status: **approved by Faiz 2026-10-08; G28 Phase A and G29 are built in one PR (see section 9), the rest is not built.** Written after reading the Fortress doc (G1–G11), the
next-ideas doc (G12–G27), the Sprint 25 doc, the 2026-10-07 noise audit, the split-view reader doc, `progress.md`,
and the code in `E:\Aladdin` (`frontend/src/components/fortress`, `pages/*`, `lib/*`, `DocumentReader.tsx`,
`backend/app/services/game`, the Newsweb provider). Ids continue from G27 (G28 onward). Nothing was run in a browser.

## 1. State of play (checked, not assumed)

- **Scale:** about 10,600 lines of game frontend (the painted scene alone is 1,380 lines of SVG), 8 game pages,
  15 backend game service files, 6 backend game test files. Sprints 23–25 are merged; Sprint 26 (G21–G27) is not built.
- **Nothing in game mode has been seen on your real data.** Every "as built" note says so. `progress.md` still lists the
  G1–G20 walkthrough as open. That walkthrough is the real gate for everything below.
- **Repo caveat:** `E:\Aladdin` is on `feature/currency-edit-and-nok-equivalent` with uncommitted changes, and its remote
  refs are stale (I did not fetch). I did not touch the working tree except to add this doc as an untracked file.
- **No game test in the post-deploy smoke:** `frontend/e2e/smoke.spec.ts` has no Fortress, Siege, Council, Records or
  Marketplace page. Art and animation have no automated check at all, only unit tests on the pure helpers.

## 2. Assessment: what is strong, what is thin

**Strong.** The mapping layer is deterministic, versioned and well tested. The rules (read-only, unknown stays unknown, no
buy/sell wording, demo mode wins) are enforced by tests. The scene reads facts at a glance. The rituals (Council, Records,
Circle) are the best-scoped pages. The noise pass already cut the worst repetition.

**Thin, in order of impact:**

1. **The game has almost no verbs.** Today you look, read a card, and occasionally press a lamp or Sal. The two activities
   that matter most for a Buffett-style owner are **reading filings** and **writing down why**. Reading a report is not in
   the game at all: it opens the plain modal reader (`DocumentReader.tsx`, an iframe on a blob URL). That is the biggest gap
   and your scroll idea is exactly the right fix.
2. **No sense of progress.** The "no points, streaks or rewards" rule is right for trading, but it left the game without any
   feedback loop. The honest alternative already exists in the art: **fog of war**. Lifting fog by doing real work is a
   progress system that rewards knowing, not trading (idea F1 below).
3. **Quarterly reports are never fetched.** The Newsweb provider only knows category 1001 (annual) and 1002 (half-year). Q1 and
   Q3 reports are not captured, so a "quarterly report scroll" has nothing to open for most quarters. (Whether 1002 also
   returns some quarterly filings is **unverified**; check first.)
4. **Time-based features are empty for now.** The Chronicle had 2 frames on 2026-10-07. History cannot be backfilled, so the
   Chronicle, Ravens and Night Watch will feel thin for weeks. Say so on the page rather than hide it.
5. **Unaudited surfaces:** Circle, the Ledger tab, the Sal and Genie dialogs, the holding page's tower card (the noise audit
   says so itself).
6. **Verification gap on art, motion, sound and phone performance.** About seven filter/turbulence definitions in `sceneWorld.tsx`, many looping
   animations, a sound mixer nobody has listened to. Frame rate on a phone is unmeasured.
7. **Thresholds in two places.** `realm-v1` and `market-v1` live in the frontend, outside the Rule 3 versioning. Still open from G8/G9.
8. **No first-run guidance.** I found no tour or onboarding in the game code (file-name search only). A new session drops you into a
   dense scene.

## 3. Design principle for "more gamified" (needs your decision, D1)

Current rule: no points, XP, streaks or rewards. I propose keeping the spirit and amending the letter:

> **Reward knowing, never trading.** Progress may be shown for *understanding* (fog lifting, scrolls opened, reviews written,
> circle marked). Nothing is ever granted for buying, selling, opening the app, logging in on consecutive days, or speed. No
> streaks, no timers, no loot boxes, no leaderboards. Progress is a map, not a score: it can go *backwards* when data goes stale.

That keeps Rule 3 of the Fortress doc ("truth over flattery") intact: a weak holding still looks weak; a fully surveyed
fortress is not a good fortress, only a well-understood one.

## 4. The ideas

Size is relative (S / M / L). Fidelity: Real = data exists; Partial = caveats; Missing = new input needed.
"Rules" confirms read-only / deterministic / unknown-stays-unknown unless noted.

### Theme A: The Scriptorium (your scroll idea, expanded)

| ID | Idea | How | Fidelity | Size |
|---|---|---|---|---|
| **G28** | **Scroll Reader.** In game mode, opening any report plays: a wax-sealed rolled scroll (tower crest, company, "Annual report 2025") appears, the seal cracks, the rollers part and the parchment unrolls; the report appears on the paper. Closing rolls it up. | **Phase A (no dependency):** a `ScrollShell` around the existing reader. Parchment is CSS (gradients + a static pre-rendered noise tile + torn-edge mask), the unroll is a `clip-path`/`transform` animation (no animated filters). The file keeps loading *during* the animation, so it costs no time. Skippable by any key; instant under `prefers-reduced-motion`; a "Plain reader" button always present; game off = today's reader, unchanged. Try `mix-blend-mode: multiply` on the iframe so white pages take the parchment colour. **Phase B (only if A feels good):** `pdfjs-dist` canvas renderer in a lazy chunk, which allows true parchment multiply on every page, page-turn, search, and highlights on PDFs. Scripting disabled in pdf.js; the CLAUDE.md Rule 5 empty sandbox stays on XHTML. | Real | A: S–M; B: M–L |
| **G29** | **Quarterly dispatch.** Fetch Q1/Q3 reports from Newsweb so every quarter has a scroll. | Check whether category 1002 already carries them; if not, find the Oslo Børs category id for quarterly reports and add it to `newsweb_filing_provider.py`. Same ingestion as half-year (PDF text, **no facts promoted**, reading material only, Rule 1). Dedup against existing files as in the half-year fetch. | Real (after check) | S–M |
| **G30** | **The Scriptorium (library room).** A shelf per tower: annual = large gold-sealed scroll, half-year = medium, quarterly = small ribbon scroll. Unopened scrolls keep their seal; opening breaks it. | Reads the existing `GET /documents` list. "Opened" is per browser (guarded `localStorage`, like Ravens), and is labelled **opened, not understood**. This is also G21's Library room. | Real | M |
| **G31** | **Raven to scroll.** A raven's report opens straight onto the page that changed. | Ravens already diff the newest period against the previous one; reuse the anchoring jump (`#page=N`, `aladdin-fact-…`). | Real | S |
| **G32** | **Evidence seals.** In an analysis, each citation shows as a small wax seal; pressing one unrolls the source scroll at the cited page. | Analyses must cite evidence ids (CLAUDE.md Rule 2). **Needs a check** that an evidence id maps to a document page; if it does, this is a front-end link, if not it is a small backend lookup. | Partial (verify) | M |
| **G33** | **Marginalia.** The figures pane styled as notes in the margin; your own note pinned to a page, saved as a journal entry (existing write). | Reuses the figures pane and the journal write. No LLM. | Real | S–M |

### Theme B: Fog of war is the progress system (honest gamification)

| ID | Idea | How | Fidelity | Size |
|---|---|---|---|---|
| **G34** | **Survey level per tower.** Each tower shows how much of it you have actually *surveyed*, as fog that lifts: latest report opened, analysis fresh, thesis with an invalidation written, circle marked, valuation available. | Pure function over stored values and the per-browser opened flags; a new versioned file (`survey_v1`). A checklist of facts, not a score; it can fall when an analysis goes stale. | Real | M |
| **G35** | **The Cartographer's table.** One map of the whole realm's fog, with a short list of "commissions" derived from real gaps (enter cash, re-fetch a report, write an invalidation, mark a sector). | The Council agenda already computes these gaps. Commissions are the same list, drawn as map markers, each ending at an existing page. No streak for finishing. | Real | M |
| **G36** | **Codex.** Terms (moat, ROIC, margin of safety, tripwire…) unlock as plates when they first appear on your own realm. | Reuses the Glossary page. Per-browser flag. Purely a reading aid. | Real | S |
| **G37** | **Time capsules.** A journal decision is sealed; at 6 and 12 months the seal opens in the Hall of Records, with a short ceremony and the review prompt. | Pure presentation over the existing 6/12-month review state. Caption stays: *a decision is not its outcome*. | Real | S |

### Theme C: Feel, art and craft

| ID | Idea | How | Fidelity | Size |
|---|---|---|---|---|
| **G38** | **Foley set.** Scroll unfurl, seal crack, raven wing, lamp rub, gate. Synthesised like the current wind, off by default, same 0.12 master cap. | Extends `fortressSound.ts`. Not remembered across loads (same reasoning as G7b). | n/a | S |
| **G39** | **Sprite pilot.** One illustrated tower set (basalt, timber, rotted, plus the scroll and seal) replaces the procedural SVG for one wall tier, to test whether hand-painted quality is worth it. | Mapping untouched; assets under `public/`; falls back to the SVG. Produced outside the app. | n/a | L (art-bound) |
| **G40** | **First-run tour.** A 60-second guided walk in **demo mode**: the Oracle shows the keep, a tower, the moat, a raven, a scroll. Skippable, shown once per browser. | Reuses the demo state; nothing real is shown. | Real | S–M |
| **G41** | **Performance and phone budget.** Pause looping animation when the tab is hidden or the scene is off screen; fewer filters on small screens; a measured frame budget. | Frontend only; measured in Chromium with a CPU throttle. | n/a | M |
| **G42** | **Scene keyboard map.** Arrow keys move between towers; a screen-reader outline of the whole realm. | Extends the existing focusable towers. | Real | S–M |

### Theme D: Rituals that make the loop (carried over, re-ordered)

| ID | Idea | Notes | Size |
|---|---|---|---|
| **G43** | **Parliament minutes.** The Council's quarterly review ends in a sealed "minutes" scroll you can export. | Pairs with the Sprint 21 PDF report; same scroll shell. | S–M |
| G21–G27 (unchanged from the next-ideas doc) | Inside the towers, Rival stalls, Genie upgrades, Sal smarter, Real-terms vault, Harbour, Postcard | G21's Library room is now G30. | S–L |

### Parked (unchanged or sharpened)

Tax collector, harvest fields, historic sieges, advisor debate, results-season calendar (**missing data**: no
financial-calendar source is stored), day/night and seasons, an aurora for calm books (dropped: reads as a reward).

## 5. Updated sprint plan

| Sprint | Theme | Items | Gate / reason |
|---|---|---|---|
| **26a** | **Ground truth** | Deploy check; your G1–G20 walkthrough on real data; game pages added to the read-only smoke; word budgets for Circle, Ledger tab and dialogs (the unaudited ones); decide D3 (threshold home) | Nothing below is worth building if the walkthrough changes the shape of the fortress |
| **27** | **The Scriptorium** | G28 (Phase A), G29, G30, G31 | Highest value, no new analysis, mostly frontend. Browser check of the iframe multiply trick before committing to Phase B |
| **28** | **Fog of war** | G34, G35, G36, G37 (with D1 approved) | Needs the principle in section 3 agreed first |
| **29** | **Feel** | G40, G41, G42, G38, then a go/no-go on G28 Phase B and G39 | Performance first, polish second |
| **30** | **Evidence and ceremony** | G32, G33, G43, G28 Phase B (if approved) | G32 depends on the evidence-id check |
| **31** | **Depth** | G21 (rooms), G22, G23, G24, G25, G26, G27 | Remaining Sprint 26 items; trim at will |

Cross-cutting in every sprint: tests for each pure rule (existing style), a Chromium render at desktop and phone width, demo
mode first, the "no buy/sell/reward" wording test extended to new text, and the status-honesty wording
("written, not yet deployed") in the write-up and `docs/PROGRESS.md`.

## 6. Scroll reader: spec for G28 Phase A

1. **Entry.** Anywhere a report opens (holding page, Library, raven, store) in game mode renders `ScrollShell` around the
   existing `DocumentReader`. The reader's fetch, blob URL, figures pane, jump logic and focus handling are reused unchanged.
2. **Sequence (about 1.4 s, skippable).** Closed scroll with seal and crest → seal cracks (150 ms) → rollers part and the paper
   unrolls (clip-path inset, 700 ms) → content fades in. The iframe loads during the animation.
3. **Look.** Parchment from layered gradients plus a single static noise tile, torn top and bottom edges by mask, two wooden
   rollers, a ribbon per figures-pane section, the figures pane as marginalia. Colour tokens come from the existing study skin so
   dark and light both work. A "Parchment tint" toggle (default on), because some charts lose meaning under tint.
4. **Safety.** XHTML iframe keeps `sandbox=""`. PDFs stay in the browser's viewer in Phase A.
5. **Accessibility.** `prefers-reduced-motion` = no animation at all, same final layout. Escape and the existing close button
   still work. The animation never blocks reading.
6. **Known unknown.** Chrome's built-in PDF viewer has a dark grey surround and a toolbar that CSS cannot reach. Multiply would
   darken the surround. If it looks wrong, Phase A frames the PDF in the scroll without blending, and Phase B (pdf.js) is the real fix.
7. **Tests.** A pure state machine (closed → cracking → open → rolling → closed) and the reduced-motion path in vitest; the
   word-budget helper for the shell's chrome; a Chromium screenshot in the cloud sandbox.

## 7. Risks

- **Gamifying real money.** Mitigated by section 3. The Partner/Oracle wording test extends to every new string.
- **Spectacle over speed.** If the scroll adds even one click to reading a report, it will become annoying in a week. Hence skip-anywhere and a plain-reader button.
- **Art is the long pole.** Procedural SVG can hit "scholarly", not "hand-painted". G39 is a pilot, not a commitment.
- **Dependency weight.** pdf.js is the only proposed new dependency, lazy-loaded, and only if Phase A is not enough.
- **Per-browser state** (opened scrolls, codex, tour) does not follow you across devices. Acceptable for view preferences; say so in the UI.
- **Verification gap.** Motion, sound and feel cannot be proven by tests; they need your eyes. Each sprint ends with a short look-and-judge checklist, not a claim of "done".

## 8. Decisions (Faiz, 2026-10-08)

| # | Decision | Answer |
|---|---|---|
| D1 | Honest gamification: reward knowing, never trading; fog of war as progress | **Approved** |
| D2 | Scroll reader | **Phase A first**; pdf.js only if it earns it |
| D3 | Thresholds `realm-v1` / `market-v1` | Left to Claude: **stay in the frontend for now** (display wording only, nothing stored depends on them); move them if either ever drives something stored; a change is a new version in the same file |
| D4 | "Opened" state | Left to Claude: **per browser** (view convenience like Ravens; no migration; move to a table later if cross-device matters) |
| D5 | Q1/Q3 Newsweb fetch | **Yes** |
| D6 | Order | Left to Claude: **Sprint 27 work starts in parallel** with the walkthrough; Sprints 28+ wait for the walkthrough feedback |

## 9. Built so far (2026-10-08, branch `feature/scriptorium-scroll-reader-and-quarterly-fetch`, PR open, not merged, not deployed)

- **G28 Phase A:** in game mode a report opens as a parchment scroll (seal, rollers, unroll, about 1.2 s; any key skips; reduced motion starts open; "Plain reader" button; game off = unchanged reader). Parchment tint multiplies HTML filings onto the paper (off by default for PDFs). Frontend only; tests in `lib/scroll.test.tsx`. Seen only in a headless Chromium test page (desktop and phone width) with a synthetic HTML filing. **Not seen with a real report or a PDF in Chrome's viewer**, which is the known unknown in section 6.
- **G29:** the interim Newsweb fetch can also list configured categories (`NEWSWEB_QUARTERLY_CATEGORY_IDS`, empty = off) and keeps rows whose title reads like a quarterly/interim report. **Oslo Børs cut its categories to 25 and no quarterly id could be confirmed from here**, so it is configuration, found with `backend/scripts/newsweb_probe.py`. Reading material only, no facts promoted.
- **Verified:** backend 1,755 passed / 2 skipped, ruff clean; frontend tsc clean, ESLint 0 errors (the 2 existing warnings), 342 tests, build.
