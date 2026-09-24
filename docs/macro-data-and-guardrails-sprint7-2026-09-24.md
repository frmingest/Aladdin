# Numeric macro data (Fed / Norges Bank) + Sprint 7 guardrail tooling

**Date:** 2026-09-24 · **Commits:** `c4b2ed2` (macro backend), `551a141` (macro UI), `f81a824` (Sprint 7) + docs · **Migration:** `a9b0c1d2e3f4` (additive) · **Status:** committed, **not pushed, not deployed**

---

## 1. Why

| Item | Background |
|---|---|
| Macro data | The analysis's macro stress test only had Gemini's search summaries. The official numbers (policy rates, yields, CPI, FX, credit spreads) were deferred twice out of Sprint 2. |
| Sprint 7 | The guardrail files from 2026-09-15 were lost in the 2026-09-21 reset. The repo had no CI, no pre-commit hooks and no secret scanning. The F4 smoke test was still open. |

---

## 2. Decision 24 (asked 2026-09-24)

| Question | Decision |
|---|---|
| Where are the numbers used? | **On the Macro page, on the dashboard and in the analysis** (evidence packet **v5** / **fund-v2**) |
| Which series? | **The core set: 13 series** (below) + 3 derived figures |

No prompt or output schema change: the prompts already ask for a macro stress test from the evidence, and the new items are cited like any other.

---

## 3. The series (catalogue `v1`, `app/domain/macro_series.py`)

| Region | Series | Publisher · id | Frequency |
|---|---|---|---|
| NO | Policy rate | Norges Bank · `IR/B.KPRA.SD.R` | daily |
| NO | NOWA overnight rate | Norges Bank · `SHORT_RATES/B.NOWA.ON.R` | daily |
| NO | 3-month T-bill | Norges Bank · `GOVT_GENERIC_RATES/B.3M.TBIL` | daily |
| NO | 10-year government bond | Norges Bank · `GOVT_GENERIC_RATES/B.10Y.GBON` | daily |
| NO | USD/NOK, EUR/NOK | Norges Bank · `EXR/B.USD.NOK.SP`, `EXR/B.EUR.NOK.SP` | daily |
| NO | CPI, 12-month change | **SSB** · table `14710` (2025=100), y/y computed | monthly |
| US | Fed funds target (upper) | FRED · `DFEDTARU` | daily |
| US | 10-year Treasury | FRED · `DGS10` | daily |
| US | Yield curve 10y − 2y | FRED · `T10Y2Y` | daily |
| US | CPI, 12-month change | FRED · `CPIAUCSL`, y/y computed | monthly |
| US | Unemployment | FRED · `UNRATE` | monthly |
| US | High-yield spread | FRED · `BAMLH0A0HYM2` | daily |
| Computed | NO real policy rate, US real policy rate, NO − US 10y | policy rate − CPI y/y; yield difference | — |

| Note | |
|---|---|
| Norway CPI comes from SSB, not FRED | The OECD copy on FRED (`NORCPIALLMINMEI`) stopped at April 2025; SSB's old table 03013 closed at Dec 2025. Table 14710 is current (Aug 2026). |
| NIBOR not included | Norges Bank doesn't publish it (it's owned by Norske Finansielle Referanser). NOWA and the 3-month T-bill cover the short end. |
| Keys | Norges Bank and SSB need no key. FRED uses the existing `FRED_API_KEY`. |
| Response formats | Checked against the live Norges Bank and SSB endpoints on 2026-09-24. This sandbox can't reach the APIs directly, so **the first real fetch happens after deploy**. |

---

## 4. What was built

### Data

| Table | Notes |
|---|---|
| `macro_observations` | Already in the database from the pre-reset Phase 4 migration, never used. Now mapped; migration adds `source_series_id`. Append-only: a new row only for a new date or a revised value |
| `macro_series_status` (new) | Last attempt, last success, last error, rows inserted, per series |

### Behaviour

| Piece | Rule |
|---|---|
| Refresh | First fetch: 3 years (+1 for y/y series). After that: re-reads 70 days to pick up revisions. One failing publisher never stops the others |
| When | (1) **Background loop in the API server** every 12 h (`MACRO_REFRESH_INTERVAL_HOURS`, 0 = off), first pass 1 min after start; (2) **before every analysis run**, stale series only (> 20 h), before the run row exists; (3) **Refresh data** button |
| Back-off | A series that failed less than 1 h ago isn't retried by every run in a queue |
| Calculations (Rule 1) | y/y from the index; 3- and 12-month change (pp for rates, % for FX); staleness (7 days daily, 60–75 days monthly); 24-month monthly history. All Python |
| Evidence (Rule 2) | One `macro_indicator` item per series, citing publisher + series id + URL; computed items show their formula and inputs; stale values say `STALE` |
| Readiness | New check "Macro data (rates, CPI, FX)", **warn only**, never blocks |
| System status | Provider row (FRED key, refresh interval) + "last successful fetch" + a row listing failing series |
| API | `GET /macro/indicators` (database only), `POST /macro/indicators/refresh[?only_stale=true]` |

### UI

- **Macro page:** new "Rates, inflation & currency" card above the Gemini research: Norway / United States / Computed tables with latest value, as-of date, stale tag, 3 and 12-month change, 24-month sparkline, publisher link, "last fetch failed" note.
- **Dashboard:** a six-number strip (policy rate, Norway CPI, Norway 10y, USD/NOK, fed funds, US 10y) linking to the Macro page.

### New settings (`backend/.env.example`)

| Variable | Default |
|---|---|
| `MACRO_DATA_PROVIDER` | `live` (`none` = don't fetch) |
| `ACTIVE_MACRO_SERIES_VERSION` | `v1` |
| `MACRO_STALE_AFTER_HOURS` | `20` |
| `MACRO_REFRESH_INTERVAL_HOURS` | `12` |
| `MACRO_HISTORY_YEARS` | `3` |

---

## 5. Sprint 7: guardrail tooling

| File | What it does |
|---|---|
| `.github/workflows/ci.yml` | On every push to `main` and every PR: **backend** (ruff + pytest), **migrations** (Postgres 16: upgrade head → downgrade −1 → upgrade, one head), **frontend** (tsc, eslint, vitest, build), **secrets** (gitleaks over full history), **dependency audit** (pip-audit + npm audit, report-only) |
| `.pre-commit-config.yaml` | On `git commit` (GitHub Desktop too): large files, private keys, merge markers, YAML/JSON/TOML syntax, ruff `--fix`, gitleaks, and two blockers: **no `.env` files**, **no `.pdf/.xlsx/.xhtml/...` outside `docs/`** |
| `.gitleaks.toml` | Default rules; allowlist only `.env.example` and the npm lockfile |
| `backend/requirements-dev.txt` | ruff 0.16.8, pre-commit, pip-audit (pinned) |
| `backend/pyproject.toml` | Migrations excluded from ruff (frozen history) |
| `frontend/vitest.config.ts`, `src/lib/format.test.ts` | First frontend unit tests (`npm test`) |
| `frontend/e2e/smoke.spec.ts`, `playwright.config.ts` | **F4 smoke test** (`npm run smoke`) |
| `.github/workflows/smoke.yml` | Runs the smoke test after a Railway deployment, daily at 07:30 and on demand |
| `CLAUDE.md` | New "Guardrail tooling" section |

### The smoke test is read-only

| Guard | How |
|---|---|
| Changes nothing | Every non-GET request from the pages is aborted |
| Spends no Gemini quota | `/research/*` is answered locally (a stale GET there would start a Gemini call) |
| Fails on | API down, database down, **migration ≠ code**, a page crash, an API 5xx on a page |
| Reports, doesn't fail | System status issues and 503 "provider not configured" become warnings in the report |

---

## 6. Verification

| Check | Result |
|---|---|
| Backend tests | **678 passed** (29 new: 24 macro unit, 2 macro API, 2 readiness, 1 analysis run end-to-end) |
| Ruff | Repo clean with ruff 0.16.8 (fixed 20 small findings; migrations excluded) |
| Migration | `a9b0c1d2e3f4` on Postgres 16: up, down, up; a pre-existing legacy row survives |
| End to end | Local backend + Postgres + Vite: refresh with a fake publisher, indicators, evidence text, Macro page screenshot |
| Frontend | tsc, eslint, 6 vitest tests, vite build clean |
| Smoke test | 16/16 pass against the local stack; 16/16 fail with the backend stopped |
| Secrets | gitleaks: 141 commits, **no leaks**; a planted fake key is caught |
| Workflows | actionlint clean. **Not yet run on GitHub** |
| Pre-commit | All hooks pass on the whole repo (gitleaks hook not run here: it builds with Go and the sandbox blocks the Go proxy; it runs in CI) |
| Live | ❌ Norges Bank / FRED / SSB not reached from this sandbox (blocked). First real fetch after deploy |

---

## 7. What Faiz needs to do

| # | Action |
|---|---|
| 1 | Copy the changed files into `E:\Aladdin` (zip from the chat), commit in GitHub Desktop, push. Railway runs migration `a9b0c1d2e3f4` (additive) on start |
| 2 | After deploy: **Macro → Refresh data**. Expect 13 "updated". If the 6 US series fail: `FRED_API_KEY` is missing in Railway |
| 3 | GitHub → Settings → Secrets and variables → Actions → **Variables**: add `SMOKE_FRONTEND_URL` and `SMOKE_API_URL` (the two Railway URLs). Then Actions → Smoke test → Run workflow |
| 4 | Once, on the PC: `pip install -r backend\requirements-dev.txt` then `pre-commit install` (from `E:\Aladdin`). First commit after that is slower: pre-commit downloads ruff and Go for gitleaks |
| 5 | After CI has been green a few times: GitHub → Settings → Branches → require the CI checks on `main` |
| 6 | Restart the worker on the PC so it also refreshes macro data before a run |

---

## 8. Not done / next

| Item | Why |
|---|---|
| Rate-sensitivity per holding (e.g. how much of a company's debt is floating) | Needs debt-maturity data from the filings; the numbers are now there to compare against |
| More series (Norway core CPI, house prices, oil price, ECB rate) | Add as catalogue `v2` (Rule 3) when an analysis needs them |
| Dependency audit → blocking | Make it blocking after it has run clean for a while |
| mypy in CI | Not configured in the repo today; add once the baseline is clean |
