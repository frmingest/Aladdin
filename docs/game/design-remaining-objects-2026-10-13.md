# Design: closing plan and last Stitch objects (2026-10-13)

Status: **closed 2026-10-13.** The seven pictures are merged (#129) and the last three backdrops are wired on `feature/design-backdrops` (PR to review, not merged). Supersedes "Still missing for the rooms" in [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md).

## Standing rule

Whenever a new Google Stitch picture is needed, Claude says so at once, with a short non-technical description of what to generate. A slot is never left empty or silently left on its SVG without telling Faiz.

## Done (2026-10-13)

- **Room crests** (`crest-council`, `crest-records`, `crest-circle`, `crest-chronicle`, `crest-map`, 192 px, 12-14 KB each): the round gilded medallion replaces the shield in each room's banner (`Crest`), and a 20 px copy sits before each room's name in the tab strip (`FortressTabs`). Decoration only: the title and tab label still name the room, the active tab keeps its lozenge and `aria-current`. Art off, or a failed load, keeps the shield and the plain tab. Siege, Marketplace and Fortress have no crest picture and keep the shield.
- **Council chair** (`council-chair`, replaced): a proper high-backed armchair with teal cushion instead of the earlier lectern-like picture. It is the fallback seat; the advisors normally sit in the consolidated `council-sit-*` pictures.
- **Shopkeeper "ready"** (`shopkeeper-ready`): the smiling face, so all five store verdicts now have a face and the SVG merchant remains only the fallback.

- **Room backdrops** (`backdrop-council`, `backdrop-circle`, `backdrop-map`, 960 px wide, 24, 14 and 37 KB, opaque, key mode `none`): behind the banner like Records and Chronicle, with the same dark wash. Each shows its own band of the picture (`roomBackdropPosition`): Council the table row (above the faint empty panels baked into the bottom of that picture), Circle the standing stones on the horizon, Map the instruments on the desk. Decoration only, empty alt text, lazy, art mode only; a failed load leaves today's banner. Five backdrops in all, the budget maximum.

## Decided (Faiz, 2026-10-13)

- **Default art:** stays opt-in; Game mode is not on for a fresh browser.
- **Fortress on a phone:** keeps the sideways scroll (720 px scene on a 390 px screen).
- **Sprint 7 (#131):** merged; Faiz says it is redeployed.

## Still open

- Live browser specs against the deployed site (`npm run smoke`, `npx playwright test e2e/game-pages.spec.ts`), not yet run by Claude.
- The Council backdrop is the darkest of the five under the wash; judge it on the live banner.

Unused masters (kept in `art-masters/`, not packed): pin, wave tile, signpost, telescope, lantern post, sundial, weathervane, cairn, pigeonholes, tomes, gavel, planted flag, the tower-on-teal-disc crest.
