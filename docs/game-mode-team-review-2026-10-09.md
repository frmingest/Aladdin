# Game mode: design-team review and new proposals — 2026-10-09

Status: **proposed, nothing built, nothing changed in the repo.** Four reviewers (systems/mechanics, narrative/time/ritual,
visual/UX/feel, learning/scenarios + integrity) each read the code, `git log` and the project docs. Every proposal
below respects the standing rules: read-only view, deterministic arithmetic, versioned thresholds, no XP/streaks/rewards,
unknown stays fog, no trade execution, blind pass never sees notes.

## 0. Read this first

- **`E:\Aladdin` is stale.** It is on `feature/currency-edit-and-nok-equivalent` (PR #67 era, with uncommitted edits to
  `valuation.py`, `keyNumbers.ts`, `HoldingsListPage.tsx`). `origin/main` is at `a3cdf6e` (PR #81). Two reviewers
  read `origin/main`, two read the checkout, so a few "is X built?" answers differ. Run `git fetch` and look at main before
  building anything below.
- On `origin/main`: Siege v2 (beta x fall), Chronicle, Ravens, Night Watch, Council, Records, Circle, fog of war,
  Scrolls reader are built. **G21–G27 (rooms, rival stalls, genie upgrades, Sal smarter, real-terms vault, Harbour,
  Postcard) were not found on main.** The sprint-plan-v2 numbering no longer matches its own table.
- Data is young: DB wiped 2026-09-21, 1 journal decision, Chronicle frames only since 2026-10-07. Every time-based
  idea below must read honestly at n=1.

## 1. Fix first: places where the game can mislead

Items marked (verified) I re-checked against `origin/main` myself.

| # | Finding | Where | Severity | Fix |
|---|---|---|---|---|
| 1 | "Calm skies" has no coverage floor: `siege_level` accepts any stored shock, and the stress covers equity/fund types only (5 of 8 holdings in PROGRESS). (verified) | `game/rules.py:262-300`, `risk/stress.py:118` | High | Apply the simulator's coverage rule or return "unsurveyed" (mist) |
| 2 | DCF-bear shock `(bear-price)/price` has no sign guard; a bargain tower yields a positive shock that offsets losses. It is also summed with a 2σ/20-day volatility shock. (verified, no clamp) | `risk/stress.py:103-123` | High | Clamp to ≤0, report subtotals per method, add a test |
| 3 | Simulator headline "The walls hold" at 50% coverage; unmodelled value is treated as unharmed | `game/siege.py ~164-184` | Med-High | Put unmodelled share in the headline; new `siege_scenarios_v3` |
| 4 | Two siege engines (weather: 2σ/DCF-bear; simulator: beta x fall) share the same words and 25/40% lines. Walkthrough: -18.3% vs -6.6% | `rules.py:262`, `siege.py:176-190` | Med | Tag the method on every label |
| 5 | Back-dated journal entries get **today's** verdict as `verdict_at_decision`, which temperament rules then read (hindsight leak). (verified) | `api/journal.py:82,95` | Med | Pick the run in force at `decided_on` |
| 6 | The reconciliation verdict (which saw Faiz's notes) drives the store's "Analyst's word", Hype "ready" and two temperament rules | `thesis/latest.py:42`, `marketplace.ts`, `temperament.py ~156` | Med | Show blind verdict + source label; judge temperament on blind |
| 7 | Temperament "restore" for holding through a drop repeats per snapshot pair and for writing *any* non-empty review: de facto rewards | `temperament.py:168,216` | Med | One restore per drawdown, require intact thesis, minimum review length (v2) |
| 8 | Correlation flags use `abs(corr)`, so a hedge (strong negative) is flagged as a shared wall; only top-10 positions; matrix discarded | `risk/correlation.py:154` | Med | Fix inside the effective-bets work (A3) |
| 9 | Tripwire `fired_at` is cleared on recovery, so firing history is lost and `acted_on_tripwire` misses sales after recovery. (verified) | `thesis/tripwires.py:71-72` | Med | Derive from nightly frames or append-only log |
| 10 | Realm verdict says "No rule flags" for fund/gold-heavy books; `all_quiet` advisor line fires on all-fog books | `realmVerdict.ts:82,149`, `advisors.py:244` | Med | Count unanalysable weight toward "unknown"; surveyed-weight floor |
| 11 | "Wall at risk of breach" means a 40% *price* fall, not a balance-sheet breach; basalt is granted at `net_debt <= 0` even with negative EBITDA | `siege.ts:29`, `rules.py:132` | Med | Relabel "deep price fall"; cap basalt when EBITDA ≤ 0 |
| 12 | Chronicle keeps 540 days but replays only 120 frames; unreadable frames dropped silently; gaps unmarked | `history.py`, `chronicle.py:247` | Med | See B1 |
| 13 | Demo leakage: Codex plates unlocked by demo state persist in `localStorage` | `codex.ts:65` | Low-Med | Don't persist when `state.demo` |
| 14 | Ravens-seen and opened scrolls live only in `localStorage` | ravens, scrolls | Low | Accept or add server state |
| 15 | Frontend duplicates thresholds (debt 2.5/4, analysis 90/180, 25% MoS) | `marketplace.ts`, `realmVerdict.ts` | Low | Move to backend when anything stored depends on them |
| 16 | `rules.py:163` comment says look-through is "a later phase"; it shipped | `rules.py:163` | Low | Fix comment; see A5 |

## 2. Recommended order (my synthesis)

1. **Fix items 1, 2, 5** (small, make the existing sky and journal trustworthy).
2. **B1 Long Memory** (cheap, no migration; every time feature fails without it, and history cannot be backfilled).
3. **A1 Knife-edge** (distance to next tier; no new data).
4. **C1 Siege back-test** (checks the weakest number the game shows).
5. **D1 Plain lens** and **D2 Camera** (trust and first-glance legibility).
6. **B2 Then and Now** (clearest honest learning loop).

## 3. Proposals

Size S/M/L. Fidelity: Real = data exists, Partial = caveats, Missing = needs input or migration.

### A. Systems and mechanics
| ID | Idea | Builds on | Fid. | Size |
|---|---|---|---|---|
| **A1** | **Knife-edge:** show distance to the next wall/moat tier ("net debt/EBITDA 2.4x, timber at 2.5x"); hairline crack within a band; Council agenda kind | `TowerOut.wall_inputs`, `GameMapping` thresholds; new `margins_v1.py` with one "near" band | Real | S-M |
| **A2** | **Tripwire headroom and scars:** gauge ("ROIC 11.2% vs 10% line, 12% headroom"), scar on towers that fired before | `TripwireEvaluation`, `game_state:*` frames | Real / Partial | S-M |
| **A3** | **Effective bets and fire-breaks:** N_eff = 1/(wᵀρw); clusters drawn as one hill; negative-correlation holdings marked as fire-breaks. Merges with learning reviewer's empirical co-fall war game (worst OSEBX days, who fell together) | `correlation.pairs`, `price_history_observations`; new `diversification_v1` | Real | M |
| **A4** | **After the Storm:** at a simulated fall, which towers drop below stored bear/base value, and how much the vault covers. Risk: reads as "buy the dip", so no ranking, no verbs, caption "a what-if" | `build_siege_sim`, margin-of-safety board, `VaultOut` | Partial | M |
| **A5** | **Supply lines / inherited walls:** same company held directly and via a fund counts once ("Equinor 9% + 2.1% via Heimdal"); outpost wall as banded bar, unlinked share as fog | `FundExposure`, `funds/metrics.py` | Partial | M-L |
| **A6** | **NOK wind:** measured currency scenario ("NOK weakens 10%"), split into local-price and FX parts with R² caution | stored `{CCY}NOK=X` histories, `sensitivity.to_nok` | Partial | M |
| **A7** | **Garrison:** size vs written conviction/invalidation mismatch, symmetric wording, no "size up/down" | journal `confidence`, `invalidation`, `weight_pct` | Partial | M |

### B. Time, story, ritual
| ID | Idea | Builds on | Fid. | Size |
|---|---|---|---|---|
| **B1** | **Long Memory:** daily frames 90 days, weekly 2 years, month-end forever; gaps shown as "worker off, nothing recorded", never calm | `history.prune`, `load_frames`; `retention_v1.py`, no migration | Real | S-M |
| **B2** | **Then and Now:** open a journal entry and see the Oracle's belief then vs now (verdict, range, risks, invalidation) beside your own thesis; changed lines only, no praise arrows | `EquityAnalysisRun`, `thesis/timeline.py` (exists, not wired into game) | Real | M |
| **B3** | **Pre-commitment card:** pre-mortem, intended hold, exit condition before a buy, with plain facts beside it; blocks nothing. Needs additive migration (flag) | `DecisionJournalEntry`, `churn_events`, `freshness` | Missing (input) | S-M |
| **B4** | **Post-mortem quadrants:** replace the free-text review with reasons held / partly / failed / unknown + invalidation happened y/n/unknown; counts per quadrant, never a grade. Additive migration | `review_6m/12m`, `build_records` | Partial | M |
| **B5** | **State of the Realm (annual letter):** sealed yearly narrative from stored facts; a quiet year reads "a quiet year"; optional note to next year's self. New `realm_letters` table | B1, `diff_frames`, `build_records` | Partial | M-L |
| **B6** | **Tower biography:** one holding on one time axis (first seen, annuals, verdicts, tripwire firings, journal, competence changes); closed towers get a tenure summary, no counters | snapshots, `facts_by_period`, `build_timeline` | Partial | M-L |
| **B7** | **Next Bell (quiet almanac):** on a quiet night drop attention chips, show "last rule met: date / next due: date", never "all is well". Anti-engagement by design | Night Watch, `review_*_due`, `STALE_ANALYSIS_AFTER_DAYS`; `quiet_v1` | Real | S-M |
| **B8** | **Waiting Room log:** days a watchlist name sat under your buy-below price and what you did; no "missed gain" figure. Append-only table | `WatchlistItem`, price cache | Missing | M |

### C. Practice, scenarios, debiasing
| ID | Idea | Builds on | Fid. | Size |
|---|---|---|---|---|
| **C1** | **Siege back-test:** worst OSEBX drawdown inside the stored 730 days; predicted vs actual fall per tower, with error. Includes a constant-weight backcast of the book (max drawdown, days under water) | price history, `sensitivity.py`, `siege.holding_shock`; `backtest_v1` | Real (<=730d) | S-M |
| **C2** | **Calibration ledger (n-gated):** your confidence 1-5 vs 6/12-month outcome; the Oracle's bear-bull range vs later price; shows "opens at N=8" until enough data. Optional forecast table so the clock starts now. **Amends the Sprint 25 "no hit rate" rule: needs Faiz's call** | `compute_outcome`, `confidence`, run targets | Partial | M |
| **C3** | **Notes delta:** blind verdict/targets beside reconciled ones; how often your notes lifted the rating. A confirmation-bias detector | `blind_pass_json`, `reconciliation_json` | Real | S |
| **C4** | **Analyst scorecard:** model price targets vs later price, only past a minimum age/n (most runs are under 3 weeks old, so "too young" for now) | `EquityAnalysisRun`, price history | Partial | S |
| **C5** | **What would have to be true:** reverse-DCF implied growth beside stored history, plus a slider sandbox clearly labelled "your assumption"; stateless, no write | `reverse_dcf_implied_growth`, `dcf.py`, `growth.py` | Real | M |
| **C6** | **Practice realm with drills** on demo data ("which tower breaks first at a 35% fall?"); real holdings never touched | `demo.py`, `DEMO_BETAS`, `hype.readTip` | Real | M |
| **C7** | **Misjudgment cards:** short lesson when a detector fires (churn, bought against verdict, hype tip, held through a drop); original wording, sources cited by title only | temperament events, Codex; hand-written `lessons_v1` | Missing (content) | S |
| **C8** | **Historic sieges, honestly scoped:** benchmark path x today's betas, labelled "replay x today's beta". Provider history limit unverified; do C1 first | long index history | Missing / Partial | M |

### D. Look, feel, access
| ID | Idea | Touches | Size |
|---|---|---|---|
| **D1** | **Plain lens:** Painted/Plain switch redrawing the same layout as labelled blocks with the numbers; also the print form and low-GPU fallback | `FortressScene.tsx` (`PlainTower`), `lib/fortress.ts` | M |
| **D2** | **Camera:** drive the SVG `viewBox` (zoom/pan/fit, ease to selected tower), survey docked beside the scene on wide screens, labels floor at 11px. Fixes the `min-w-[720px]` scene with ~6-7px text on phones and the survey card sitting far below the clicked tower | `FortressScene.tsx:1338`, new `lib/camera.ts`, `FortressPage.tsx:306` | L |
| **D3** | **Style bible in code:** one token file for ~300 hard-coded hex values; second `WALL_FILL` in `chronicle.ts:23` removed; legend generated from real components; colour-blind and contrast tests; selection ring no longer "good" green | `FortressScene.tsx`, `sceneWorld.tsx`, `fortressArt.ts`, `index.css:256,293` | M |
| **D4** | **Tower portrait on the holding page** (extract `TowerBody` etc.) with an optional view-transition from the scene | `HoldingTowerCard.tsx` | M |
| **D5** | **Spotlight lens:** one chip dims (never hides) towers that need nothing; fog stays as visible as before | `lib/attention.ts`, CSS | S |
| **D6** | **Motion grammar + "Calm" switch:** still / ambient / alert tiers for 11 infinite keyframes; user toggle beyond OS setting | `index.css:168-239` | S-M |
| **D7** | **Announcement hygiene:** focus is announced twice (`FortressScene.tsx:1164` feeds the `aria-live` slot), svg label is one huge string, ambience keeps playing in a background tab, no volume control | `fortressSound.ts`, `SoundToggle.tsx` | S |
| **D8** | **Print / PDF realm sheet** (`@media print` does not exist today), with a no-names option shared with Postcard | `index.css`, `FortressLedger.tsx` | S |

Measured by the UX reviewer: 328 tests pass in 30 files; Fortress page chunk 124 kB (36.7 kB gzip); main chunk 207 kB;
recharts 373 kB shared. No scene component is rendered in any test; runtime frame rate is unmeasured.

## 4. Decisions for Faiz

1. **Pull main first**, then confirm which of G21–G27 you still want; this doc assumes they are not built.
2. **Fix items 1, 2, 5** before any new feature? (Recommended.)
3. **Amend the "no hit rate" rule** for an n-gated calibration view (C2)? Without it, B4 and C2 stay descriptive only.
4. **Additive migrations** you are willing to allow: pre-mortem columns (B3), review quadrants (B4), `realm_letters` (B5), `forecasts` (C2), append-only target/tripwire/competence logs (A2, B6, B8).
5. **Temperament v2:** remove the "restore for writing any review" reward?
6. Priority between **trust work** (D1, D3, C1) and **depth** (A3, A5, B2, B5).
