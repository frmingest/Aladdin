# Newsweb interim-report fetch — Kongsberg (KOG.OL) bug report, 2026-09-27

## What Faiz reported

> "i have tested this on Kongsberg Gruppen ASA (KOG.OL) stock but its only capturing html/xbrl files"

— on the just-shipped F19 half-year/interim report fetch.

## What was actually found (read-only investigation against live production + the real Newsweb API)

1. Confirmed the deployed backend was fully up to date (commit `7172dac`, includes F19) — not a stale-deploy issue.
2. Confirmed Kongsberg's real Newsweb data: 8 real HALF YEAR FINANCIAL REPORT (category 1002)
   announcements for issuer "KOG", 2022–2023. **Every attachment on every one checked is a `.pdf`** —
   there is no ESEF file on any of them, so "capturing html/xbrl only" can't be Newsweb serving ESEF
   for these.
3. Confirmed Kongsberg's eligibility flag (`newsweb_interim_report: true`) and issuer-sign derivation
   (`KOG.OL` → `KOG`) are both correct.
4. Checked the actual documents on file for this holding (`GET /documents?holding_id=...`): **only 5
   documents exist, all from the annual-report fetch (F17) — `.html`/`.xhtml`, one per year
   2021–2025.** The interim-report GET (`.../newsweb-interim-report`, DB-read only) came back
   `reports: []` — **no half-year report has ever actually been imported for this holding.**

**Conclusion:** Faiz's observation is accurate as a description of what's on file today — but it isn't
evidence that the PDF-fallback path is broken. It's consistent with the "Fetch half-year reports"
button for Kongsberg simply not having produced a successful import yet (never clicked, or clicked and
it silently didn't add anything). Claude's tools can't send a `POST` to production (network egress is
locked to package registries/GitHub only, confirmed by testing `curl` through the proxy — `403
connect_rejected`), so this couldn't be reproduced end-to-end from here.

## A real bug found along the way (fixed regardless)

While reading the code, found that `pick_report_attachment()` picked the ESEF file if triggered but PDF
fallback took **the first PDF attachment in Newsweb's listed order** — and real Kongsberg messages
don't reliably list the actual report first. Example real message ("STERK VEKST OG 1 MILLIARD KRONER I
EBIT", id 595139) lists `Presentasjon Q2 2023.pdf` before `Q2 Rapport.pdf`. The old logic would have
imported the investor presentation instead of the report.

**Fix:** `pick_report_attachment()` now skips any PDF whose name looks like an investor
presentation/webcast/invitation (`presentation`, `presentasjon`, `webcast`, `invitation`,
`invitasjon`) in favour of one that doesn't, regardless of order. Falls back to the first PDF only if
every PDF in the message matches those keywords (an imperfect pick beats none). Two new unit tests use
Kongsberg's real attachment name/order as the fixture. 50/50 tests pass in
`test_newsweb_filing_provider.py` + `test_sources_api.py`; full backend suite 928/927 (1 pre-existing,
unrelated failure). Ruff clean.

This wouldn't fully explain "html/xbrl only" on its own (a wrong PDF pick still isn't an xhtml/zip),
but it's a real latent bug worth having fixed regardless of root cause.

## What's still needed from Faiz

Please click **"Fetch half-year reports"** on the Kongsberg Gruppen holding page and report back exactly
what happens:
- Does it succeed and show new report(s), and if so is it now picking `Q2 Rapport.pdf`-style files
  correctly (not a presentation)?
- Does it show an error message — if so, the exact text?
- Does nothing appear to happen at all?

That will pin down whether this was simply "hasn't been clicked yet" or a real second bug still to find.
