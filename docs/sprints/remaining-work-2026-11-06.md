# Remaining work (2026-11-06)

One place for what is still open. It replaces three plans that were archived on 2026-11-06: the [game design plan](../archive/game-design-sprint-plan-2026-10-15.md) (parked), the [hardening sprint](../archive/hardening-sprint-2026-10-12.md) (closed) and the [Sprint 15 plan](../archive/sprint15-plan-and-quarterly-review-2026-09-26.md) (closed). The 3D plans stay where they are under `docs/game/` and are linked, not copied. Short checklists only; history lives in the archive. Built or not built was checked on `origin/main` at `a094396` (#300) by grep, not in a browser.

## 1. 3D (active)

Merged: S21 to S27, S28 (as A5), S29 (#300), S30 (as A6), S31 outdoor holdings, A1 to A8, text passes 1 to 3. Plans: [discovery](../game/game3d-discovery-sprint-plan-2026-11-02.md), [assets](../game/game3d-asset-sprint-plan-2026-11-04.md), [outdoor holdings](../game/game3d-outdoor-holdings-sprint-plan-2026-11-04.md).

- [ ] **Hall of Records (idea, Faiz 2026-11-06, not specced).** A 3D place that shows a lot of interest-rate and macro data, with room to grow later. First step is a short design note, not code: how it relates to the Town Hall's Macro board and the Records Hall that PROGRESS listed as next, which series it shows (the macro catalogue and the Norway curve already store several), and the rule that the room carries no fact in its art. Needs a visual verb and scene line and an identity score (CLAUDE.md).
- [ ] **Polish pass (approved, "yes").** From the discovery plan: one outline style on town buildings, softer shadows and sky, doors that swing, chimney smoke and forge sparks, sound only if switched on. Not checked line by line against the code; the first PR should print what already exists.
- [ ] **Text pass 4.** Vault, Night Watch, ravens, Realm panel, store gates, backend-written text, the failed look-back save, Sal and Hype Booth speech, Where-to names, `stormDrillWordsV1`. Faiz decides what "Last verdict" on the Land shelf says ([review](../game/game3d-text-review-2026-11-03.md)).
- [ ] **Store interior (D11).** Optional, from the Market Quarter plan; cut first if time is short.
- [ ] **Look-over (Faiz):** S29 battlefield in `/game3d`, then press P for fps.
- Ideas not built: Storm Drill camp following the siege level; an Oracle line pointing at the drill post; the Quest log "Done!" pill wrapping on a phone.

## 2. Analysis depth (active, from the Sprint 15 plan)

- [ ] **Rate sensitivity per holding.** Floating against fixed debt, refinancing wall against the policy-rate and yield series already ingested. No code exists. Natural data source for the Hall of Records above.
- [ ] **PDF memo.** One holding or the whole portfolio, from an analysis run. No code exists.
- Backlog, unchanged: fund annual-report holdings parser, fund look-through valuation, liquidity tier for whisky and metals, alerts delivery channel (email or push, Faiz to pick).

## 3. Flat Game mode (parked)

Parked 2026-11-06. E4 The Three Baskets, E5 Voices in the Margin and bucket B1 to B13 are in the archived plan, never started. E1 to E3 were built and removed on 2026-10-16.

## 4. Hardening leftovers

- [ ] Backend mypy: 166 findings, report-only job. Make it blocking at zero ([note](../ops/mypy-report-only-2026-10-14.md)).
- [ ] Fortress performance (flat page): 73 to 82 on Lighthouse mobile.
- [ ] Dashboard macro chart showed only the original six series; never re-checked after the rebuild.
- [ ] ECON-007, regime-aware risk bands.
- [ ] Visual-regression baselines, and the browser specs against the live site (`SMOKE_FRONTEND_URL`, `SMOKE_API_URL`).
- [ ] No branch protection on `main` (agentic-coding audit, [doc](../ops/agentic-coding-audit-2026-11-01.md)).

## 5. Data chores (Faiz)

Newsweb watch job should be green on System status (#195); press *Fetch all reports* on JAREN.OL (#194); The Printer needs a call on how to get amounts ([plan](../game/the-printer-sprint-plan-2026-10-20.md)); clear the Supabase leftovers in `backend/.env.example` and the `config/database.py` docstring.
