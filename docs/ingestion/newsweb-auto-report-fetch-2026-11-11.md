# Newsweb: new reports fetched automatically, and shown on the Dashboard (2026-11-11)

Status: **written and tested locally (backend 2,100 passed, frontend 1,984 passed, tsc, lint, build), in a PR. Not merged, not deployed, not run against the real Newsweb from Railway.**

## What Faiz saw

Vår Energi's report of 21.10.2026 (category HALF YEAR FINANCIAL REPORT, 2 attachments) was on Newsweb but nowhere in the game.

## Cause (read from the code, not from logs)

Two separate things existed and nothing joined them:

- The hourly **watch** (Railway, `newsweb_watch.py`) stores announcement *metadata* only: title, category, date, link. No PDF, no `Document`, no figures.
- Reports became `Document` rows only when someone pressed *Fetch all reports* / *Fetch half-year reports* on a holding (`POST /sources/holdings/{id}/newsweb-{annual,interim}-report/import`). Ravens, the library scrolls and the Fortress read `Document` and `FinancialLineItem` rows, so without a press they never saw the filing.
- The watch's own result (`GET /sources/newsweb/new`) had no frontend at all.

The 2026-10-28 watch doc listed both gaps under "Not done yet".

## What changed

| Piece | Where |
|---|---|
| New job: after a watch pass, import new annual and half-year/quarterly reports for the same holdings (Oslo-listed, owned or on the watchlist) | `app/services/filings/newsweb_report_fetch.py`, called from `newsweb_watch_scheduler.py` |
| It runs on the Railway backend, next to the watch, so it works with the PC off and uses the same object storage as the buttons | scheduler thread |
| Same importers as the buttons, over a short window (last 60 days). Reports already on file are skipped by Newsweb message id. "Nothing in the window" is a normal outcome, not a failure | `NewswebNothingFoundError` (subclass of `NewswebImportError`, same message as before) |
| Settings: `NEWSWEB_REPORT_FETCH_INTERVAL_MINUTES` (default 360, 0 = off), `NEWSWEB_REPORT_FETCH_LOOKBACK_DAYS` (60), `NEWSWEB_REPORT_FETCH_PAUSE_SECONDS` (2) | `config/settings.py` |
| System status: a row "Newsweb report fetch" (warns if never run, or no pass for three intervals) | `job_status.py` |
| Dashboard card **New on Newsweb**: unread announcements, reports first, link to each message, *Mark all as seen*. Renders nothing when empty, in demo mode, or on error | `NewswebNewCard.tsx`, `lib/newswebNew.ts` |

Rules kept: no LLM and no analysis is started. Interim PDFs stay text evidence with zero extracted facts (CLAUDE.md Rule 1). Annual ESEF files give facts through the same extractor an upload uses. Titles are issuer text, shown as data (Rule 5).

## Tests

`tests/unit/test_newsweb_report_fetch.py` (8): a new Q3 report is imported and the report PDF (not the presentation) is the one downloaded; a second pass downloads nothing; the window is the lookback; nothing found is not a failure; one failing issuer does not stop the others; only watched Oslo holdings; pause between issuers; due-ness and the off switch; the status row. Frontend: `lib/newswebNew.test.ts` (4).

## Not checked

- Not run against the real Newsweb from Railway's IP, and not seen in a browser (the card is plain app UI, not a game page).
- A holding's first pass only looks back 60 days. Older reports still need the button.
- The game has no page of its own for unread announcements; a new report reaches game mode as a raven and a library scroll once imported.

## After deploy (Faiz)

1. Let Railway redeploy. No migration in this change.
2. Wait about an hour (first watch pass, then the report fetch), open System status and check the row **Newsweb report fetch** shows a recent run and a summary.
3. Vår Energi should show the 21.10 report as a raven and a scroll. If it does not, check the holding's ticker is `VAR.OL` (not `VARRY`): `VARRY` is not an Oslo ticker, so the holding is not watched.
4. Dashboard: the **New on Newsweb** card appears when the watch has unread items. *Mark all as seen* clears it.
