# Design: closing plan and last Stitch objects (2026-10-13)

Status: **the seven needed pictures arrived and are wired (branch `feature/design-last7-crests`, PR to review, not merged, not deployed).** Three optional backdrops remain. Supersedes "Still missing for the rooms" in [design-master-sprint-plan-2026-10-11.md](design-master-sprint-plan-2026-10-11.md).

## Standing rule

Whenever a new Google Stitch picture is needed, Claude says so at once, with a short non-technical description of what to generate. A slot is never left empty or silently left on its SVG without telling Faiz.

## Done (2026-10-13)

- **Room crests** (`crest-council`, `crest-records`, `crest-circle`, `crest-chronicle`, `crest-map`, 192 px, 12-14 KB each): the round gilded medallion replaces the shield in each room's banner (`Crest`), and a 20 px copy sits before each room's name in the tab strip (`FortressTabs`). Decoration only: the title and tab label still name the room, the active tab keeps its lozenge and `aria-current`. Art off, or a failed load, keeps the shield and the plain tab. Siege, Marketplace and Fortress have no crest picture and keep the shield.
- **Council chair** (`council-chair`, replaced): a proper high-backed armchair with teal cushion instead of the earlier lectern-like picture. It is the fallback seat; the advisors normally sit in the consolidated `council-sit-*` pictures.
- **Shopkeeper "ready"** (`shopkeeper-ready`): the smiling face, so all five store verdicts now have a face and the SVG merchant remains only the fallback.

## Still open

- Three optional wide backdrops, quiet and muted, no people or writing: **Council** (candle-lit stone chamber, empty), **Circle** (grassy clearing at dusk, standing stones faint in the distance), **Map** (cartographer's desk from slightly above, parchment edge and a few instruments). Packed with key mode `none`, each at most 120 KB, behind the banner.
- Sprint 7 last: Fortress phone performance, identity re-score with screenshots, colour-blind pass, decide the default art, update the visual-identity standard.

Unused masters (kept, not packed): pin, wave tile, signpost, telescope, lantern post, sundial, weathervane, cairn, pigeonholes, tomes, gavel, planted flag, the tower-on-teal-disc crest.
