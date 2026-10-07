# Tag review inbox: see missing ESEF inputs and the closest tags after a Newsweb fetch (2026-10-07)

**Status:** PR 1 is **merged (#60, `65aaed1`)**, not checked on real filings or the live app. **PR 2 is merged (#61, `bdde1c1`)**, its migration `s1e0f1a2b3c4` not yet confirmed on Supabase. **PR 3 (export a rule as code) is written and tested on branch `feature/tag-review-export`, not merged, not deployed, not run on real filings.**

## 1. The ask and the decisions

Faiz: some companies' `.xhtml` annual reports need extra tags mapped so the extractor captures most of the data. Proposal wanted: after a Newsweb capture, show the cases and recommended new tags, so files do not have to be fed into the chat each time.

Decided by Faiz on 2026-10-07:

| Question | Decision |
|---|---|
| Scope of an accepted rule | Standard tags (`ifrs-full`, `us-gaap`) apply to **all companies**; a company's own extension tags (`ORK:`, `subsea7sa:`) apply to **that company only** |
| Acceptance bar | A suggestion that fails its own check may still be accepted, **only after a second confirmation** |
| Starting point | PR 1 first |

## 2. What the app already did (checked in the code)

- A coverage manifest per filing (extracted / not applicable / missing) and a closest-tags report for **four** metrics, **latest year only**, shown as a warning on the metrics page.
- The raw `.xhtml` is stored, and so is the list of every tagged number. A review therefore never needs a new file.

## 3. What PR 1 adds (read-only, deterministic, no migration)

| Piece | Behaviour |
|---|---|
| Gaps | For the latest fiscal year, every expected input not extracted: the 17 core inputs, share count, and lease payments (only when lease liabilities are tagged). Banks skip the inputs that do not apply |
| Candidates | Up to six per gap, ranked: standard tag, also tagged the prior year, passes its check; penalised when it does not tie or is implausibly large |
| Checks | Operating cash flow: does operating + investing + financing tie to the change in cash. Total liabilities and total equity: assets identity. Total debt: not above total liabilities (marked *plausible*, not a tie). Others say *not checkable* |
| Scope | Each candidate says *all companies* (standard tag) or *this company only* (extension tag) |
| Tagged but unused | Largest monetary tagged numbers (over 2% of revenue, or of assets) that no mapping reads: where a one-off such as a sold business hides |
| API | `GET /tag-review`, optional `?holding_id=`. Newest tagged report per holding; a gap another document fills is dropped; hidden in demo mode |
| UI | **Tag review** page under More, System, with a "Copy for chat" block per company; a banner under a holding's *Reports from Newsweb* card after a fetch |

Code: `extraction/tag_review.py` (detection), `services/tag_review.py` and `api/tag_review.py`, `TagReviewPage.tsx`, `TagReviewBanner.tsx`. The review is stored as plain JSON in the document's quality flags (`ixbrl.tag_review`), also for ESEF-index imports.

## 4. Not in PR 1 (PR 2 below builds the first two items; PR 3 the last)

- **PR 2:** accept a suggestion as a mapping rule stored as data (new table, migration), read by the extractor after the built-in lists; rejected suggestions remembered; second confirmation for a suggestion that fails its check; a Re-extract button (today a re-read means deleting and re-fetching).
- **PR 3:** export a rule as a code change plus a test fixture (concept names and values only), so the repo stays the long-term source of truth.
- Limits of PR 1: suggestions are name-based plus the checks above; only the latest year is reviewed; only annual `.xhtml` reports (not ESEF-index history imports) feed the inbox; no check exists for most metrics.

## 5. Verification

- Backend: `ruff check . --ignore EXE002` clean; pytest 1,296 unit + 300 integration pass (24 new: detection, service, API). One unrelated integration test (`test_risk_api::test_refresh_endpoint_forces_a_provider_call`) failed once in a full run and passed on three reruns; looks flaky.
- Frontend: tsc, ESLint (0 errors), 295 tests (6 new, and the More-page count test is now 11), build.
- Tests use synthetic filings with the real tag shapes (Aker BP, Orkla, Subsea 7 patterns); no real filing is committed.

## 6. After deploy (Faiz)

Stored reports are not re-read by themselves. Press *Fetch all reports* again on a holding (or delete its documents first), then open **More, System, Tag review**.

## 7. PR 2 (PR #61): accept, reject, re-extract

Built on `main` `65aaed1` after checking that #60 and #59 were already merged.

| Piece | Behaviour |
|---|---|
| Table | `tag_mapping_rules` (migration `s1e0f1a2b3c4`, additive): one row per decision, `accepted` or `rejected`, with metric, tag, scope, the check result at the time, the fiscal year and file it came from |
| Scope | A standard tag (`ifrs-full`, `us-gaap`) is a rule for **all companies**; a company's own tag (`ORK:`, `subsea7sa:`) for **that company only**. Set by the server from the tag, never sent by the client |
| Second confirmation | A suggestion that **does not tie** or **looks implausibly large** is refused with 409 until the request says `confirm_failed_check`. The UI shows an inline warning first. Such a rule carries confidence 0.8 (0.9 otherwise) and is marked in the Saved rules list |
| What can be accepted | Only a suggestion the inbox offered for that holding's newest report (looked up server-side). No free-typed tag, and not EBITDA (derived in code) |
| Extractor | Rules are read **after** the built-in lists and only for a figure the built-ins left empty; a built-in result is never replaced. The source reads `rule: <tag>`; every use is listed under `rules_applied` in the document's flags. Applies to uploads, Newsweb fetches and ESEF-index imports |
| Rejections | Remembered per holding; the inbox hides the suggestion and says how many are hidden. *Bring back* deletes the rejection |
| Re-extract | `POST /tag-review/re-extract` re-reads a holding's stored tagged `.xhtml` reports with the current rules and replaces **their figures only**. Pages, chunks and text are not touched. Every report is read before anything is written; one that cannot be read keeps its figures. Written oldest first; a year another document already supplies stays with that document |
| Survival | Deleting a holding's documents (the delete-and-re-fetch cycle) keeps every decision. Deleting the holding removes its company rules and rejections; an all-companies rule stays |
| UI | *Use this tag* / *Not this one*, *Re-extract {ticker}* per company (primary once a rule is waiting), *Re-extract the N companies with a saved rule*, *Saved rules* with Remove / Bring back |
| Safety | Writes are blocked in demo mode; no LLM; the blind-pass and evidence rules are untouched (a rule only changes which tagged number fills a metric) |

Code: `models/tag_mapping_rule.py`, `services/tag_rules.py`, `api/tag_review.py` (rules, rejections, re-extract), `MappingRule` and the hook in `extraction/ixbrl.py`, `refresh_document_facts` in `documents/ingestion.py`, `TagReviewPage.tsx`.

**Verification:** Ruff clean; backend 1,633 tests (22 new); migration up/down/up on Postgres 16 with one head; frontend tsc, ESLint 0 errors, 300 tests (5 new), build. Tests use synthetic filings with real tag shapes.

**Limits:** a rule fills one metric from one tag (no sums of several tags); it cannot be made from a *tagged but unused* line; ESEF-index history imports are not re-extracted (re-import them from the index); a wrong rule is only as safe as its check, which is why a failing one needs two confirmations.

**After merge and deploy (Faiz):** check the Railway log shows migration `s1e0f1a2b3c4`; `git pull` in `E:\Aladdin`; open More, System, Tag review (press *Fetch all reports* on a holding first if it shows nothing); *Use this tag* on a suggestion that ties, *Re-extract*, and check the figure shows with source `rule: ...`.

## 8. PR 3: export an accepted rule as a code change

Built on `main` `bdde1c1` (PR #61 already merged). No migration, no new table.

**The idea.** A rule is a database row. Once it has proved itself, one press turns it into **one row of data in the repo** plus **the test that proves it**, so a fresh database needs nothing and the code stays the source of truth.

| Piece | Behaviour |
|---|---|
| Rule table | New module `extraction/accepted_tag_rules.py`: one row per promoted rule (metric, concept, the tagged value, unit, point-in-time or year, a note such as `ORK.OL FY2025`). The extractor appends these concepts to its built-in list **last**, so, like a database rule, they only fill what the built-in lists leave empty. Empty at first |
| Scope | Unchanged: standard tag, every company. A company's own tag (`ORK:...`) can only occur in that company's reports, so it is company-only by its name |
| Export | `GET /tag-review/rules/{id}/export` (read-only, hidden in demo mode): builds the row, **runs the extractor on a tiny synthetic filing made from it**, and returns the row, a `git apply` patch for the one file, a commit message, and notes. `verified: false` says "do not apply" and why |
| Value | Taken from the inbox's own suggestion while it is listed, else from the figure the rule filled in that report. If neither exists (documents deleted) the export says to re-fetch first |
| Permanent test | `tests/unit/test_accepted_tag_rules.py` builds a fixture from **every** row and requires the extractor to read the figure with **no** database rule and `rules_applied` empty. A row cannot be added without this passing. A guard test also checks every exportable metric really reads a concept appended to its list |
| Refused | Not accepted (409); the tag is already in the code (409, and the rule is flagged *already in the code*); a metric with its own reader, today only **lease payments** (422); no stored value (409); a unit a fixture cannot express (422) |
| UI | *Export as code* on each saved accepted rule: shows the patch, the first line of the commit message, *Copy for chat*, *Copy patch*. A rule the code already reads is labelled "already in the code, no longer needed" |
| Data rule | Concept names and one value per row, never filing text or statements (CLAUDE.md: no real documents in the repo) |

**How a rule gets into the repo.** Press *Export as code*, then either paste *Copy for chat* to Claude (it applies the patch on a branch and opens a PR) or run `git apply --ignore-whitespace` in the repo. After the PR is merged and deployed, press *Remove rule* on the database copy: figures it filled stay until the next re-extract, and the code now reads the tag.

**Verification:** Ruff clean; unit tests for the fixture (flow, balance sheet, per-share, share count, negative value, standard namespace), the guard over every exportable metric, rendering and parsing the block back, a `git apply --check` of the real patch in a scratch repo, a full round trip (patched table loaded, concept lists rebuilt, extractor reads the figure with no rule), and the API (before and after a re-extract, read-only, demo, already-in-code). Frontend tsc, ESLint 0 errors, 305 tests (5 new), build.

**Limits.** A promoted rule fills one metric from one tag (no sums of several tags); it cannot be made from a *tagged but unused* line; for a share count the choice between year-end and average is inferred from the tag name (the notes say so); the fixture proves the tag name maps to the metric, not that the company's real filing uses the same context. A promoted standard tag applies to every company, so it is only as safe as its check: promote ones that tied.

**After merge and deploy (Faiz):** nothing is needed until you export a rule. Open More, System, Tag review, press *Export as code* on a saved rule, and check the headline says *Checked*.

## 9. What is left

The tag review inbox is complete as planned (PR 1 #60, PR 2 #61, PR 3). Open ideas, none started: rules for *tagged but unused* lines, a rule that sums several tags, a re-extract for ESEF-index history imports, lease payments in the exportable set.
