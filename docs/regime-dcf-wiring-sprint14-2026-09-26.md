# Sprint 14: regime → DCF discount-rate wiring (2026-09-26)

Backlog item "Regime → DCF factor-weight wiring", deferred at Sprint 12 as Faiz's call: the
regime classifier (baseline/stagflation/crisis) existed but was surfaced as information only,
with no effect on any valuation. Faiz picked this item to build next (2026-09-26 session).

**Status:** built, tested and **pushed to `origin/main`** (`b7a0398`, on top of `6887b10`) —
not yet deployed/verified live. **No migration** — nothing new is persisted.

---

## 1. What you get

| Capability | What it does |
|---|---|
| **Regime-adjusted discount rate (off by default)** | A new setting, `REGIME_ADJUSTED_DCF_ENABLED` (Railway env var), defaults to `false` — nothing changes until you turn it on. When `true`, every holding's DCF discount rate is widened by a per-regime add-on before the DCF runs |
| **Sizing** | baseline **+0bps**, stagflation **+150bps**, crisis **+300bps** — versioned constants in `app/domain/regime_adjustments/v1.py`, mirroring the existing `valuation_assumptions` pattern (CLAUDE.md Rule 3: a v2 would add a new file, never edit v1's numbers once used) |
| **Full transparency, everywhere a DCF shows up** | Holding valuation panel, margin-of-safety board, the LLM's evidence packet, and System status all show both the plain CAPM rate and the regime-widened rate — nothing is silently changed |
| **System status row** | New "Regime-adjusted DCF" row: `off` when disabled, or `<regime> (+X.XXpp)` when enabled, using the same regime classifier the Portfolio risk page shows |

**Why a discount-rate add-on and not a growth-rate haircut:** `app/services/risk/regime.py`'s
own explanation text already argued for this — stagflation: "a higher terminal discount rate is
more defensible than the baseline assumption"; crisis: "discount rates used for valuation should
reflect wider spreads, not just the risk-free rate." Sprint 14 wires exactly that, rather than
inventing a separate mechanism.

**What this changes when turned on:** every equity's DCF intrinsic value (bear/base/bull) goes
down a bit — a higher discount rate means a lower present value of the same projected cash flows.
The margin-of-safety board's zone classification (below bear / bear-to-base / etc.) can shift
holdings between zones. This is the real behavior change Sprint 12 flagged — that's why it's
off by default and clearly labeled everywhere it applies.

---

## 2. Try it (once you decide to turn it on)

1. In Railway, set `REGIME_ADJUSTED_DCF_ENABLED=true` on the backend service and redeploy.
2. Open **System status** — the new "Regime-adjusted DCF" row should show the current regime
   and add-on (e.g. `baseline (+0.00pp)` most of the time).
3. Open any holding's **Valuation** panel — the "Discount rate (CAPM)" tile's hint should read
   e.g. `8.50% base, +0.00% for baseline regime` (no visible change when baseline).
4. Open **Margin of safety** — when the regime isn't baseline, a banner at the top says so and
   links to Portfolio risk.
5. If a crisis or stagflation regime is ever live, compare the before/after bear/base/bull values
   on a couple of holdings you know well — does the widened rate feel like the right size, too
   aggressive, or too tame? The 150bps/300bps sizing is a judgment call (see the module
   docstring), easy to retune in a v2 without touching v1.

---

## 3. What was actually built

**Backend:** `app/domain/regime_adjustments/{__init__,v1,value_types}.py` (new, versioned,
mirrors `valuation_assumptions`); `Settings.regime_adjusted_dcf_enabled` (default `False`) and
`active_regime_adjustment_version` (default `"v1"`); `HoldingValuationResult` gains
`base_discount_rate`, `regime`, `regime_discount_rate_addon`, `regime_adjustments_version`;
`compute_holding_valuation` calls `classify_regime(db)` (Sprint 12, DB-only, no external call)
only when the feature is on, and widens `discount_rate` before the DCF runs; `board.py`,
`api/valuation.py`, `schemas/valuation.py` carry the new fields through to the API;
`evidence_packet.py` tells the LLM when and by how much the rate was widened; `system_status.py`
gets a new status row.

**Frontend:** `lib/types.ts` (new optional fields on `HoldingValuation` and `BoardRow`, reusing
Sprint 12's `MacroRegime` type); `ValuationPanel.tsx` shows the widened rate in the discount-rate
tile and the DCF scenarios caption; `MarginOfSafetyPage.tsx` shows a one-line banner when the
feature is active, linking to Portfolio risk.

---

## 4. Tests

| | |
|---|---|
| Backend | **8 new tests**: 3 in `test_regime_adjustments.py` (version lookup, non-negative/ordered add-ons), 3 in `test_holding_valuation.py` (off by default matches base rate; crisis widens by exactly 300bps end-to-end into the DCF; baseline regime leaves the rate unchanged and adds no noisy note), 2 in `test_system_status.py` (off by default; shows the current regime when enabled). `test_valuation_board.py`'s existing fake-valuation fixtures updated with the two new fields. Full suite: **851 passed** (the same 2 pre-existing, env-dependent `test_factory.py` failures as before this sprint, unrelated to this work) |
| Ruff | Clean after `--fix` (import ordering, verbose `Decimal("0")` → `Decimal(0)`). Remaining `EXE002` findings are the same repo-wide, pre-existing mount-permission artifact noted in Sprint 12 |
| Frontend | `tsc --noEmit`, `eslint`, `vitest` (19 pre-existing, unchanged), `vite build` — all clean |
| Migration | None — nothing new is persisted; `alembic heads` still shows one head (`a3f5c8d1e942`) |

---

## 5. Not done / left for later

| Item | Note |
|---|---|
| Sizing the add-on off the actual HY spread level | v1 uses fixed round-number constants (0/150/300bps) rather than a continuous function of the spread — a documented simplification, not an oversight (see `v1.py`'s docstring) |
| Growth-rate (rather than discount-rate) adjustment | Not built — the regime classifier's own text pointed at the discount rate, and adjusting growth too would be two behavior changes bundled into one, harder to reason about |
| Wiring into the reverse-DCF or the thesis-tracking "price outside DCF range" tripwire | Both already read `result.discount_rate` indirectly through the DCF scenarios, so they inherit the widened rate automatically once enabled — no separate change needed, but worth confirming when you turn it on |
