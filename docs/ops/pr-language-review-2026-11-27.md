# PR language review: all 398 PRs, and the plain words rule (2026-11-27)

Status: **written, PR open.** Issue #541.

## In plain words

Faiz said the PR text is too long and too abstract to review. The numbers agree. PR bodies keep getting longer, and the biggest jump came when the template arrived. This adds a rule and a check so a PR reads in about a minute.

## What we looked at

Every PR in the repo: #1 to #540, 398 PRs, 2026-09-13 to 2026-11-27. All from one author, none drafts. 394 merged, 4 closed unmerged (#8, #204, #225, #242). Median time to merge: 12 minutes.

## What we found

| Measure | Result |
|---|---|
| Typical body | 239 words (middle PR); the longest is 2,024 |
| Before the template | 220 words |
| Since PR #415, the first with the reviewer table (58 PRs) | 774 words |
| Of that, the reviewer table | about 376 words |
| Sentence length | middle 11 words; 501 sentences over 30 words |
| Titles | middle 65 characters; 131 over 72; 64 carry `#N` numbers |
| Opening paragraph holds code or paths | 39 of 58 template PRs |
| Code names and paths | about 12 backtick items per PR; 1,127 file paths in total |
| Section names | Over 25 different headings for the same four ideas ("Verified", "How verified", "Checks"...) |

Most sentences are fine. The problem is the amount, and that the first thing Faiz reads is a list of code names. The ten longest PRs are almost all 3D game work and run 1,200 to 2,000 words.

## The rule

CLAUDE.md "Plain words". Enforced by the existing hook and CI job:

- Title: 72 characters or fewer.
- New first section "In plain words": 60 words or fewer, no code, file path or issue number.
- Whole body: 400 words or fewer, not counting the reviewer table. Longer detail goes in a `docs/` file the PR links.
- Reviewer result: 25 words or fewer. Link the report.

The limits are not magic. Checked against the last 20 template PRs: all 20 would have failed on the missing opening and on a long reviewer note, 16 on length and 12 on the title. Half of all template PRs were under 415 words, so 400 asks for a real cut but not a rewrite.

## What the check cannot do

It counts words. It cannot tell whether a sentence is clear. Jargon is only caught where it hides most: code, paths and numbers in the opening. The rest stays a rule in CLAUDE.md that the author follows and Faiz judges.

## After this merges

- The checker comes from the PR's base branch, so it applies to PRs opened after this one merges.
- Faiz can tune the numbers at the top of `.github/scripts/check_pr_template.py`.
- The hook checks the body only. The title limit is enforced in CI.
