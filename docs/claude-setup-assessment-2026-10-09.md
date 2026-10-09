# Claude setup assessment and proposal — 2026-10-09

Status: **installed on a PR branch (`feature/claude-agent-team-and-game-skills`), not merged, not yet tried in a real session.** Files live in `.claude/` (agents, standards, skills, commands, hooks, settings). Sources: the Reddit post "How my multi agent system works" (text pasted by Faiz; the Reddit page itself is blocked from the cloud session), `CLAUDE.md`, `docs/agentic-coding-audit-2026-09-27.md`, `docs/game-mode-sprint-plan-v2-2026-10-08.md`, the repo tree, and the account's skill list. Nothing was run in a browser.

## 1. What the Reddit system is

A PM agent over ~16 role agents (backend, db, frontend, QA, UI, UX, design-review, security, architect, devops, scripts, bugfixer, meta). Its real value is not the roster, it is three ideas:
1. **Docs are the standard.** `.claude/standards/*.md` define "correct"; a read-only standards agent checks code against them and writes a fix plan with current-vs-required code.
2. **Verification loops.** After an engineer finishes, verifiers run (standards, workflow vs documented state machines); violations go back to the specialist; re-verify until clean.
3. **Work tracking as files.** PM agent keeps tasks/bugs/features as markdown with frontmatter.

"Autonomous triggering" is Claude delegating to subagents by their `description`; it is not a separate runtime, and long chains cost tokens and can loop.

## 2. Where Aladdin stands

| Reddit idea | Aladdin today | Verdict |
|---|---|---|
| Standards as docs | `CLAUDE.md` (5 architecture rules, git, PR, status honesty) + `docs/architecture.md` | Strong, but prose only: no checkable pattern file, no agent that reads it |
| Verification layer | CI (ruff, pytest, migrations up/down/up, tsc, eslint, vitest, build, gitleaks), pre-commit, read-only smoke test | **Stronger than Reddit for mechanical checks.** Missing: semantic checks of Rules 1–5 (math in LLM, widened citations, in-place prompt edits, blind-pass leakage) |
| Workflow agent vs documented flows | Rules enforced partly by tests; the 2026-09-27 audit confirmed them by hand | No standing reviewer; audit was a one-off |
| PM / tracking | `progress.md` + `docs/PROGRESS.md` + sprint docs, by hand | Works but drifts: 2026-09-26 "built" sprint with no code; 2026-09-27 mirror drift (the 100-line rule has since been added to CLAUDE.md and the repo copy is now 36 lines, so size is fixed; drift is still checked by memory) |
| Role specialists | None in repo. No `.claude/` directory at all (no agents, skills, hooks, commands, settings). Parallel work is via `.claude-wt` worktrees | Gap, but a 16-agent roster is overkill for one developer |
| UX/design review | Account-level skill `cwo-ux-designer` | **Wrong fit:** it enforces the CWO finance-terminal look, not Aladdin's painted-fortress game mode |
| Game skills | Account-level `mobile-game-dev` | **Wrong fit:** Unity/C#/app-store focused; Aladdin game mode is React + SVG/CSS + a sound mixer |
| QA | `qa-testlead` (CWO-aware), vitest, one smoke spec | Game pages have 0 smoke coverage; art, motion, sound and phone frame-rate have no automated check; game plan v2 says nothing was seen in a browser |
| Meta agent | `skill-creator` | Sufficient |
| Account skills are not versioned with the repo | 8+ account skills (code-auditor, expert-developer, warren-munger, …) | Not visible to other sessions/cloud runs unless in the repo; they can drift from CLAUDE.md |

**Overall:** the guardrails (CI, hooks, rules, honesty about status) are better than the Reddit setup. The weaknesses are (a) rules live only as prose, so no independent reviewer applies them to a diff, (b) status/doc drift is policed by memory, (c) nothing in the setup knows how to design, review or test a *game* UI, and the two nearest skills are for other products.

## 3. Recommendation: lean, verifier-heavy, not 16 agents

Keep the main session as orchestrator (it already is the PM; progress docs stay the tracker). Add **8 agents**: independent verifiers (read-only, so they do not grade their own work) plus a few implementers.

| Agent | Role | Write access |
|---|---|---|
| `rules-auditor` | Rules 1–5, migrations, destructive endpoints; fix plan with code | none |
| `docs-sync-checker` | Verifies "built/committed" claims with git, mirror rule, progress size | none |
| `backend-engineer` | FastAPI/Alembic/pipeline, runs CI-equivalent checks | yes |
| `frontend-engineer` | React/Vite/Tailwind; game components via pure `lib/` mappers | yes |
| `game-designer` (opus) | Specs, "reward knowing, never trading" principle | docs only |
| `game-ux-designer` | First-run, hierarchy, noise, colour-blind, reduced motion, mobile | none |
| `game-feel-engineer` | Motion, SVG/CSS, sound, performance budgets | yes |
| `playtest-qa` | Playwright screenshots, phone profile, console, reduced motion | none |

Supporting pieces in the pack: `standards/aladdin-rules.md` and `standards/game-ui-standards.md` (the "docs = source of truth" layer), three repo-local skills (`game-design-reward-knowing`, `game-ux-onboarding-accessibility`, `game-feel-and-performance`), slash commands `/ship-pr` and `/game-review`, and a `settings.json` with a PreToolUse hook that blocks in-place edits of tracked prompt files (Rule 3) plus deny rules for `.env`, PDFs, force-push and hard reset.

**Flow:** you request a feature → main (plus `game-designer` spec for game ideas) → engineers implement → `rules-auditor` and, for UI, `game-ux-designer` + `playtest-qa` → fixes go back to the engineer → re-run only failed checks → `docs-sync-checker` → `/ship-pr`. Cap the loop at 2 fix rounds, then stop and ask.

### Game-dev content that is specific to Aladdin
- **Reward knowing, never trading** (from game plan v2, D1): progress is fog lifting, scrolls read, reviews written; can regress when data is stale; no streaks/timers/loot/leaderboards.
- **Truth over flattery for art:** juice and fantasy may never make a weak or unknown holding look good.
- **Accessibility gap found:** status colours with no colour-blind pass found in the code (search for "colorblind" returned nothing); `prefers-reduced-motion` appears in only 3 files against a scene with ~7 filter definitions and many loops.
- **Performance budget:** compositor-only animation, no animated SVG filters, phone profile with 4x CPU throttle; game plan v2 notes frame rate is unmeasured.
- **Onboarding:** v2 found no first-run guide.

## 4. Decisions for Faiz
1. Merge the PR (a merge to `main` only adds files under `.claude/` and docs; no production behaviour changes).
2. Keep account skills `cwo-ux-designer`, `mobile-game-dev` for their own products only, and stop relying on them here?
3. Add read-only game pages to `smoke.spec.ts` (demo data only)?
4. Tune after first use: which verifiers are worth their tokens (keep `rules-auditor` and `docs-sync-checker` always on; use the game ones only for game UI).

## 5. Risks and limits
- Subagent definitions here are drafts, untried; model choices and tool lists should be tuned after first runs.
- Each verifier adds tokens and time; use `/game-review` only for game UI changes, `rules-auditor` for backend/prompt changes.
- The Reddit post was read from pasted text only; its comments were not seen.
