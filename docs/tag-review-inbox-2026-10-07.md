# Tag review inbox: see missing ESEF inputs and the closest tags after a Newsweb fetch (2026-10-07)

**Status:** PR 1 of 3 is **written and tested on branch `feature/tag-review-inbox` (PR #60), not merged, not deployed, not run on real filings or the live app.** PR 2 and PR 3 are designed, not started.

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

## 4. Not in PR 1

- **PR 2:** accept a suggestion as a mapping rule stored as data (new table, migration), read by the extractor after the built-in lists; rejected suggestions remembered; second confirmation for a suggestion that fails its check; a Re-extract button (today a re-read means deleting and re-fetching).
- **PR 3:** export a rule as a code change plus a test fixture (concept names and values only), so the repo stays the long-term source of truth.
- Limits of PR 1: suggestions are name-based plus the checks above; only the latest year is reviewed; only annual `.xhtml` reports (not ESEF-index history imports) feed the inbox; no check exists for most metrics.

## 5. Verification

- Backend: `ruff check . --ignore EXE002` clean; pytest 1,296 unit + 300 integration pass (24 new: detection, service, API). One unrelated integration test (`test_risk_api::test_refresh_endpoint_forces_a_provider_call`) failed once in a full run and passed on three reruns; looks flaky.
- Frontend: tsc, ESLint (0 errors), 295 tests (6 new, and the More-page count test is now 11), build.
- Tests use synthetic filings with the real tag shapes (Aker BP, Orkla, Subsea 7 patterns); no real filing is committed.

## 6. After deploy (Faiz)

Stored reports are not re-read by themselves. Press *Fetch all reports* again on a holding (or delete its documents first), then open **More, System, Tag review**.
