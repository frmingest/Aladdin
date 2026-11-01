# Agentic-coding audit — 2026-11-01

Review of every PR merged from 2026-10-13 to 2026-11-01 (#147 to #246, 97 merged PRs) against
`CLAUDE.md`, the project instructions, `.claude/standards/game-visual-identity.md` and
`docs/game/game-sprint-checklist.md`. Sources: GitHub API (PR bodies, files, check runs, merge times,
branch protection) and `git log` on `origin/main` at `3ab938c`. Read-only: nothing in the app was
changed. Previous audit: [agentic-coding-audit-2026-09-27.md](agentic-coding-audit-2026-09-27.md).

## What held

- **Architecture rules 1, 2, 4 and 5 held.** No new LLM call computes a number (The Printer engine is
  deterministic with sourced cells, #193). No file in `backend/prompts/` changed. The blind pass was not
  touched. Newsweb titles are stored as untrusted data (#195).
- **Database.** Every schema change shipped its migration (`w1e2f3a4b5c6`, `x1f2a3b4c5d6`,
  `y1a2b3c4d5e6`, `z1b2c3d4e5f6`), all additive. Removed features kept their tables (`winter_orders`,
  `competence_marks`) on purpose, as the rule asks.
- **Secrets and files.** No `.env`, key, portfolio data or uploaded document added. The largest new
  files are CC0 GLB models (under 0.9 MB each).
- **Smoke test** is still GET-only. New write routes (`POST /sources/newsweb/acknowledge`,
  `POST /game/drills`) are not destructive.
- **Status honesty is good.** PR bodies say "written, not yet deployed" and name what was not seen.
- **Git.** No commit went straight to `main` (every first-parent commit is a PR merge). No force push
  was seen. Almost every agent commit has a real message and a session trailer.

## Findings, most serious first

### 1. Nothing enforces the merge gate (high)

- `main` has **no branch protection and no required checks** (`protected: false`, no rulesets).
- **35 of 97 PRs were merged before CI finished**, and 25 within two minutes of being opened
  (#198 after 7 s, #243 after 9 s, #207 after 18 s). They passed later, but nobody knew that at merge time.
- **#165, #166 and #167 were merged with the secret scan red.** It was a false positive, fixed in #168
  (`58830ff`), but a real leak would have gone to production the same way.
- Every merge is by the `frmingest` account. The API can't tell a click from a token, so this audit
  can't confirm that "never merge for Faiz" held. Merges within seconds of opening are worth checking
  against the session logs.

### 2. The "click through it yourself" game gate is not followed (high)

`CLAUDE.md`: "Nobody ships a game page they have not clicked through, and Faiz is not the tester."

- 37 PRs changed game frontend. **20 PR bodies say the page was not seen in a browser** (#171, #172,
  #182 to #184, #190, #196, #197, #201, #209, #215, #224, #227, #228, #231, #233, #241, #244 to #246).
  Most of the rest were seen only in headless Chromium with software WebGL and a mocked API.
- **Almost every 3D PR ends with "After deploy (Faiz): open `/game3d`, walk to …".** That makes Faiz
  the tester, which is the thing the rule forbids.
- **Tap counts from a cold load** (checklist B8) appear in 3 PR bodies (#160, #183, #229). Identity
  scores before and after (B2) appear in almost none; #213 says "still to be judged".
- **S13's own done-when** ("tap counts measured in a real browser") was not met when #241 merged.

### 3. Documentation sync is broken in both directions (high)

- **`claude/progress.md` is eight PRs behind.** It still says S9 is in an open PR, with `main` at
  `4fcc35b` (#238). The repo copy is at #245/#246.
- **The project's `claude/progress-archive.md` is missing the 2026-11-01 block** (#187 to #237), but
  the project's progress file points to it.
- **Repo docs with no project copy:** `game3d-prototype`, `game3d-townsfolk`,
  `game3d-standing-3-sprint-plan`, `game3d-standing-3`, `game3d-spread-layout`, `game3d-parity-layer`,
  `game3d-market-street`, `game3d-town`, `map-scene-dive`, `game-art-dde`, `records-shelf-books`,
  `market-street-redesign`, `market-street-strong-pick`, `market-street-strong-pick-motion`,
  `jaeren-newsweb-annual-category`.
- **Project docs with no repo copy:** `3d-game-feasibility-2026-10-30` (the study that started the 3D
  track), `game3d-marketplace-free-assets-2026-11-01`, `new-map-region-trace-2026-10-15`,
  `new-stitch-map-assessment-2026-10-15`.
- **Two repo docs are missing from `docs/README.md`:** `game/game3d-art-review-2026-11-01.md` and
  `ingestion/jaeren-newsweb-annual-category-2026-10-21.md`.

### 4. PRs opened without running what CI runs (medium)

PR rule 2 says to run ruff, pytest, tsc, lint, test and build first. These PRs say they did not:

- #165: ruff and pytest ("relying on CI")
- #240: tests, lint and build
- #243: tests, tsc and build (workspace disk full); merged 9 s after opening, before CI finished
- #244: tests not run; #245: no full vitest run and no build
- #224 and #227: full backend suite not re-run

Put together with finding 1, at least #243 reached production with no check run by anyone at merge time.

### 5. Stacked PRs merged into dead branches; parallel sessions duplicated work (medium)

- **#224, #226 and #240 show "Merged" on GitHub but are not on `main`.** Each was merged into a feature
  branch that had already been merged. #226 ("Standing S1: level chip and gate torches") was a second,
  separate build of Standing 1 from the same evening as #217.
- The same work was done twice: #224 was redone as #227; #240 as #241 (and #242, closed); the gitleaks
  allowlist was written in two sessions (`2edc0cb` and `58830ff`).
- The progress archive says "#222 to #229 … all merged", which counts #224 even though it is not on `main`.

### 6. Progress file rules (medium)

- `docs/PROGRESS.md` has **8 Active Tasks** (the limit is 7). Current Objective is a long paragraph,
  not 1 or 2 sentences.
- Most Active Tasks are open-ended "look-over after deploy (Faiz)" lists, some dating back to #187
  (2026-10-19). They never finish, so they never leave the file. This is the same problem as finding 2
  in another form.
- Because each PR updates PROGRESS in the same PR, `main` reads "not merged" right after the merge
  (today: S15 "Written on branch … not merged" while #246 is merged). Docs-only follow-up PRs
  (#148, #153, #205, #218) exist only to correct this.

### 7. Versioned rule files edited in place (medium-low)

Rule 3's wording covers prompts and schemas. The game rules use the same `_v1` convention, and some v1
files were changed after they had been used for real:

- `rituals_v1.py` lost its `competence_levels` and `competence_note_max_chars` fields (#190). Its own
  docstring says a change after real use must be `rituals_v2.py`.
- `dialogueV1.ts` gained all the Quest 2 lines (#202). `dialogueV2` was added later.
- `standing_v1.py` and `siege_scenarios_v1.py` hold the version registry, so every new version edits
  the v1 file. The values stayed unchanged, but the v1 file itself does not.

### 8. Smaller items (low)

- **65 inline hex colours in `frontend/src/game3d/`**, with no shared 3D palette or kit file. The
  standard says "do not inline one-off art or hex".
- **Misleading commit messages:** `cdd6fe2` / `56e1d71` are titled `Revert "Progress: E1 Blindfold
  Years written, PR open"` but delete about 30 Winter Rehearsal and Hearth files. #198 has the default
  title and an empty body, so the PR was not opened by an agent, against the project instruction
  "always create the PR for me".
- **17 new `# type: ignore` lines** in money and backtest code (`backtest.py`, `printer.py`,
  `printer_view.py`, `then_and_now.py`). The cases checked are guarded, but they hide mypy findings
  instead of narrowing the types.
- **Local clone hygiene** (`E:\Aladdin`): 14 untracked `vitest.config.ts.timestamp-*.mjs` files and an
  untracked `Aladdin-newsweb/` folder. The timestamp files belong in `.gitignore`.

## Where the rules contradict each other or can't be followed

1. **"Update PROGRESS in the same PR" vs "status honesty".** The PR can't know it will be merged, so
   `main` is always one step stale. Either describe state by PR number ("#246 adds …"), or allow one
   docs commit after each merge.
2. **"Run what CI runs; never open a PR with a known red check"** says nothing about what to do when
   the sandbox can't run the checks (disk full, no GPU). Agents opened ready PRs anyway. A rule such as
   "open as **draft** and say which checks were not run" would close the gap.
3. **"Click through it in a real browser; Faiz is not the tester"** can't be met by a cloud session for
   the 3D mode (headless software WebGL, no GPU, no real data). The rules need to say whether a
   headless run counts, and who does the real-GPU look when no agent can.
4. **The visual identity standard and the scene kit are written for 2D SVG/CSS pages.** Nothing covers
   `/game3d`: identity score, scene header, kit ownership and palette are all undefined there, so
   checklist A2/B2 can't be scored as written.
5. **Rule 3 (versioning) says "prompts and schemas"**, but the code applies it to game rules and words
   without saying so. It should either be extended in writing (and the registry moved out of the v1
   files) or left at prompts and schemas only.
6. **Docs layout says only `PROGRESS.md`, `architecture.md` and "the active sprint plan" sit at the
   docs root.** `README.md` is there too, and the plan at the root (`buffett-munger-rebuild-…-09-21`)
   is not the active one. The sprint plan actually being worked (S9 to S20) is
   `docs/game/game3d-kaykit-sprint-plan-2026-10-31.md`. "Mirror the active sprint plan" is therefore
   unclear.
7. **Project instructions and `CLAUDE.md` name the sections differently** ("Archive Reference" vs
   "Archive Pointer"; "Recent Blockers" vs "Recent Blockers / Open Questions").
8. **"Never merge; watch the checks"** relies on timing that nothing enforces (finding 1).
9. **Documentation sync requires writing to the claude.ai project**, but local sessions on `E:\Aladdin`
   (commits as `frmingest`) have no access to it. For them the rule can't be followed, which explains
   most of finding 3.

## Suggested fixes (none applied)

1. Turn on branch protection for `main`: require the six CI checks and an up-to-date branch. This alone
   closes findings 1 and 4 and part of 5.
2. Add to `CLAUDE.md`: "if a check can't be run here, open the PR as a draft and name it"; and "never
   target a branch whose PR is already merged; rebase onto `main`".
3. Decide what counts as "seen" for `/game3d` (headless with screenshots and tap counts in the PR, plus
   a named real-GPU look), and write a short 3D section for the identity standard (palette file, kit
   owner, score meaning).
4. Re-sync the project: `claude/progress.md`, `claude/progress-archive.md`, the 15 repo-only docs, and
   bring the 4 project-only docs into `docs/`.
5. Move the version registries out of `standing_v1.py` and `siege_scenarios_v1.py` into a small
   `versions.py`, and decide whether Rule 3 covers game rules.
