# Tag review inbox: see missing ESEF inputs and the closest tags after a Newsweb fetch (2026-10-07)

**Status:** PR 1 is **merged (#60, `65aaed1`)**, not checked on real filings or the live app. **PR 2 is written and tested on branch `feature/tag-review-rules` (PR #61), not merged, not deployed, not run on real filings.** PR 3 is designed, not started.

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

## 8. PR 3 (not started)

Export an accepted rule as a code change (the concept added to the built-in list) plus a test fixture with concept names and values only, so the repo stays the long-term source of truth. Needs Faiz's go.
