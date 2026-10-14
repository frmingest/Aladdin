# Removed: four unused manual portfolio endpoints (2026-10-14)

**Status:** written and tested, not merged, not deployed. Branch `fix/remove-unused-manual-endpoints`, off `main` `5135a8f`.
Decision: from the 2026-10-04 housekeeping list ("remove the 4 manual snapshot/position endpoints that no screen calls"),
decided by Faiz on 2026-10-14. CSV import (`POST /portfolio/import-csv`) is the only way to add a snapshot.

## Removed (backend/app/api/portfolio.py)

| Endpoint | Why it was safe |
|---|---|
| `POST /portfolio/snapshots` | no screen calls it; the frontend `api.ts` has no function for it |
| `POST /portfolio/snapshots/{id}/positions` | same |
| `DELETE /portfolio/snapshots/{id}/positions/{position_id}` | same |
| `GET /portfolio/snapshots/{id}/concentration` | same; the overview computes concentration itself (`portfolio_overview.py`) |

Also removed because only these used them: schemas `PortfolioPositionIn`, `PortfolioSnapshotCreate`, `ConcentrationOut`,
the helper `_validate_position_refs`, and a duplicate `SNAPSHOT_STATUS_PROCESSED` constant (the import service has its own).

**Kept:** `GET /portfolio/snapshots`, `GET /portfolio/snapshots/{id}` (Portfolio page detail), `DELETE /portfolio/snapshots/{id}`,
`DELETE /portfolio/all` (both still need `confirm=true`), `POST /portfolio/import-csv`, `GET /portfolio/overview`, and
`herfindahl_hirschman_index` (the overview and fund metrics use it).

## Tests

Tests that built a snapshot through the removed `POST` now build it in the database (`_make_snapshot`) and still cover list,
get, delete (confirm and cascades), legacy-table purge and the bulk wipe. Tests of the removed endpoints themselves are gone,
replaced by one test that the four are no longer served. The demo-mode write guard list lost its entries for them.
`ruff check .` clean; full backend suite passes (`MACRO_DATA_PROVIDER=none`). Frontend untouched.

## After deploy

Nothing to do. If an old script of yours posted snapshots by hand, it now gets 404/405: use the CSV import.
Historical docs (`docs/features/account-name-position-data-macro-speed-2026-09-22.md`, the demo-mode doc) still mention the
old endpoints; they are dated records and were left as written.
