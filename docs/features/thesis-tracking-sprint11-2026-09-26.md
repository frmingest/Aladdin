# Sprint 11: thesis tracking over time (2026-09-26)

Answers one Buffett question per holding: **is my thesis still intact?** Every analysis already ends
with *invalidation triggers* and *metrics to monitor*, but they were free text that nothing ever
checked. Now you can turn them into **tripwires** that the app checks with its own figures, see
**what changed since the latest analysis**, and follow the **verdict timeline**.

Also fixed the known issue where a holding with no DCF showed **"No price"**.

**Status:** built and committed locally this session — **not pushed, not deployed.**

> ⚠️ **Correction to an earlier version of this doc.** A prior session wrote this page as if the
> feature were already built and just sitting as uncommitted changes. That was wrong: nothing had
> actually been written to `E:\Aladdin` — `git status` was clean at Sprint 10 (`176721f`) with no
> `thesis` model/service/api/frontend anywhere in the tree. This was caught at the start of today's
> session and the feature was built for real from scratch against the current codebase. Lesson
> applied: CLAUDE.md's status-honesty rule now matters even more — this doc only states what was
> actually run and observed today.

---

## 1. What you get

| Where | What |
|---|---|
| **Holding page → Thesis tracking** (under the analysis) | Status pill, "What changed since the latest analysis", your tripwires with today's value, suggestions from the latest analysis ("Make a tripwire"), verdict timeline |
| **Thesis monitor** (nav) | One row per owned stock/fund, plus any holding with a tripwire, most urgent first |
| **Dashboard** | A "Thesis check" card, shown only when a tripwire has fired or a holding needs review |
| **System status** | New row: active/firing tripwire count |

### Thesis status (most urgent first)

| Status | Meaning |
|---|---|
| 🔴 **Tripwire fired** | At least one active tripwire is crossed |
| 🟠 **Review** | Nothing fired, but something the latest analysis couldn't have seen has changed |
| ⚪ **Not analyzed** | No usable analysis run yet |
| 🟢 **Intact** | Analyzed, nothing firing, nothing new |

---

## 2. Tripwires

A tripwire is **your** rule: *metric · below/above · threshold*. Checked by deterministic code
(reuses `services/metrics.py` directly — CLAUDE.md Rule 1: the LLM never checks one) every time it's
read.

**Metrics watchable:** fundamentals (ROIC, ROCE, ROE, gross/operating/net margin, revenue growth,
FCF, owner earnings, net debt, net debt/EBITDA, interest coverage, debt/equity), market multiples
(P/E, P/B, EV/EBITDA, FCF yield), and price (share price, price change since the analysis).

**Firing rules:** strict crossing → fired (date recorded); back on the right side → cleared;
un-computable → "no data" + reason, but an existing firing is **not** cleared; editing the
threshold/operator or pausing clears the firing (it belonged to the old rule).

**Make a tripwire:** pattern-matches a sentence from the latest run's invalidation triggers /
metrics-to-monitor (e.g. *"Net debt/EBITDA rises above 2.5x"* → metric · above · 2.5). Regex only,
no LLM call; falls back to a blank form when it can't parse.

---

## 3. "What changed since the latest analysis"

| Reason | Rule |
|---|---|
| Age | Latest analysis ≥ **180 days** old |
| New figures | Financial facts stored after the run started |
| New documents | Files uploaded after the run started |
| Notes changed | Notes edited after the run (compared against the run's stored snapshot) |
| Big price move | ≥ **20%** either way since the analysis day |
| Outside the analysis's range | Price below the run's DCF bear value or above its bull value |

Both thresholds are named constants in `services/thesis/history.py`.

---

## 4. Verdict timeline

Read straight from `equity_analysis_runs` (every verdict already stored in full) — no new storage
for this. Newest first: date, verdict + direction vs. the previous run, moat + direction, price that
day, DCF range, blind-only vs. after-notes, cloud vs. local engine, model, top thesis bullets.

---

## 5. Known-issue fix: price without a DCF

The valuation/margin-of-safety code stopped before fetching a price when a holding didn't have
enough for a DCF (2+ years of financials, share count, risk-free rate). Fixed in
`services/valuation/holding_valuation.py`: the price is still fetched and converted; the board now
says **"No DCF yet"** when a price exists but no DCF does, instead of "No price".

---

## 6. What was actually built

**Backend** (commit `88e77e2`): `app/models/thesis.py`, `app/schemas/thesis.py`, `app/api/thesis.py`,
`app/services/thesis/{__init__,prices,metrics_registry,tripwires,history,timeline,monitor}.py`;
migration `c7a1e9f3b2d5` (down-revision `b1c2d3e4f5a6`, additive — new table `thesis_tripwires`
only); edits to `app/main.py`, `app/models/__init__.py`, `app/services/deletion.py` (tripwires
cascade-delete with the holding, kept on a "delete all data" re-upload), `app/services/system_status.py`,
`app/services/valuation/holding_valuation.py` (the price-without-DCF fix); new tests
`tests/unit/test_thesis_{tripwires,metrics_registry,history,timeline,monitor}.py`,
`tests/integration/test_thesis_api.py`.

**Frontend** (commit `fbb2afe`): new `pages/ThesisMonitorPage.tsx`, `components/ThesisPanel.tsx`;
edits to `App.tsx`, `components/Layout.tsx` (nav item live), `lib/api.ts`, `lib/types.ts`,
`pages/DashboardPage.tsx` (Thesis check card), `pages/HoldingDetailPage.tsx` (Thesis tracking
section), `pages/MarginOfSafetyPage.tsx` ("No DCF yet" display).

### API

| Method | Path |
|---|---|
| GET | `/thesis/metrics` |
| GET | `/thesis/holdings/{id}` |
| POST | `/thesis/holdings/{id}/tripwires` |
| PATCH | `/thesis/tripwires/{id}` |
| POST | `/thesis/tripwires/{id}/acknowledge` (409 if not firing) |
| DELETE | `/thesis/tripwires/{id}?confirm=true` (400 without `confirm`) |
| GET | `/thesis/monitor` |

---

## 7. Tests — what was actually run today

| | |
|---|---|
| Backend | **797/800 pass.** The 3 failures were verified (via `git stash`) to pre-exist on the unmodified Sprint 10 tree — unrelated to this work |
| Frontend | `tsc --noEmit`, `eslint`, `vitest` (19 pre-existing tests, all passing), `vite build` — all clean. **No new frontend tests added**: the existing vitest setup only covers pure `src/lib/*.ts` utilities, no component-test harness exists to extend, so this was a scoped decision, not an oversight |
| Migration | Structurally verified (single `alembic heads`) only. **Not run up/down/up against real Postgres** — the build session had no Postgres/Docker/root access. **Faiz: run `alembic upgrade head` / `downgrade -1` / `upgrade head` against real Postgres before trusting this in production**, same as CI would |

---

## 8. Try it (after push + redeploy + migration)

1. Open a holding with a completed analysis → **Thesis tracking**.
2. Click **Make a tripwire** next to an invalidation trigger, check the pre-filled rule, save.
3. Open **Thesis monitor** in the nav.
4. Tell me which triggers didn't pre-fill well, and whether 180 days / 20% feel right.

## 9. Not done (backlog)

| Item | Note |
|---|---|
| Alerts / notifications | Tripwires store `fired_at`; needs a delivery channel (email/push) |
| Qualitative triggers | "Management changes" can't be a number; could be checked against Newsweb announcements |
| Scheduled re-check | Tripwires are checked when a page opens; the PC worker could check nightly |
