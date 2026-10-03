# Game mode: next ideas (proposed Sprints 23–26) — 2026-10-03

Status: **proposed, not approved, nothing built.** Brainstormed with Faiz on 2026-10-03 on top of G1–G11
([game-mode-fortress-2026-10-01.md](game-mode-fortress-2026-10-01.md)). Game mode stays **frozen** until
Faiz has done the walkthrough (PROGRESS.md §2 C); this page is the queue that follows it.

## Rules every idea must keep (from the Fortress doc and CLAUDE.md)

1. **Read-only view.** Re-renders what the app already computed; the only writes are ones that already exist
   (watchlist, journal, queue, cash, buy-below price).
2. **Deterministic.** Any new threshold or rule lives in a versioned file; a change to a shown value is a new version.
3. **Truth over flattery.** No points, XP, streaks or rewards for opening the app or for trading.
4. **Unknown stays unknown.** Missing data is fog or scaffolding, never a guess.
5. **Demo mode wins; nothing executes trades;** invented characters carry a disclaimer and never say buy / sell.

Fidelity: **Real** = data exists today · **Partial** = exists with caveats · **Missing** = needs new data or a decision.
Size is relative effort (S / M / L), not hours.

## Where it sits in the plan

Sprints 19–22 (board complete, speed, depth, alerts) come first. These four follow, in this order of value.
Order and content are Faiz's call.

| Sprint | Theme | Items |
|---|---|---|
| **23** | Hype and stress | G12 Hype Booth · G13 Siege Simulator |
| **24** | Time and filings | G14a nightly game-state snapshot · G14 Chronicle · G15 Ravens · G16 Night Watch dispatch |
| **25** | Rituals | G17 Council Chamber · G18 Hall of Records · G19 Circle of Competence · G20 per-holding advisor lines |
| **26** | Depth and polish | G21 Inside the towers · G22 Rival stalls · G23 Genie upgrades · G24 Sal smarter · G25 Real-terms vault · G26 Harbour · G27 Postcard mode |

**One early exception worth Faiz's attention: G14a.** History cannot be backfilled, and today's stored snapshots
overwrite (`computed_snapshots` is keyed). Saving one `game_state` row per night costs little and starts the
history the Chronicle needs. It fits the worker's existing 04:00 UTC snapshot refresh (Sprint 20 touches the same code).

## Sprint 23: Hype and stress

| ID | Idea | Data and approach | Fidelity | Size |
|---|---|---|---|---|
| **G12** | **Hype Booth (tip-checker).** A friend, Reddit or a newsletter gives a ticker. Sal pitches it loudly, the eight gates run, the Partner deflates it if it deserves that | Reuses G10 (add to watchlist), G9 (eight gates), G11 (queue analysis). A brand-new ticker has **nothing stored**, so the honest first result is *Cannot judge yet* with a list of what is missing and one press to fetch Newsweb reports and queue the analysis. That first result is the lesson. Optional: a "heard from" note (source and date) kept in the existing notes so tips can later be compared with outcomes in G18 | Real | M |
| **G13** | **Siege Simulator.** Pick a scenario and watch the siege hit the towers | v1: a market-shock slider and regime presets over the existing stress code (`services/risk/stress.py`: DCF-bear or volatility-sized per holding), as a read-only endpoint over stored data. Named macro scenarios (rates up, oil shock, NOK crash) need a **versioned sensitivity table** per sector: a v2 that pairs with Sprint 21's rate sensitivity. A what-if, never a forecast | Partial | M |

## Sprint 24: Time and filings

| ID | Idea | Data and approach | Fidelity | Size |
|---|---|---|---|---|
| **G14a** | **Nightly game-state snapshot** | Store `GET /game/state` once per UTC day under a dated key (or a small table; decide at build), pruned after N days. No new analysis | Real | S |
| **G14** | **The Chronicle:** replay the fortress through time | Positions and weights from `PortfolioSnapshot` (towers appear, vanish, resize) and, from G14a onward, the full state. **Wall quality of past frames cannot be rebuilt from old snapshots**, so frames before G14a draw unsurveyed walls rather than today's walls on an old portfolio | Partial | M–L |
| **G15** | **Ravens from Newsweb:** a raven lands on a tower when a new report is captured | Deterministic diff of the newest period against the previous one (ROIC, net debt / EBITDA, margins, FCF yield) from stored periods. "Seen" state per browser. Pairs with Sprint 22's insider and shareholder flags | Real | M |
| **G16** | **Night Watch dispatch:** the nightly tripwire check as a morning report | In-app card first (last night's check: how many quiet, which cracked). A pushed Sunday summary waits for Sprint 22's delivery channel | Real | S–M |

## Sprint 25: Rituals

| ID | Idea | Data and approach | Fidelity | Size |
|---|---|---|---|---|
| **G17** | **Council Chamber:** a quarterly review room | Agenda built from the existing rules (Needs-a-look rows, stale analyses, reviews due, old cash, fired tripwires). The advisors speak with their existing lines. Each item can end in a journal entry (existing write). No streak for attending | Real | M |
| **G18** | **Hall of Records:** the journal as a library | Per decision: what you wrote, verdict at the time, price then versus stored price now, the 6- and 12-month review. Caption: *decision quality is not outcome*. Hindsight, not a score | Real | M |
| **G19** | **Circle of Competence map** (Munger) | New small additive table: sector or industry, level (know / partly / outside), note, date. Holdings outside the border sit in fog of war; Ledger column; a new advisor rule would be `advisor_lines_v2` (shown v1 templates are not edited). **Migration needed, additive** | Missing (input) | M |
| **G20** | **Per-holding advisor lines** on the holding page | The `advisors` block already carries the holding per line: filter it. Frontend only | Real | S |

## Sprint 26: Depth and polish

| ID | Idea | Data and approach | Fidelity | Size |
|---|---|---|---|---|
| **G21** | **Inside the towers:** click a keep to enter rooms | Treasury = financials, Library = filings (split-view reader), War Room = risks and tripwires, Throne Room = verdict. The holding page re-presented as a place | Real | L |
| **G22** | **Rival stalls:** two watchlist stores side by side on the eight gates | Frontend over G9 | Real | S–M |
| **G23** | **Genie upgrades:** wishes preview how many holdings they queue, pick individual holdings, a sound for the rub, a "re-run stale analyses" wish | Preview and stale-only filter need a small backend parameter on the queue call | Real | S |
| **G24** | **Sal smarter:** fill the company name from the ticker; set the buy-below price in the dialog | Backend has **no ticker-to-name endpoint** today (named in G10's "not in" list); add one over yfinance | Real | S–M |
| **G25** | **Real-terms vault:** inflation slowly erodes the cash pile | Purchasing power of the entered cash since its date, using the CPI deflator from the Sprint 15 real-return work | Real | S |
| **G26** | **Harbour:** FX exposure as ships | Weight by `trading_currency` (stored per holding). v1 shows exposure only, no FX forecast | Real | S–M |
| **G27** | **Postcard mode:** export the fortress as an image with names and amounts redacted | Client-side SVG to PNG; weights only. Builds on demo mode | Real | S |

## Parked: needs a decision or data first

| Idea | Why parked |
|---|---|
| **Tax collector** (ASK shielding, wealth tax) | Needs inputs the app does not store (account type, rates that change every year) and a versioned rule file; must never read as tax advice |
| **Harvest fields** (dividends and earnings yield as farmland) | No dividend model in the backend; only dividends paid inside cash-flow statements, so coverage is partial |
| **Historic sieges** (replay 2008, 2020, 2022) | Needs historical prices per holding and defined scenario windows; pairs with Sprint 20's persisted price caches |
| **Advisor debate** (generated back-and-forth) | Decision D4 allowed generated lines later; must be labelled as generated, costs LLM quota, and belongs in [AI-VS-DETERMINISTIC.md](AI-VS-DETERMINISTIC.md) |
| **Illustrated sprites, day and night, seasons** | The art is the long pole; it can replace procedural SVG without touching the mapping. An aurora for a calm book was **dropped**: it reads as a reward |

## Decisions for Faiz

1. **Approve, trim or reorder** Sprints 23–26. Nothing starts before the walkthrough feedback unless you say so.
2. **G14a early?** Recommended: yes, because the history can only start when the snapshots do.
3. **G19:** ok to add one small table for competence marks?
4. **Thresholds** (still open from G8 and G9): keep `market-v1` and `realm-v1` in the frontend, or move to the backend's versioned mapping? Recommendation unchanged: keep while game mode is frozen.
5. **Tax collector:** do you want it, and which accounts would it cover?
