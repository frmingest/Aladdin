# Sprint 23: Hype and stress (game mode G12 + G13) — 2026-10-03

Status: **built, PR open, not merged, not deployed.** Faiz said "start developing next phase of the game mode", so
Sprint 23 of the [proposed plan](game-mode-next-ideas-2026-10-03.md) was started (the earlier "frozen until the
walkthrough" note is superseded by that instruction). Branch `feature/game-mode-sprint-23-hype-and-stress`, off `main` `5e0a7ae`.
G14a (nightly game-state snapshot) was **not** started; it is the next small item.

## G13 Siege Simulator

Pick a market fall and see which towers it reaches. A what-if over stored data, never a forecast.

- **Endpoint:** `GET /game/siege?market_drop=0.30` (fraction; default and range from the versioned file; outside it is a 422).
  Database only: no provider call, no LLM, no write. Demo mode is checked first and uses invented betas (one demo ticker has none on purpose).
- **Maths (`services/game/siege.py`, pure):** holding shock = max(-100%, -fall x beta), beta read from the stored `beta:<TICKER>` rows
  (never refreshed here, however old; the oldest age is shown). Per-holding exposure uses the Fortress's existing 20% / 40% lines; the book
  uses the existing 25% storm and 40% siege lines (`game_mapping/v1.py`, unchanged).
- **Unknown stays unknown:** a holding with no stored beta or value is "not modelled", left out of the total and never given a default beta.
  Under 50% of value covered, the portfolio result is withheld (`unsurveyed`), while each modelled holding still shows its own what-if.
- **Reverse search:** the smallest market fall (0.1-point steps up to 100%) that reaches each line, or "no fall up to 100% reaches it".
- **Versioned file:** `domain/game_mapping/siege_scenarios_v1.py` (slider 5% to 60%, default 20%, coverage floor 50%, search step); new setting
  `active_siege_scenarios_version`. A later change to it is a v2 file.
- **Frontend:** `/fortress/siege` (nav entry in game mode, button on the Fortress toolbar): slider, two preset buttons that jump to the fall reaching
  each line (rounded up to a whole percent so they really reach it), the realm result, a strip of keeps filling with damage, and per-tower rows
  worst-first showing the Fortress's own stored stress case beside the simulated one. `lib/siege.ts` (`siege-v1`) is pure and tested.
- **Not in v1:** named macro scenarios (rates up, oil shock, NOK crash). They need a versioned per-sector sensitivity table; pairs with Sprint 21.

## G12 Hype Booth

Bring a tip from a friend, Reddit or a newsletter. Sal pitches it; the Partner reads it through the Marketplace's eight gates.

- **Entry:** a *The Hype Booth: test a tip* button beside Sal's on the Marketplace; a pop-up (`HypeBoothDialog`).
- **Flow:** ticker + who whispered it (friend, Reddit, newsletter, social media, podcast, other + optional name) → Sal's loud pitch while the stored
  picture is read → the Partner's reading.
- **A ticker the app knows** (on the street, or any holding): the same `market-v1` gates and verdict as the store page (shared `loadStore`, moved to
  `lib/marketStore.ts`), the missing pieces, a link to the store, and *Keep the tip note* (appends "Heard from X on DATE" to the existing watchlist notes).
- **A ticker the app has never seen:** honestly *Cannot judge yet*, with the four missing pieces listed. One press opens the stall (name and currency asked),
  writes the tip note, fetches Newsweb annual + half-year reports for `.OL` symbols, and queues the analysis (each step shown; a failure is a plain note,
  not a crash). It then says **nothing is analysed yet**: the analysis runs later on the PC worker. *Ask the Partner again* re-reads the store.
- **Rules kept:** the only writes are the existing add-to-watchlist, Newsweb import, queue and watchlist-notes calls; nothing bought or sold; no points,
  streaks or rewards; invented characters with a disclaimer, not quotations; tests forbid buy/sell/invest and promises; demo mode disables the form.
- **Not in v1:** looking the company name up from the ticker (no backend endpoint; that is G24), comparing tips with outcomes (G18).

## Verified

- Backend: 1,443 tests pass (36 new: 21 unit on the maths, boundaries and coverage; 15 API incl. read-only, no provider call, demo, range checks), Ruff clean.
  No migration.
- Frontend: tsc clean, ESLint 0 errors (2 existing warnings), 229 tests (21 new), production build.
- Rendered in Chromium against a mock API: Siege Simulator at desktop and phone width (two falls, preset button), Hype Booth form and the
  Cannot-judge-yet reading. **Not run against the real backend, real betas, Newsweb or the worker; not seen on Faiz's data.**

## For Faiz after merge and deploy

1. Siege Simulator only models holdings whose beta is stored. Open a holding (or the Watchlist) once, or let the worker's warm-up run, so betas exist;
   until then it will say which holdings are not modelled.
2. Try the slider and both preset buttons; tell me whether the wording, the strip and the two columns (simulated vs the Fortress's own stress case) read right.
3. Hype Booth: test one known ticker (expect the eight gates) and one new `.OL` ticker (expect Cannot judge yet, then the stall, reports and a queued run).
