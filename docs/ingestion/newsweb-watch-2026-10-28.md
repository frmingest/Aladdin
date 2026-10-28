# Newsweb watch: background check for new announcements (2026-10-28)

Status: written and tested locally, **not merged, not deployed.**

## Before this change
Newsweb announcements were fetched only when you opened a holding's announcements
endpoint or when an analysis run built its evidence packet, and cached 24 hours
(`research_stale_after_hours`). Nothing ran on a schedule, the watchlist was never
covered, and the cache is replaced on each refresh, so "new since last time"
could not be known. The PC worker's background jobs and the Railway macro
scheduler were the patterns to follow.

## Decision (Faiz: "you recommend and decide")
- **Runs on the Railway backend**, same pattern as the macro refresh scheduler, so it keeps
  collecting while the PC is off. The endpoint is keyless and light.
- **Scope:** Oslo (`.OL` / NOK) holdings you own (latest snapshot of each account) plus
  every watchlist holding, each once.
- **Every 60 minutes** (`NEWSWEB_WATCH_INTERVAL_MINUTES`, 0 = off), 1 s pause between issuers,
  30-day lookback (`NEWSWEB_WATCH_LOOKBACK_DAYS`). First pass 60 s after start-up. Skipped in demo mode.
- **New = a database fact:** table `newsweb_announcements` (migration `y1a2b3c4d5e6`, additive),
  one row per holding and Newsweb message with `first_seen_at` and `acknowledged_at`.
  A holding's **first look is a baseline** (stored already acknowledged), so adding a holding
  never raises a flood of false "new" items. A failed first look is retried as a baseline.
- **Never acts on its own:** no analysis is queued and no LLM quota is spent. Titles are
  untrusted issuer text, stored and shown as data (Rule 5). Only metadata is stored.

## Where
- `app/services/filings/newsweb_watch.py` (pass, baseline, unread, acknowledge)
- `app/services/filings/newsweb_watch_scheduler.py` (thread, started in `main.py` lifespan)
- `GET /sources/newsweb/new`, `POST /sources/newsweb/acknowledge` (`app/api/newsweb_watch.py`)
- System status page: job "Newsweb announcements watch" (warns if never run, or no pass for 3 intervals)
- Tests: `tests/unit/test_newsweb_watch.py`, `tests/integration/test_newsweb_watch_api.py`

## Not done yet
- No frontend: nothing shows the unread announcements or calls acknowledge yet (API only).
- Not yet watched: new annual or interim *reports* (the existing manual import stays manual).
- Unverified: Newsweb from Railway's IP (the endpoint is public; the System status page will show
  failures per ticker in the job summary after the first deploy).
