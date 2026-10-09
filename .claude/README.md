# .claude — Aladdin agent team

Assessment and rationale: [docs/claude-setup-assessment-2026-10-09.md](../docs/claude-setup-assessment-2026-10-09.md).

- `agents/` — 8 subagents: verifiers (`rules-auditor`, `docs-sync-checker`, `game-ux-designer`, `playtest-qa`), implementers (`backend-engineer`, `frontend-engineer`, `game-feel-engineer`), design (`game-designer`).
- `standards/` — `aladdin-rules.md`, `game-ui-standards.md` and `game-visual-identity.md` (identity ladder, kit contract); checkable "what correct looks like"; CLAUDE.md stays the source of truth.
- `skills/` — game design (reward knowing, never trading), game UX/accessibility, game feel/performance, game visual identity (page scenes from real data).
- `commands/` — `/ship-pr`, `/game-review` (now with an identity table), `/game-ideas` (idea gathering, each idea has a page and a visual verb). Sprint gate: `docs/game-sprint-checklist.md`.
- `hooks/` + `settings.json` — blocks in-place edits of tracked prompt files (Rule 3); denies `.env`/PDF reads, force-push, hard reset.

Flow: main session orchestrates -> engineers implement -> verifiers review -> fixes go back -> re-run only failed checks (max 2 rounds, then ask Faiz). Verifiers never edit code.
