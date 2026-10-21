# Jæren Sparebank: why its reports had no figures (2026-10-21)

## What the live app held for JAREN.OL
24 documents, 0 extracted figures. Five `.xhtml` annual reports (2021 to 2025), all flagged `no_ixbrl_tags` (the file has no XBRL tags, it is the report converted to HTML). 19 quarterly report PDFs (text only by design).

## Causes
| # | Cause | Status |
|---|---|---|
| 1 | The `.xhtml` Newsweb attaches is untagged. The fetcher takes a `.zip` ESEF package first, so Newsweb has no zip for these messages. The announcement mirrored on MFN lists an ESEF zip and a PDF | **Open.** Get the tagged package elsewhere (not verified: could not reach Newsweb or filings.xbrl.org from the session) |
| 2 | Jæren filed its 2024 and 2025 annual reports under Newsweb's HALF YEAR category (1002). The annual fetch only searched 1001, so the half-year fetch stored them as `quarterly_report` | **Fixed** (this PR) |
| 3 | Quarterly PDFs never give figures (CLAUDE.md Rule 1) | By design |
| 4 | Holding is named "JAREN.OL" with no sector | Open, set on the Holdings page |

## The fix
- `list_annual_reports` searches category 1001 and also 1002, keeping messages whose title says annual report (`årsrapport`, `annual report`, `årsberetning`); no message is listed twice.
- `list_interim_reports` leaves those annual-titled messages out.
- An already stored file (same hash) that was filed under another kind is retyped to the kind being fetched, so no second copy appears.
- The garbled name "A°rsrapport 2023" comes from Newsweb's own attachment name, not from unzipping; left as is.

Tests: 4 new provider tests, 1 integration test (retype); backend suite 1,951 passed, 2 skipped; Ruff clean.
