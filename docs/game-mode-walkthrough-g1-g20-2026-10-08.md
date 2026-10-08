# Game mode G1–G20 walkthrough, results — 2026-10-08

Faiz walked every gate on the **live frontend** (`exciting-gratitude-production-71b5.up.railway.app`) with his real data, one gate at a
time, and confirmed each. Before starting he confirmed the database head is `t1f2a3b4c5d6` (Supabase), opened Portfolio risk and
Margin of safety once so the siege and land layers had stored data, and checked in the browser (not Claude). This closes the
Sprint 26a walkthrough item. Claude could not see the live app: where this page says "screenshot" Claude saw it; everywhere else it is
Faiz's confirmation.

## Result

| Gate | What | Result |
|---|---|---|
| G1 | Game state data, rules version, data-gap notes, demo mode | OK |
| G2 | Toggle, nav, scene, tower survey, keyboard, Ledger tab | OK |
| G3 | Study skin, holding-page survey, Ledger sort and filter | OK |
| G4 | Weather, land signs, tripwire marks, siege | OK (screenshots; see below) |
| G5 | Vault level, Update cash, amount parsing | OK |
| G6 | Temperament meter | OK, but **not exercised** (see below) |
| G7 | Art, hover card, advisors, study desk, sound | OK; better sounds wanted later |
| G8 | Lamp logo, one connected fortress, verdict on the whole | OK |
| G9 | Marketplace, street, stores, Name your price | OK |
| G10 | Sal the Sales Rep | OK |
| G11 | Magic lamp and Genie | OK |
| G12 | Hype Booth | OK |
| G13 | Siege Simulator | OK (screenshot; see below) |
| G14 | Nightly snapshot, Chronicle | OK |
| G15 | Ravens | OK, but **too many records** (see below) |
| G16 | Night Watch | OK |
| G17 | Council Chamber | OK |
| G18 | Hall of Records | OK |
| G19 | Circle of Competence | OK |
| G20 | Per-holding advisor lines | OK |

## What was checked against real data (from screenshots)

- **G4:** weather "Calm skies" is correct: macro regime baseline and a stored what-if of −131 301 kr (18.3% of the 715 891 kr equity
  book), under the 25% gathering line. The one OFFER sign is L&G Gold Mining ETF (36.3% margin of safety, "bear to base"); XDEF is
  above base and below bull, so no sign (correct). Five of seven towers show no sign because Margin of safety lists only two holdings;
  the others (Xetra-Gold, Heimdal, Alfred Berg, Vår Energi, Salmon) have no stored valuation, which the rules draw as fog. Vår Energi's
  land reads "DCF unavailable" with the reason. The amber "i" on Vår Energi was a thesis in review; it cleared after Faiz ran a new
  analysis in parallel (thesis intact), which is the live scene following current data while Night Watch compares stored frames.
- **G13:** all 7 of 7 holdings modelled, 100% coverage, weighted beta 0.44, a 15% fall costs the book 6.6%. The two preset buttons are
  missing because neither line is reached within the slider range: Vår Energi (beta 2.18) is capped at a total loss from a 46% fall, and
  the gold and fund holdings gain or stay flat, so the book never reaches 25%. By design (`presetDrop` returns null), arithmetic checked.
- **G6:** the dial is dashed with "?" and "Low confidence": 1 logged decision, 0 snapshot comparisons in 365 days, so no drain or
  restore rule has fired on real data. The rules are proven only by tests and the demo state.

## Polish and follow-up list (nothing here blocks closing the walkthrough)

1. **Ravens are too many** (177 unseen). A text-only raven is created for every Newsweb report captured in the last 45 days that has
   no figures, watchlist companies included, so the bulk fetch (302 reports overnight) floods the tab. Faiz: "should be cleaner and
   focus on only watchlist items". **Scope to be confirmed** (watchlist only, or hide watchlist and keep portfolio?); likely fix:
   group reports per company and/or filter by portfolio or watchlist.
2. **Night Watch overnight-reports line** counts reports by stored date (Vår Energi ×23, Odfjell ×20, 302 in all), probably the same
   bulk fetch. Faiz marked G16 OK; no change requested, noted as possible noise.
3. **"Reported in"** (Night Watch, state `ok`) reads as a dangling phrase; reword in `lib/nightWatch.ts`.
4. **Tower survey wall numbers** show raw values with no currency or thousands separators (for example `6,041,500,000.00`).
5. **Large empty panel** below the Fortress scene (under the "Point at or tap a tower" line).
6. **Siege Simulator:** show a greyed "Not reached" preset instead of hiding it; results for very large falls rest on gold and fund
   holdings gaining (rough guide); benchmark is OSEBX only, so a global ETF such as XDEF is understated (agreed caveat).
7. **Weights differ between pages:** Margin of safety measures against equity only (27.8% for L&G), the Fortress against the whole realm
   (19.3%). A labelling difference, not an error.
8. **Better sounds** wanted later (explicitly not now).
9. **Data to enter** for a fuller picture: cash for the other 4 of 5 accounts; journal entries so Temperament has something to read.

## Not covered

Phone width, light theme in detail, `prefers-reduced-motion`, keyboard-only use beyond Tab and Enter on towers, and sound quality were
not systematically checked. G31 (raven *Read the report* button, PR #77) and the G28/G30 scroll features were **not part of this
walkthrough** and are not confirmed live.
