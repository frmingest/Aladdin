# Game mode ("Fortress") — feasibility and plan — 2026-10-01

Status: **G1–G7a are merged to `main` (PRs #23, #25, #27 carrying G3 + G4, #28, #29, #30 art pass, #31 quick-look fix), not yet checked live. G7b (advisors, study lamp and clock, optional sound) is built on `feature/game-mode-g7b-advisors`, PR open.** F33 in `PROGRESS.md`.

## Why

Faiz brainstormed a single-player, value-investing "fortress-building" game that turns his real
portfolio into a miniature diorama (moat, walls, vault, a temperament meter, Buffett/Munger
advisors) and asked whether it can be built into Aladdin behind a top-bar toggle: default mode =
the app as it is today, game mode = the whole app re-presented as the fortress, using the real
portfolio.

## Verdict

**Feasible, and cheaper than it looks, because almost every game signal already exists as a
stored, deterministic value.** The real work is (a) one new mapping layer and (b) illustration and
animation, not new analysis. Three parts of the concept are only partly supported by current data
(vault, temperament, "FOMO") and are called out below so they are not over-promised.

## Rules the game must obey (from CLAUDE.md)

1. **Read-only view.** Game mode never changes an analysis, a score, a prompt or a stored row. It
   only re-renders what the app already computed (Rule 1, Rule 2).
2. **Deterministic mapping.** Every fortress property is computed by code from stored values. No
   LLM decides how strong a wall is. The mapping lives in a **versioned file**
   (`app/domain/game_mapping/v1.py`, like `valuation_assumptions`) — a change that alters what Faiz sees is
   a new version, not an in-place edit (Rule 3).
3. **Truth over flattery.** A weak holding must look weak. No grade inflation, no "level up"
   rewards for opening the app or for trading. The only thing that is rewarded is what Buffett
   rewards: patience when the thesis is intact, and acting when a tripwire has fired.
4. **Demo mode wins.** With demo mode on, game mode must show the fabricated portfolio, never the
   real one. Same pattern as the other routers: `is_demo_mode(db)` is the first line of the endpoint.
5. **Nothing executes trades** (Rule 5). A "build" in the game is a *record*: a journal entry or a
   new portfolio snapshot upload. The "iron gate snaps into place" animation plays when that data
   appears, never as a buy button.
6. **Unknown stays unknown.** Missing or stale data renders as scaffolding / fog, not a guess —
   same low-confidence principle as the rest of the app.

## Concept → data mapping

Fidelity: **Real** = exists today and is deterministic; **Partial** = exists with caveats;
**Missing** = needs new data or a decision.

| Game element | Driven by (existing field) | Fidelity | Notes |
|---|---|---|---|
| **Moat width / depth** | Blind-pass `moat.overall_rating` (Wide / Narrow / None) per holding | Real | Categorical, not numeric: three moat widths, not a smooth scale. The app has **7** moat sources (brand, pricing power, switching costs, network effects, cost advantage, IP, distribution), not 3 — each can be one visible moat feature (water, drawbridge, spikes…). |
| **Walls & keep (material)** | Deterministic balance-sheet metrics: total debt, cash, equity, liabilities, EBITDA, interest expense → net debt/EBITDA, debt/equity, interest cover | Real | Bucketed into basalt / granite / brick / timber / rotted by thresholds in the mapping file. The LLM's `financial_fortress` text is *not* used for the material (it is narrative). |
| **Banks / insurers** | Justified price-to-book path already exists; equity-to-assets "depleted" threshold in `financial_metrics` | Partial | Banks are structurally levered, so the debt rule would paint every bank as timber. Needs its own wall rule (equity ratio), same as valuation. |
| **Funds / ETFs / ETC gold** | Fund look-through (coverage %, earnings yield), instrument type | Partial | No balance sheet → drawn as an "allied outpost" with look-through coverage as its wall completeness. Physical-gold ETC reads as vault gold. |
| **Tower footprint** | Position `weight_pct` / `market_value_nok` | Real | |
| **Margin of safety / "land for sale"** | DCF bear/base/bull, price, margin of safety, `valuation_status` | Real | `implausible` or `unavailable` renders as fog with no number — never a made-up figure. |
| **Market siege / panic** | Regime classification, portfolio stress (`portfolio_shock_pct`, drawdown), per-holding price move | Real | From the stored risk snapshot, not a live provider call. |
| **Shared weak wall** | Correlation clusters (`ClusterFlag`) | Real | Two towers on one cracked wall segment. |
| **Diworsification → shantytown** | Position count, HHI (`ConcentrationOut`), cluster flags | Real | Rule: many tiny positions → shacks between towers. Thresholds in the mapping file. |
| **Analysis freshness** | Run timestamp (`analyzed_at`), thesis status (Intact / Review / Tripwire fired / Not analyzed) | Real | Stale analysis = ivy and scaffolding; a fired tripwire = a visible breach. |
| **Vault (dry powder)** | — | **Missing** | The Nordnet holdings export has positions only; there is **no cash balance** in the model. Precious-metals coins (F15) already exist and make a literal gold pile. See decision D2. |
| **Temperament meter** | Decision journal (action, date, `verdict_at_decision`, `confidence`, `invalidation`, 6- and 12-month reviews) + position changes between portfolio snapshots | Partial | *Corrects my first answer, which said there was no trade history.* The journal is a real decision record, but it is opt-in and trades happen in Nordnet. See "Temperament rules". |
| **Churn / "remodeling cost"** | Journal actions and snapshot-to-snapshot position changes | Partial | No fee/commission data, so show **turnover** (number and % of positions changed), not kroner. |
| **Advisors (Oracle / Partner)** | Rule-triggered lines | Partial | See "Advisors". |
| **Rain, clock, lamp** | None (ambience) | n/a | Pure front-end. |

## Temperament rules (deterministic, transparent)

The meter must be explainable line by line, never a black box. Draft v1 rules, all computed from
journal entries and snapshots over a rolling window:

- **Drains:** buying/adding where `verdict_at_decision` was Sell/Avoid; selling a holding whose
  thesis was Intact (no tripwire fired) — the "panic sell"; several actions on the same holding
  inside a short window (churn); decisions logged without an `invalidation`.
- **Restores:** holding through a price drop while the thesis stayed Intact; selling *after* a
  tripwire fired (discipline, not panic); completing the 6/12-month review on past decisions.
- **Shown with its evidence base:** "based on N logged decisions" and a low-confidence state when
  N is small. It never claims to detect FOMO — it can only see what was logged or visible in a
  snapshot diff.
- **Informational only.** It never blocks, nags or scolds about a real-money decision.

## Architecture

**Backend**
- `GET /game/state` — a pure function over *stored* data. It must not call live providers
  (that was the 2026-09-30 page-load lesson). G1 is database-only like the Dashboard overview;
  a `computed_snapshots` cache (`game_state`) is added only if it turns out slow with real data.
- Mapping file `backend/app/domain/game_mapping/v1.py` + loader (`active_game_mapping_version`
  setting); response carries `mapping_version`.
- Demo branch first, returning a fabricated state built from the existing synthetic data.
- No new tables. Two additive nullable columns on `accounts` for the Vault (D2): `cash_nok`, `cash_as_of`.

**Frontend**
- New `GameModeProvider` (like `DemoModeProvider`). The toggle sits in a **new slim top bar** —
  today there is only the left sidebar, so "button on top of the page" means adding a top bar.
  Persisted per browser in guarded `localStorage` (like the theme), default **off**. It is a view
  preference, so it does not belong in the backend `app_settings` table.
- The fortress scene is a **lazy-loaded route chunk**, so default mode pays nothing.
- Rendering: layered 2.5D SVG (procedural stone/gate/tower components with SVG filters) plus
  Framer Motion for the "snap into place" and a CSS rain/lamp loop. Not full 3D. One new
  dependency (Framer Motion).
- Accessibility: honour `prefers-reduced-motion`; every visual fact is also available in a plain
  **Ledger view** (table of the same state). No flashing, no sound by default.

**How "the entire app changes" is delivered** (decision D1): the **Fortress home scene** is the one
genuinely new screen. Clicking a tower opens the **existing** holding page, re-skinned through the
theme tokens (`data-skin="study"` next to the current dark/light theme) — not a second copy of every
page. That gives the "whole app feels different" effect without doubling frontend maintenance.

## Phases

| Phase | Delivers | Size |
|---|---|---|
| G0 | This ADR; decisions D1–D5 | done |
| G1 | `game_mapping/v1.py`, `/game/state`, demo branch, account cash field, pytest for every rule and threshold | M — **merged (#23)** |
| G2 | Top bar + toggle + provider; Fortress home with moat, walls, tower footprint, diworsification | L — **merged (#25)** |
| G3 | Drill-down: holding pages re-skinned (`data-skin`), Ledger view | M — **merged (#27, with G4)** |
| G4 | Sieges (regime/stress), margin-of-safety "land for sale", tripwire breaches (analysis-freshness weathering already shipped in G2) | M — **merged (#27)** |
| G5 | Vault entry screen (D2) | S–M — **merged (#28)** |
| G6 | Temperament meter, journal-driven | M — **merged (#29)** |
| G7a | Art pass: painted scene, ambience, frame, resource bar, hover card | M — **merged (#30)** |
| G7b | Advisors, lamp/clock, optional sound | M — **built 2026-10-01 (PR open)** |

Sizes are relative effort, not hours. **The art is the long pole** — a procedural SVG kit gets to
"calm and scholarly" but not to hand-painted miniature quality; swapping in illustrated sprites
later is possible without touching the mapping.

## Risks

- **Gamifying real money.** Streaks, XP or reward-for-trading would push toward the action bias the
  game is meant to teach against. Design rule above: no such mechanics.
- **Stale or low-confidence scores must look unfinished**, not solid.
- **Two displays can drift.** One `/game/state` serves both the scene and the Ledger view so they
  cannot disagree.
- **Quote authenticity.** Advisor lines are invented, so they must not be presented as real
  quotations from Buffett or Munger (see D4).
- **Screen-sharing.** Game mode shows real positions; demo mode covers this, and the toggle must
  not weaken it.
- **Verification gap.** Art and animation cannot be proven by unit tests; they need a real browser
  look (Playwright screenshots in CI-less review, then Faiz's eyes). The mapping layer can be fully
  unit-tested.

## Decisions (answered by Faiz, 2026-10-01)

| # | Decision | Answer |
|---|---|---|
| D1 | "Entire app changes" | **Fortress home scene + re-skinned existing pages** (not a full game copy of every page) |
| D2 | What is the Vault? | **Faiz's own cash** (plus physical metals). Needs an optional manual cash field per account (additive migration) because Nordnet's export has none |
| D3 | Temperament meter driven by the journal? | **Yes — journal-driven**, with snapshot diffs as backup and a visible "based on N decisions" note. Informational only. (He deferred to the recommendation, 2026-10-01) |
| D4 | Advisor lines | **Hand-written, rule-triggered lines first** (chosen by Faiz 2026-10-01); generated lines possible later |
| D5 | Toggle persistence | **Per browser (localStorage), default off** — his "whatever you recommend" |

## Next step

On a go: **G1** (mapping file + `/game/state` + tests) — it is the most valuable piece, fully
testable, and unblocks every later phase. Work on a feature branch (`feature/game-mode-fortress`),
PR for Faiz to review.

## G1 as built (2026-10-01)

- **Endpoint:** `GET /game/state` returns one tower per holding (structure, moat, wall material and
  the numbers behind it, size class, analysis freshness), the shantytown level, the vault, and
  plain-language data-gap notes. Database only; no provider or LLM call; demo mode returns a
  fabricated state first.
- **Wall rules (v1):** non-financial stocks on net debt / EBITDA (net cash = basalt; up to 1x granite;
  2.5x brick; 4x timber; above that or debt with no positive EBITDA = rotted; EBIT / interest under 3x
  drops one tier). Banks and insurers on equity / total assets (10% granite, 7% brick, 5% timber,
  below that rotted; never basalt). Funds, ETCs and bond/money-market funds get no wall
  (`not_applicable`); fund look-through walls come later. Missing data = `unsurveyed`, never a guess.
- **Other rules (v1):** size by portfolio share (15% / 7% / 3%), freshness 90 / 180 days (same stale
  cut-off as the Dashboard), a shack is a position under 2% (2-4 light, 5+ heavy shantytown), vault by
  cash share of cash + portfolio (20% deep, 10% stocked, 3% thin).
- **Vault:** cash comes from a new optional per-account field set with `PATCH /accounts/{id}`
  (`cash_nok`, `cash_as_of`); `null` = never entered, `0` = entered and empty. Physical coins are
  shown as ounces only, because valuing them needs a live spot-price call this endpoint never makes.
- **Not in G1:** sieges (regime/stress), margin-of-safety "land for sale", tripwire breaches (G4),
  temperament meter (G6), advisors (G7), any frontend (G2).
- **Verified:** 59 boundary tests on the rules, 9 API tests, whole backend suite 1,178 passed,
  ruff clean, migration `p1b7c8d9e0f1` up / down / up on Postgres 16 with a single Alembic head.

## G2 as built (2026-10-01)

- **Toggle:** a **Game mode** switch in a new slim top bar (desktop) and in the mobile bar. Per browser
  (`localStorage` key `aladdin-game-mode`, guarded), default off. On: opens `/fortress` and adds a
  *Fortress* entry to the Overview nav group and the Ctrl+K palette. Off from the Fortress: back to the
  Dashboard. With it off the app is unchanged.
- **Scene:** `/fortress`, a lazy route chunk. One SVG, laid out by `lib/fortress.ts` (biggest holding
  first, rows wrap and centre). Wall colour/pattern from the backend wall material (basalt, granite,
  brick, timber, rotted; scaffolded outline with a "?" when unsurveyed); moat from the moat tier (wide
  water with drawbridge, narrow, dry ditch, dotted when unsurveyed); ivy for ageing analysis, heavy ivy
  plus scaffolding for stale, fog for none; funds drawn as outposts, physical gold as a gold store,
  cash-like funds as granaries; a shantytown strip when the backend says so (capped at 16 huts drawn,
  the true count is printed). Pressing a tower opens its survey (numbers behind the wall, analysis age,
  verdict, link to the existing holding page).
- **Beside the scene:** Vault card (level from the backend, the cash figure and its age, coin ounces
  without a value), Spread-of-the-realm card (positions, effective holdings, top 1 / top 5), the data-gap
  notes, and the rules version.
- **Ledger tab:** the same state as a table, so nothing is only a drawing.
- **Rules kept:** read-only; reads `GET /game/state` only (stored data, demo mode honoured, "Demo data"
  chip when it is the fabricated state); no points, streaks or buy buttons; unknown data is drawn as fog
  or scaffolding.
- **Accessibility:** towers are keyboard-focusable buttons with a plain-language label; the rise-in
  animation is switched off under `prefers-reduced-motion`.
- **Deviation from the plan:** no Framer Motion. One CSS keyframe did the only animation needed, so the
  planned new dependency was not added; the "iron gate snaps into place" effect (G7) can still use it.
- **Verified:** tsc clean, ESLint 0 errors, 46 frontend tests (11 new), build. Rendered in Chromium
  against synthetic states (19 holdings covering every material, structure, freshness and moat, heavy
  shantytown) at desktop and phone width. **Not yet seen against Faiz's real data on the live deploy.**
- **Not in G2:** re-skinned holding pages (G3), sieges and margin-of-safety land (G4), a cash entry
  screen (G5, today cash is set via `PATCH /accounts/{id}`), temperament (G6), advisors and ambience (G7).

## G3 as built (2026-10-01)

- **Study skin:** while game mode is on, `GameModeProvider` sets `data-skin="study"` on `<html>`; removing it
  (switch off, or leaving the provider) restores the app exactly. `index.css` re-points only the neutral
  surface/ink/accent tokens to a candlelit-study palette (dark and light variants, composed with the existing
  `data-theme`), and sets headings in a system serif (no new font download). **State colours (positive,
  negative, caution) are not overridden**, so red still means bad. This is the "re-skinned existing pages"
  half of decision D1: every page changes feel, none is duplicated.
- **Holding page:** in game mode a **tower survey** card sits at the top of `/holdings/:id` (same wall /
  moat / size / analysis-age survey as the Fortress, shared `TowerSurvey` component, link back to the
  Fortress). It renders nothing with game mode off, on an error, or for a holding with no tower (watchlist).
- **Ledger:** sortable columns (holding, weight, moat, walls, analysis; strongest first, unknown last), a
  **Needs a look** filter (timber/rotted walls, no moat, stale or missing analysis) and a totals line
  (rows shown, share of portfolio, how many to look at first). All pure helpers in `lib/fortress.ts`. The
  filter is a reading aid over backend categories, not a score and not advice to trade.
- **Rules kept:** read-only, no new endpoint, no backend change, no points or rewards.
- **Verified:** tsc clean, ESLint 0 errors, 53 frontend tests (7 new), build. Rendered the Ledger with the
  skin in Chromium against a synthetic state. **Holding page with real data not seen yet.**
- **Not in G3:** sieges and margin-of-safety land (G4), cash entry screen (G5), temperament (G6), advisors
  and ambience (G7).

## G4 as built (2026-10-01)

- **Source of data:** database only, no provider or LLM call. Three stored layers are read as last saved and
  labelled with their age: the **risk snapshot** (macro regime, stress what-if, correlation clusters), the
  **margin-of-safety snapshot** (price zone per holding) and the **thesis monitor** (fired tripwires). The
  snapshots are *not* rebuilt here (the fingerprint and max-age rules of the page endpoints are ignored on
  purpose); if one was never stored the layer is fog and a note says which page to open once. A corrupt
  snapshot degrades to fog, not an error. Older than 7 days = shown but marked old, with a note.
- **Weather (`siege.level`):** calm / gathering / besieged / unsurveyed. Besieged: regime `crisis`, or the stored
  stress scenario costs the equity book 40% or more. Gathering: regime `stagflation`, or 25% or more.
  Nothing stored = unsurveyed (mist), never calm. Reasons are listed line by line, including "regime not
  available" and "partial reading".
- **Land for sale (per tower):** straight from the stored zone: below the bear case = bargain (gold SALE sign),
  below base = discount (OFFER), above base but inside bull = full price (no sign), above bull = dear (red
  DEAR). A withheld/implausible valuation or a missing row is fog and carries **no number**.
- **Breach (per tower):** a fired tripwire = breached (hole in the wall, red !); thesis flagged for review = amber
  i; funds etc. with no thesis rules = not applicable.
- **Siege exposure (per tower):** the stored what-if loss for that holding: 20% = exposed, 40% = breach risk.
  Ladders are drawn **only while the weather is gathering or besieged**; in calm weather it appears in the
  survey and Ledger only. It is a what-if, not a forecast.
- **Shared weak walls:** stored correlation clusters; a cracked curtain wall is drawn between same-row
  neighbours, the survey names the partners for the rest.
- **Rules kept:** read-only; demo mode shows invented data and never the real snapshots; no points or buy
  buttons; "needs a look" gains only a fired tripwire (cheap land or a hypothetical exposure is not a problem
  with the business).
- **Mapping:** new thresholds added to `GameMapping` v1 as additive fields (no earlier v1 value changed; v1 had not
  been shown on real data). Any later change to them is v2.
- **Frontend:** weather sky (clouds, enemy camps, mist) and a top-right weather label, land signposts (top layer),
  breach marks, ladders, shared walls, a legend, a "weather and siege" card, three new Ledger columns (land,
  thesis, siege) with sorting, and Land / Thesis / Under siege rows in the tower survey (also on holding pages).
- **Verified:** backend 1,226 pass (48 new: boundary tests for every threshold, 10 API tests incl. stale, corrupt,
  read-only, demo), ruff clean; frontend tsc clean, ESLint 0 errors, 70 tests (17 new), build. Rendered in
  Chromium (calm, gathering, besieged, unsurveyed, Ledger, phone) against synthetic states. **Not seen against
  real data on the live deploy.**
- **Needs once on the live app:** open Portfolio risk and Margin of safety once (or wait for the nightly snapshot
  refresh) so there is something stored to read.
- **Not in G4:** vault entry screen (G5), temperament (G6), advisors and ambience (G7). Weather is not animated
  (rain etc. is G7).

## G5 as built (2026-10-01)

- **Why:** the Vault is Faiz's own cash (D2) but the only way to enter it was a raw `PATCH /accounts/{id}`.
  G5 adds the entry screen and makes old cash visible instead of silently trusted.
- **Backend (additive, no migration):** the `vault` block of `GET /game/state` gained `accounts` (per account:
  id, name, cash, entered-at, `stale`) and `cash_stale`. New rule `rules.cash_is_stale`; new mapping v1 field
  `stale_cash_days=30` (additive, no earlier value changed; any later change is v2). A figure older than that is
  still used for the vault level, only labelled, and a data-gap note says to update it. No figure, or one with no
  stamp, is unknown, not stale. Demo state carries the fabricated account.
- **Frontend:** the Vault card shows *Enter cash* (nothing entered yet) or *Update cash*, opening a per-account
  editor: one box per account, Enter saves, Escape cancels, one Save sends a `PATCH` only for accounts whose
  figure changed. An empty box clears the figure to "never entered"; `0` means entered and empty. The age of each
  figure is shown, "(old)" in amber when stale. Hidden with a note in demo mode (writes are blocked there anyway).
  After saving the Fortress reloads from `GET /game/state`.
- **Amounts:** `parseCashNok` (lib/format.ts) reads `250 000`, `250,000`, `250.000`, `1.250,50`, `1,250.50`,
  `250k`, `1.2m` and a trailing `kr`/`nok`; it refuses negatives, text, more than two decimals and ambiguous
  separators rather than guessing.
- **Rules kept:** nothing is traded and no other data is touched; no points or rewards for entering cash; the
  figure is the user's own typed number and is labelled as such.
- **Verified:** backend 1,228 pass (2 new: staleness boundaries, per-account vault + stale flag through the API),
  frontend tsc clean, ESLint 0 errors, 74 tests (4 new for the parser), build. **Not seen in a browser or on real
  data.** Backend tests were run in the cloud sandbox from a snapshot of the repo (the PC workspace shell is out of
  disk space).
- **Not in G5:** temperament meter (G6), advisors and ambience (G7); valuing physical coins in NOK stays out
  (it needs a live spot-price call this endpoint never makes).

## G6 as built (2026-10-01)

- **Source of data:** database only, no provider or LLM call, no migration. Reads the decision journal, each
  tripwire's `fired_at`, and the positions of stored portfolio snapshots (quantity, last price, currency).
- **Window:** rolling 365 days. Rules run over every journal entry, then each event is kept by its own date, so a
  6- or 12-month review that fell due inside the window counts even when the decision is older.
- **Drains (one line each):**
  - *Bought against the verdict*: buy/add while `verdict_at_decision` was Sell or Avoid.
  - *No invalidation written*: buy/add with an empty "what would prove this wrong".
  - *Sold an intact thesis*: a **sell** (trims are never judged as panic) while the verdict was Buy or Strong Buy
    and no tripwire on that holding had fired by that day. A sell after a Hold verdict is not judged.
  - *Churn*: 3 or more buy/add/trim/sell entries on one holding inside 90 days; one line per burst.
- **Restores:**
  - *Acted on a tripwire*: trim or sell on or after the day a tripwire on that holding fired.
  - *6- / 12-month review done*: the review text is written and the review is due (182 / 365 days).
  - *Held through a drop*: the position was kept (quantity not reduced) between two snapshots of the same account
    while its price fell 15% or more in the same currency, with no tripwire fired by then. Holding on after a
    tripwire fired is neither rewarded nor punished.
- **Meter:** needle = restores / (restores + drains) × 100. 70 composed, 40 steady, 20 restless, below rash. Nothing
  judged = *unsurveyed* (dashed dial, "?"), never a default needle. Fewer than 5 logged decisions in the window =
  *Low confidence*, still shown. The summary always says "based on N logged decisions and M snapshot comparisons".
- **Turnover ("remodelling"):** per account, the two latest snapshots: added, removed, resized, and the share of
  positions changed. Counts only; there is no fee data to price it.
- **Known limit:** a tripwire's `fired_at` is cleared when the metric recovers, so an old firing that later cleared
  is no longer on record and its sell will not count as "acted on a tripwire". Stated, not worked around.
- **Mapping:** thresholds added to `GameMapping` v1 as additive fields (`temperament_window_days`, `churn_window_days`,
  `churn_min_actions`, `held_drop_min_fraction`, `temperament_min_decisions`, `composed/steady/restless_min_pct`);
  no earlier v1 value changed. Any later change to them is v2.
- **Rules kept:** read-only (tested), informational only, no points, no reward for trading; demo mode shows an
  invented meter built from the demo journal plus a few invented decisions, never real entries.
- **Frontend:** `TemperamentCard` below the weather card on the Fortress: half-dial with the four bands, level and
  needle, ▲ restored / ▼ drained counts, the newest six lines (show all), turnover, link to the Journal. Colours come
  from the theme tokens, so it follows dark/light and the study skin.
- **Verified:** backend 1,259 pass (31 new: boundary tests for every rule and edge, 4 API tests incl. read-only and
  demo), ruff clean; frontend tsc clean, ESLint 0 errors, 80 tests (6 new), build. Card rendered in Chromium at
  desktop and phone width against the demo state and an empty state. **Not seen with real journal data.**
- **Not in G6:** advisors, polish and ambience (G7).

## G7a art pass as built (2026-10-01)

Faiz asked for game-UX design skills and "more modern / Warcraft-like" graphics. Frontend only: no
backend, mapping, rule or migration change; every visual still comes from a backend category.

- **Direction:** a painted fantasy-strategy diorama, not flat clip-art. One light source (upper left),
  a lit and a shadowed side on every building, contact shadows, painterly grain (SVG `feTurbulence`),
  atmospheric depth (two mountain ranges with haze, snow caps, a pine treeline), terraced hillside with
  cliff faces per row of towers, a vignette.
- **Weather paints the world** (`lib/fortressArt.ts`, tested): calm = dusk with a low sun and fireflies;
  gathering = overcast with light rain; besieged = ember-red sky, enemy camps with smoke, rising embers;
  unsurveyed = pale moonlit mist (never calm).
- **Buildings:** keeps have conical roofs whose material follows the wall (slate for basalt/granite/brick,
  shingle for timber, a holed, broken roof for rot), so quality reads twice; crenellated parapets with
  corbels (stone) or palisade stakes (wood), quoins, iron bands on timber, arched doors, footing.
  Funds = round allied towers with a green roof; gold = a gold mine with glinting nuggets; cash-like funds
  = thatched granaries; unsurveyed walls = a ghost building plan with stakes and rope and a "?".
- **Freshness:** lit windows, torches and a banner when fresh; one lit window when ageing; ivy, then
  ivy + scaffolding; fog when never analysed. **Fired tripwire:** flames, smoke, the breach and a red "!"
  medallion. Review: an amber "i" medallion. Ladders, shared cracked walls, signposts redrawn in wood/gilt.
- **Interaction:** a ground selection ring (gold on hover/focus, green and pulsing when selected); a
  game-style hover card (name, structure and weight, wall, moat, analysis age, land, thesis) beside the
  tower; keyboard focus shows the same ring and card.
- **Frame and resource bar:** the painting sits in an iron-and-gilt frame with cast corner pieces; above it a
  resource bar shows realm value, vault cash, towers, weather and temperament. They are facts from
  `/game/state`, never points.
- **Whole app in game mode:** headings in Marcellus (one Google Fonts family added to the existing link; it
  only downloads while the skin is on), panels with a gilded edge, section markers as gilded lozenges.
  State colours are still untouched.
- **Motion:** banners, water shimmer, flicker, smoke, medallion bob, gold twinkle, fireflies/rain/embers;
  all small and slow, all off under `prefers-reduced-motion` (particles hidden entirely).
- **Layout:** `ROW_HEIGHT` 250 → 290 and `SCENE_TOP` 70 → 96 to fit the roofs; the meadow below the last
  row is only drawn when there is a shantytown.
- **Verified:** tsc clean, ESLint 0 errors (2 pre-existing warnings), 83 frontend tests (3 new), build.
  Rendered in Chromium against the backend's demo state and a synthetic "variety" state (every structure,
  wall, freshness, moat, shantytown) in calm, gathering and besieged weather, dark and light theme, desktop
  and phone width, plus hover and selection. **Not yet seen with Faiz's real portfolio.**
- **Still procedural SVG**, not hand-painted sprites: illustrated sprites could still replace parts later
  without touching the mapping.

## G7b advisors, study lamp and clock, sound as built (2026-10-01)

Decision D4 followed: hand-written, rule-triggered lines; nothing is generated. No mapping threshold was
added and there is no migration: the advisors only read values `GET /game/state` already derived.

- **Where it lives:** `app/services/game/advisors.py` (pure: no database, provider, model or clock) picks the
  lines; the words are in the versioned `app/domain/game_mapping/advisor_lines_v1.py` (CLAUDE.md Rule 3: a
  change to a template that has been shown is a new `advisor_lines_v2.py`, not an edit). The result is the new
  `advisors` block of `GET /game/state` (demo mode builds it from the invented state like every other block).
- **Two advisors:** the **Oracle** (patient owner) and the **Partner** (blunt sceptic). Original wording in the
  spirit of each; **not quotations** from Warren Buffett or Charlie Munger, and the disclaimer is shown on the card.
- **Voice rules, enforced by tests:** no line says buy, sell, add, trim, invest or purchase; no flattery; unknown
  stays unknown (fog, an unsurveyed vault, an unknown weather or a low-confidence meter produces a "cannot judge"
  line or nothing, never a confident one); nothing rewards trading.
- **Rules (id: advisor, tone):**

| Rule | Who, tone | Fires when |
|---|---|---|
| `tripwire_fired` | Partner, warning | the holding's thesis is breached (a tripwire has fired) |
| `weak_walls_big_tower` | Partner, warning | great/medium tower with timber or rotted walls |
| `no_moat_big_tower` | Partner, warning | great/medium tower where the analysis found no moat (not "unsurveyed") |
| `storm_vault_thin` | Partner, warning | weather gathering/besieged and the vault is thin or empty |
| `temperament_strained` | Partner, warning | restless or rash with a confident (not low-confidence) reading |
| `thesis_review` | Oracle, note | thesis flagged for review |
| `stale_big_tower` | Oracle, note | great/medium tower, analysis older than the stale cut-off |
| `shared_wall` | Partner, note | a stored correlation cluster (up to 2 shown) |
| `dear_big_tower` | Partner, note | great/medium tower priced above its bull case |
| `shantytown` | Partner, note | light or heavy shantytown |
| `vault_unknown` | Oracle, note | no cash entered, or the figure is older than the cash limit |
| `cheap_on_strong_walls` | Oracle, note | price below the bear or base case **and** basalt/granite walls **and** a wide/narrow moat ("a reason to study it, not a signal") |
| `storm_vault_ready` | Oracle, calm | weather gathering/besieged and the vault deep or stocked ("nothing here says you must spend it") |
| `temperament_composed` | Oracle, calm | composed with a confident reading |
| `all_quiet` | Oracle, calm | nothing above is a warning or note **and** a stored risk reading says calm. Unknown weather is never called quiet |

- **Order and limits:** warnings, then notes, then calm; inside a tone, the fixed rule order above, then the
  largest holding first. At most 6 lines and 2 per rule so one rule cannot drown the rest; the response carries
  `hidden_count` so the card says how many more matched. Every line carries `facts` (the stored values it was
  chosen from), shown under *Why this line*.
- **Frontend:** *The advisors* card with two small drawn busts (generic, not likenesses of anyone), a tone chip,
  the holding as a link, and the fact list. A **study desk** card holds a live analog clock (local time, updates
  every 30 s) and a **lamp** that mirrors the age of the newest portfolio snapshot: lit within 7 days (the same
  limit as the stored-snapshot cut-off), dim when older, out when there is none. It is a reading of data age,
  not a reward. The lamp's glow breathes slowly and is still under `prefers-reduced-motion`.
- **Sound (optional):** a **Sound: off/on** button in the Fortress header. Off by default and **not remembered**
  across page loads: browsers only allow audio after a press, and a surprise noise on a page showing real
  money is not wanted (a deviation from the per-browser persistence of D5, on purpose). Synthesized in the
  browser (looped noise through a filter, no audio files, no network): a soft wind when calm, a fuller roar when
  the weather is gathering, a low rumble when besieged, fainter when unsurveyed; a slow swell; faded in and out;
  hard-capped at a master level of 0.12. It carries no information a sighted reader lacks.
- **Verified:** backend 1,335 pass (76 new: 70 rule and boundary tests, 6 API tests incl. read-only, demo, the
  unknown-weather and quiet-realm cases), ruff clean; frontend tsc clean, ESLint 0 errors (the same 2 existing
  warnings), 94 tests (11 new for the wording, lamp, clock and sound profile), build. Rendered in Chromium
  against a synthetic state (every tone, two advisors, hidden count) at desktop and phone width, dark theme.
  **Not seen with Faiz's real portfolio, and the sound has not been listened to** (no audio in the build sandbox).
- **Not in G7b:** generated advisor lines (possible later, per D4), per-holding advisor lines on the holding page,
  illustrated sprites for the portraits, a remembered sound preference.
