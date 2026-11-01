# 3D courtyard: Standing 4, "The Ledger" (level 5, the fifth torch) (2026-11-01)

Status: **written and tested, in PR `feature/game3d-standing-4-ledger`; not merged, not deployed.** Seen in a headless browser (software WebGL) against the real backend route on a local test database (five made-up holdings), not on your real data and not on a real GPU.

## What a sprint like this is for (plain words)
The torches by the road show how well you know your own fortress. Four were built: holdings in, fog lifted, reasons written, the watch walking. This sprint adds the **fifth and last torch: The Ledger.** It burns while you keep your promise to look back: when a journal entry turns six months (and again at twelve), you write what really happened next to what you expected. It is the last level in the plan from the [brainstorm](game3d-progression-brainstorm-2026-10-31.md).

It is **held, not won.** The day a look-back falls due, the fifth torch goes out until you write it. It cannot be reached in a weekend: the first look-back only opens 182 days after an entry.

## How it plays
- **Gate 5:** levels 1 to 4 hold, **no look-back is due and unwritten**, and **at least one look-back is written**.
- "Due" is the journal's own flag (182 days for the 6-month look-back, 365 for the 12-month one, no text yet), so the game and the Journal page can never disagree. A test keeps the rule's day counts equal to the journal's.
- Every journal entry counts, also one on a holding you have since sold: the decision was still yours.
- Blank text is not a look-back.

## What you see (game voice, numbers exact)
| Situation | Quest log line under "Standing" |
|---|---|
| All clear | 🔥×5 **Level 5 of 5: The Ledger** · "All five lit. Keep looking back as entries age." · "3 look-backs written, none due." |
| One overdue | 🔥×4 **Level 4 of 5: The Watch** · "Look back: when an entry turns six months, write what really happened." · "1 look-back due." (the Six-Month Reckoning card below names which) |
| Journal too young | "Too soon to look back: the first opens in 92 days." |
| No entries | "No journal entries yet. Nothing to look back on." |

The ledger line only shows from level 4; before that it is not the point yet. The sample fortress stays level 0.

## What changed
- **Backend:** new versioned rules `app/domain/game_mapping/standing_v3.py` (v1 and v2 untouched, CLAUDE.md Rule 3); `build_standing` gains gate 5 (only rules that know level 5 can light it); `GET /game/standing` passes each entry's age, look-back written and due flags. Live default is now `v3`. **Roll back:** `ACTIVE_STANDING_VERSION=v2` in Railway. No migration, nothing stored, read-only.
- **Frontend:** fifth torch at the end of the row (same warm flame, only the count means anything); `standingWordsV3.ts` (v1 and v2 words untouched); one extra line in the Quest log.

## Checks run
Backend `pytest` (2030 passed, before the new tests) plus the new standing tests (34 passed), `ruff` clean. Frontend `tsc`, `npm run lint` (the same 2 old warnings), `npm test` (131 files, 1102 tests), `npm run build`: green.

## Look and judge (sprint checklist)
- **Pages touched:** `/game3d` only (torch row, Quest log card). Identity unchanged (3D scene, one real fact encoded as a torch).
- **Seen:** level 5 with five lit torches; level 4 with one look-back due (fifth torch dark, Reckoning card names World ETF). No page errors. **Not seen:** real GPU, your real data, a phone.
- **Taps:** none new. Reading the Standing is Q (1), as before.

## For Faiz after deploy
Open `/game3d` and press Q. Your journal entries are recent, so expect "Too soon to look back: the first opens in N days" and four torches at most (or three if the night watch has not run). That is by design.

## Not done
- Calibration (hit rate) with its sample size in the 3D world: still on the Hall of Records page only.
- Oracle and Partner lines about your own track record: new words would be a new dialogue version file.
- Seasons (report season, a yearly 12-month day) from the brainstorm.
- `decided_on` can be backdated; the game cannot tell a real old entry from a faked one.

## Git commit description
`3D courtyard Standing 4: fifth torch "The Ledger" (level 5, held while no 6- or 12-month look-back is overdue), standing_v3 live with v2 rollback`
