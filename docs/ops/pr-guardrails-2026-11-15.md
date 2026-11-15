# PR guardrails: template and reviewers are enforced, not just written (2026-11-15)

Status: **written, not merged.** Issue #428.

## What went wrong

PR #427 was opened by hand through the API (by the agent, in the 2026-11-15 session) with a free-form body; Faiz asked whether the template had been used, and the body was then rewritten to the template. `.github/pull_request_template.md` and the `/ship-pr` command already existed, but CLAUDE.md "Pull requests" never mentioned either, nothing checked the body, and the review agents did not run until Faiz pointed it out. In the same PR a doc made a claim (a change "helps the Toll Gate most") that was never run against the engine and was wrong.

## What now stops it (three layers)

1. **The rules.** CLAUDE.md "Pull requests" now says: use `/ship-pr`, never open a PR by hand, the body is the filled-in template, run the reviewers the change needs, and check every claim against the code in the same session. `/ship-pr` is corrected (it still told the agent to update `docs/PROGRESS.md`, which is only a pointer to the board now) and starts by reading the template.
2. **A hook before the PR exists.** A guard against honest mistakes, not a security boundary: it looks at the start of each command segment, so `GH=gh; $GH pr create` gets past it, and CI is the backstop. `.claude/hooks/require_pr_template.py`, registered in `.claude/settings.json` for Bash, refuses (exit 2, with the reasons) to create or edit a PR through `gh pr create|edit`, or a write to `pulls` / `pulls/<n>` through `gh api` or curl, when the body is not the filled-in template. It reads the body from `--input`, `--body-file`, `-F body=@file` or the command text. Edits that carry no body (closing a PR, a milestone) pass, and so do commands that merely mention `gh pr create` in a commit message or echo. It also catches a GraphQL `createPullRequest` / `updatePullRequest` and a python script posting to the pulls endpoint. If it cannot list the changed files (no `origin/main` or `main`) it prints a warning and skips only the rules that depend on them; CI still checks those. A stdin it cannot parse is passed through, never blocked.
3. **A CI check after.** The job "PR template filled" (`.github/workflows/pr-template.yml`) runs the same checker on every PR event. The `no-issue` label (typo or link fix) skips it, as it does the linked-issue check.

## What the checker requires (`.github/scripts/check_pr_template.py`)

- The four template sections exist; no HTML placeholder comment is left; "What changed and why" and "After deploy (Faiz)" are not empty.
- "How it was verified": at least one box ticked, every unticked box says why, "Seen in a browser?" is answered.
- The reviewer table has all seven rows (none deleted); each says `yes` with a result, or `skipped` with a reason.
- A **backend** change cannot skip `rules-auditor`; a **backend or docs** change cannot skip `docs-sync-checker`; a **game UI** change (frontend paths with fortress or game) cannot skip the four game reviewers.
- "Implemented by:" is answered.

It checks structure and honesty, not whether the work is good. A reviewer marked `yes` that never ran is a lie the script cannot see; that stays a rule in CLAUDE.md. Tests: `backend/tests/unit/test_pr_template_check.py` (the body PR #427 first had is one of the cases that must be refused).

## What Faiz may want to do

- In GitHub branch protection for `main`, add **PR template filled** (and **PR has a linked issue**) to the required checks, so a red one blocks the merge button. This cannot be set from the agent's session.
- Claude Code normally reads `.claude/settings.json` when a session starts (not tested here), so the hook should apply to sessions started after this is merged. Until then the CI job is the backstop.
- CI runs the checker from the PR's base branch, so a PR cannot weaken the check that judges it. The one exception is the PR that introduces it, which has no base copy yet and is checked by its own.
