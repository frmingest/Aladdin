# The nine rule contradictions: decisions (2026-11-17)

Status: written, PR open for issue #378 (PR number in the issue). Project mirror: `claude/rule-contradictions-decided-2026-11-17.md` written by the cloud session. Faiz asked Claude to decide the open items on 2026-11-17. Source of the list: `docs/ops/agentic-coding-audit-2026-11-01.md`, section "Where the rules contradict each other or can't be followed". Each decision is written in `CLAUDE.md` or the file named; rows 3 and 4 live in PR #447 and are not on `main` until it merges. Nothing here was deployed; these are rules for agents.

| # | Contradiction | Decision | Where it is written |
|---|---|---|---|
| 1 | "Update PROGRESS in the same PR" vs status honesty: `main` is always one step stale | A PR says "PR #N adds ..." and never "merged" or "done". The board issue says "written, PR open" until Faiz merges; afterwards the next session (or a docs-only `no-issue` PR) moves it to merged. `docs/PROGRESS.md` gets no status. | `CLAUDE.md` Status honesty |
| 2 | A check cannot run in the sandbox, yet "never open a PR with a known red check" | Open the PR as a **draft**, tick only what ran, name each check that was not run; CI runs it. Never target a branch whose PR is already merged. | `CLAUDE.md` Pull requests step 5 |
| 3 | "Click through it in a real browser" cannot be met for `/game3d` headless | A headless software-GL run counts as "headless only"; it is not a real-GPU look or a draw-call measurement. The real look stays Faiz's, in "After deploy (Faiz)". | `CLAUDE.md` Game mode, `.claude/standards/game3d-standard.md` (PR #447) |
| 4 | The identity standard has nothing for `/game3d` | Written: `.claude/standards/game3d-standard.md` (drafted in PR #447, not yet in `main`); Faiz approved its rules on 2026-11-17; new 3D places need a Plain view. | PR #447 |
| 5 | Rule 3 says "prompts and schemas" but the code versions game rules and words too | Extend it in writing to any `*_vN.*` rule or wording file shown to Faiz or used for a real result: a change is a new `vN+1`. Moving the registries out of `standing_v1.py` and `siege_scenarios_v1.py` is a code change, tracked in issue #449. | `CLAUDE.md` Rule 3; issue #449 |
| 6 | Docs layout names `PROGRESS.md`, `architecture.md` and "the active plan" at the root, but `README.md` is there too and the root plan is not the one being worked | Root holds `README.md`, `PROGRESS.md`, `architecture.md` and the one plan that `docs/README.md` lists under "Always-current". The sprint being worked is on the board and its plan lives in its topic folder. | `CLAUDE.md` Docs layout |
| 7 | Project instructions and `CLAUDE.md` name the progress sections differently | The `progress.md` protocol is obsolete since the board (2026-11-12). `CLAUDE.md` and the board win. Faiz can delete the "Progress Tracking Protocol" block from the claude.ai project instructions; Claude cannot edit them. | `CLAUDE.md` Sprint board rules |
| 8 | "Never merge, watch the checks" relies on timing nothing enforces | A PR states which CI jobs have finished and is not ready while any required job is pending or red. Real enforcement is branch protection on `main`, which only Faiz can set (issue #377). | `CLAUDE.md` Pull requests step 8 |
| 9 | Documentation sync needs the claude.ai project, which local sessions cannot reach | The repo `docs/` copy is the source of truth. A cloud session mirrors it in the same change; a local session writes "project mirror pending" and the next cloud session mirrors it. `docs-sync-checker` now lists unmirrored docs. | `CLAUDE.md` Documentation sync, `.claude/agents/docs-sync-checker.md` |

## Still Faiz's (Claude cannot do these)

- Turn on branch protection for `main` and require the CI jobs (issue #377).
- Optionally delete the "Progress Tracking Protocol" block from the claude.ai project instructions (decision 7).
