# Council and Chronicle removed from Game mode (2026-10-18)

Status: written and tested, **not merged, not deployed, not seen in a browser.** Branch `feature/remove-council-chronicle`, off `main` `26ca4ce` (#183). Faiz asked for both pages, and everything only they used, to go; Stitch pictures stay.

## Removed
- **Pages and routes:** `/fortress/council`, `/fortress/chronicle`, their two tabs in the Fortress strip, and the "Open the Chronicle" link on the Night Watch card.
- **Backend:** `GET /game/council`, `GET /game/council/ask`, `GET /game/chronicle`; `chronicle.py`, `council_ask.py`, `council_questions_v1.py`; `build_council` and its schemas; the Chronicle and Council schemas; `missing_ranges` and `Gap` (only the Chronicle used them); the rules fields `chronicle_max_frames`, `council_max_names_per_item` and `agenda_order`. All their tests.
- **Frontend:** `CouncilPage`, `ChroniclePage`, `CouncilChamber`, `CouncilLectern`, `CouncilQuiet`, `ChamberFurniture`, `TimeStrata`, `strata.css`, `lib/chronicle`, `lib/councilAsk`, `lib/councilSeats`, the Council and Chronicle crest, backdrop, props and badge mappings, the Council styles in `index.css`, the word budget for the chamber, the two pages in the e2e smoke lists. All their tests.
- **Docs:** the two Council-only write-ups (`council-fewer-clicks`, `council-engagement-ideas`); the Council halves of the Records-shelf, Circle design and page-scene-kit docs (renamed `records-shelf-books`, `circle-design`, `game-identity-kit`); Chronicle and Council lines in the Sprint 24, Sprint 25 and B1 write-ups, the README index, the game skill, standard and agent files. Dated sprint plans, reviews and the progress archive still mention both pages: they are history and were left as written.

## Kept on purpose
- **Every Stitch picture and its manifest entry** (`frontend/src/assets/art/`, `artManifest.ts`, `scripts/art/`): the `council-*`, `backdrop-council`, `backdrop-chronicle`, `crest-council`, `crest-chronicle` pictures, plus the hourglass, sconce, strata block and covered plot. Nothing renders them now; `getObjectArt("<id>")` still returns them for another feature.
- **Night Watch (G16)** and the nightly stored frames it compares (`history.py`, the worker job, no migration). Its diff code moved from `chronicle.py` to `frame_diff.py` and the schemas were renamed `Chronicle*` to `Frame*` (same JSON).
- **Records, Circle, Ravens**, the seal art (`SealArt`, used by `Speaker`) and `WALL_FILL` (moved to `lib/wallRise.ts`).

## Not touched
No migration and no database change. Stored frames in `computed_snapshots` stay.

## Verified
Backend: `ruff check` clean, `pytest` 1,924 passed, 2 skipped (`MACRO_DATA_PROVIDER=none`). Frontend: `tsc --noEmit` clean, `npm run lint` 0 errors (2 existing warnings), `npm test` 881 passed, `npm run build` OK. Not run: CI migrations job, e2e smoke (needs a deployed frontend), a look in the browser.

## To restore
Revert the merge commit of this PR. The Stitch pictures were never deleted, so nothing needs regenerating.
