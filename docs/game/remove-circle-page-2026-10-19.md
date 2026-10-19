# Circle of Competence page removed from Game mode (2026-10-19)

Status: written and tested, **not merged, not deployed, not seen in a browser.** Branch `feature/remove-circle-page`, off `main` `53c7d40` (#189). Faiz asked for the Circle page to go completely because it does not fit the Game mode design at this stage.

## Removed
- **Page and route:** `/fortress/circle`, its "Circle" tab in the Fortress strip, and the Circle crest case. The app has no catch-all route, so an old bookmark to `/fortress/circle` shows the app frame with an empty body (same as the removed Council page).
- **Backend:** `GET /game/competence`, `PUT /game/competence/{sector}`, `DELETE /game/competence/{sector}`; `services/game/competence.py`; the `CompetenceMark` model; the Competence schemas; `demo_competence_marks`; the rules fields `competence_levels` and `competence_note_max_chars` (`RitualsRules` now holds only `version`). `game` no longer has any write endpoint. All their tests.
- **Frontend:** `CompetencePage`, `CircleMap`, `CircleRingArt`, `CircleGlyph`, `MarkControl`, `useZoneDrag`, `circleMap.css`, `lib/circleMap`, the `Competence*` types, `api.getCompetence/putCompetence/deleteCompetence`, `LEVEL_LABEL`, `STATUS_LABEL`, `STATUS_CLASS` and `circleSegments` in `lib/rituals.ts`, the Circle backdrop, band position, brazier and fog-stake helpers in `lib/roomArt.ts`, the two Circle rows in the e2e smoke lists. All their tests.
- **Docs:** the two Circle-only write-ups (`circle-design-2026-10-09`, `game-identity-circle-2026-10-09`); the Circle lines in the architecture doc, the docs index and the game visual-identity skill, standard and playtest agent. Dated sprint plans, reviews and the progress archive still mention the page: they are history and were left as written.

## One change beyond the page: the survey drops to four facts
The Map's fog survey had a fifth check, "Circle marked", that could only be cleared on the Circle page. With the page gone it could never clear, so it was removed (rule: a change to the checks is a new version).
- `survey-v1` (five checks) became **`survey-v2`** (four: report opened, analysis fresh, invalidation written, valuation available).
- Each tower on the Map now has four fog patches. The valuation patch moved to the middle of the base so the tower stays symmetric. "Five facts per tower" copy became "Four facts per tower".
- The Map used the Circle data only to learn each holding's sector; it now reads the sector straight from the game state.

## Kept on purpose
- **Every Stitch picture and its manifest entry** (`backdrop-circle`, `crest-circle`, `badge-circle`, `circle-stone`, `circle-stone-low`, `circle-brazier`, `circle-stake`). Nothing renders them now; `getObjectArt("<id>")` still returns them.
- **The `competence_marks` table and its migration (`r1d9e0f1a2b3`).** No migration was written, so any marks Faiz saved are still in the database, unused. Dropping the table needs an explicit ask (CLAUDE.md, destructive operations).
- **The `circle_of_competence_summary` field in the analysis output.** That is the Buffett/Munger moat analysis in the normal app, not this page.

## One unrelated fix
`tests/integration/test_risk_api.py` cached its shared snapshot in a dict keyed by `id(db_session)`. A recycled Python id returned a row from an earlier test that was already deleted, so `test_refresh_endpoint_forces_a_provider_call` failed depending on memory layout (it started failing once this change moved things around). The cache now lives on the session itself.

## Verified
Backend: `ruff check` clean, `pytest` 1,918 passed, 2 skipped (`MACRO_DATA_PROVIDER=none`). Frontend: see the PR for the final numbers. Not run: the CI migrations job, e2e smoke (needs a deployed frontend), a look in the browser.

## To restore
Revert the merge commit of this PR. Nothing was dropped from the database or the picture set, so no data or art needs regenerating.
