# Sprint board on GitHub Projects (2026-11-12)

The sprint backlog and the sprint history live on the GitHub Project **Aladdin** (user project of `frmingest`, free tier). This replaces the rolling `docs/PROGRESS.md` log.

## The model

| Thing | Where it lives |
|---|---|
| A sprint | A **milestone** on the repo. Closed milestones are finished sprints. |
| A work item | An **issue**. Open = to do, closed = done. |
| Finished code | A **PR**, attached to the sprint milestone, with `Closes #N` in its body. |
| Where an item is in the flow | The Project **Status** field: Backlog, Ready, In progress, In review, Done. |
| Who it needs | Labels `owner:faiz` or `owner:claude`, plus `needs-decision` when blocked on a call. |
| What part of the app | Labels `area:3d-game`, `area:flat-game`, `area:backend`, `area:data`, `area:ci-ops`, `area:docs`. |

## History (imported 2026-11-12)

37 closed milestones titled `YYYY-MM-DD · name`, each with one closed issue `Sprint: name` that lists its PRs and the docs written in that window. All 333 PRs are attached to their milestone. The grouping was done from PR numbers and titles; the S/A/G codes in PR titles come from the older plans and do not match the milestone names. Written write-ups stay under `docs/`; `docs/archive/progress-archive.md` and `docs/archive/PROGRESS-snapshot-2026-11-12.md` keep the old log.

## The rule

All development happens from the board. Every branch and PR maps to an issue (`Closes #N` in the PR body); the *PR has a linked issue* check fails a PR without one unless it carries the `no-issue` label. If Faiz asks for something new, Claude opens the issue first.

## Running a sprint

1. **Plan.** Create a milestone `YYYY-MM-DD · short name` with a one-line description. Move the chosen backlog items into it (Status: Ready).
2. **Work.** One branch and PR per item or small group. PR body ends with `Closes #N`. Status moves to In progress, then In review.
3. **Finish.** Merging the PR closes the issue and moves it to Done (built-in Project workflows). When all items are closed, close the milestone and add a short note to its description.
4. **New work found on the way.** Open an issue from the *Work item* or *Bug* template; it lands in Backlog.

## Board views

- **Board** (default): columns by Status, filtered to the open sprint milestone.
- **Backlog**: table, `is:open no:milestone`, grouped by Area.
- **Needs Faiz**: table, `is:open label:owner:faiz`.
- **History**: table grouped by Milestone, `is:closed`.

## Limits of this setup

Creating the Project itself needs the GitHub web UI; Claude Code cloud sessions cannot call the Projects GraphQL API. Issues, milestones, labels and PR links are done through the repo REST API. The Project's *Auto-add to project* workflow (filter `is:issue,pr`) puts every new or updated issue and PR on the board; the built-in workflows move closed issues and merged PRs to Done. Status (Backlog, Ready, In progress, In review) is moved by hand on the board.
