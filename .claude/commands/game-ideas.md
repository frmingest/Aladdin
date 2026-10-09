---
description: Sprint planning / idea gathering for game mode, every idea with a visual verb and a page
---
Gather game ideas for the next sprint. Inputs: `docs/PROGRESS.md`, `docs/game-mode-sprint-plan-v2-2026-10-08.md`, `docs/game-mode-team-review-2026-10-09.md`, `docs/game-sprint-checklist.md`, `.claude/standards/game-visual-identity.md` (section 4 direction memory), and any user argument. First verify built-vs-claimed with `git status`, `git log --oneline -15` and `grep`/`find` (CLAUDE.md status honesty).
1. `game-designer` proposes ideas from the open items, the unaudited pages and identity debt (pages scoring 0-1), each in one row: `ID | page | player verb | real fact (fidelity Real/Partial/Missing) | VISUAL VERB + SCENE | words it deletes | identity score before -> after | size | rule risks`.
2. Art lens: `game-ux-designer` (identity lane, read-only) scores each idea's visual: does it use kit pieces, encode a fact, avoid the anti-patterns? Rejects any idea whose only UI is a Card, list or table, or whose visual flatters unknown data.
3. Output a ranked list in which every idea has a visual verb and a page, plus at least one "visual win" per sprint that touches no mechanics (raise a 0-1 page to 2), and the cut list. Include a draft answer to `docs/game-sprint-checklist.md` section A and a "decisions for Faiz" list.
Write the result to `docs/game-ideas-<date>.md`; do not edit application code. Ideas that reward trading, return visits, speed or streaks are dropped and named as dropped.
