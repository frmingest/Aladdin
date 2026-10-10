# Art pack trial — 2026-10-10

Status: **written, tested, not merged, not deployed, not yet seen on real data.** Branch `feature/art-pack-trial`. Checked in a headless browser only (room banners, tab strip and loose parts, desktop and phone width; the API was unreachable, so no real game data).

Faiz generated artwork with Google Stitch (prompt pack: `claude/stitch-art-prompts-2026-10-09.md` in the Claude project). Batch 1 was three files (P2 banner v2, P5 table, P7 parchment); batch 2 ("do all images") processes and wires the rest. Nothing here changes data or logic; it is images and CSS behind one switch.

## What it does (game mode only)

| Piece | Source file | Where it shows |
|---|---|---|
| Header plate | P2 banner v2, cropped to its real 1280×192 band, baked-in crests painted out so the room's own crest and title sit on the plate | Every room banner (`GamePageHeader`), title and actions centred on the plate; the code torches are dropped because the art has its own |
| Table edge | P5, top 136 px only (candle, divider, inkwell) | Above the Map page content (`TableEdge`) |
| Grain | P7, border cropped, made seamless, normalised to mid-grey | Over the dark `.nightpanel` (soft-light blend) |

### Batch 2 (all remaining images)

| Piece | Source | Where it shows |
|---|---|---|
| Room scenes | P3 top strip (chandelier, archway; figures cropped out), P12 | Council banner; Records and Chronicle banners. Other rooms keep the plate. A dark scrim keeps the title readable (`bannerArtFor`, tested) |
| Tab emblems | P10, split into 8 round icons | The Fortress tab strip, one per room (hidden in Plain view) |
| Advisor portraits | P13 Oracle, Partner (faces cropped round) | `Portrait` in the advisors card, replacing the drawn busts (hidden in Plain view) |
| Iron corners | P15 top-left corner, background keyed out, arms faded | The four corners of the Fortress frame |
| Wax seal | P8 blank seal | Behind the lamp on the scroll seal and as the Scrolls library seal |
| Mist | P6 one patch, softened to about 38% | Corner of the fog panel (fog still means "unknown", so it states no fact) |

Kept out of the app on purpose (all in `frontend/public/art/library/`, about 0.9 MB, not loaded by any page): P3 full (three seated figures would claim three advisers), P4 ring map (baked rings and fog), P5 full (baked fog), P11 siege A/B/C (baked weather/tent state would contradict the real siege level), P14 sprites sheet and P9 crest (the app already draws a per-room crest and the ring is wrong for some rooms), P8 symbol seals (their symbols have meaning the app does not give them), P13 Sal, P1 anchor, P2 v1, the five fog patches.

Why P5 is only a strip: the full painting has five fog patches baked in. Baked fog would say "five unsurveyed areas" whatever the survey found, which breaks the truth rule in `game-ui-standards.md`. The strip has no fog. To use the whole painting, regenerate it with no fog on the parchment.

Why P7 went on the dark panel: as delivered it is dark grey noise, not parchment, so it textures the dark Night panel. The light `.parchment` panel is unchanged.

## How to revert (any one of these)

1. **Per browser, instantly:** press **Painted art** in any room banner (or open any URL with `?art=off`). It is remembered. `?art=on` turns it back on.
2. **For everyone:** set `ART_PACK_DEFAULT = false` in `frontend/src/lib/artPack.ts`. Browsers that never chose then see no art.
3. **Remove entirely:** do not merge the PR, or `git revert` its merge commit. The wired images live in `frontend/public/art/` (about 0.3 MB; `library/` is unreferenced) and every CSS rule is under `html[data-art="on"]` or the art-only classes, so deleting them leaves no trace.

With the switch off, the banner, Map page and Night panel are exactly as before.

## Known rough edges

- Faint lighter rectangles remain on the plate where the baked crests were; they are subtle behind the title.
- Plain view hides the banner entirely, so the Painted art button is not reachable there; use `?art=off`.
- Not yet seen on Faiz's real data. Portraits, seals, fog and corners were checked as loose parts in a headless browser, not inside the real Fortress, advisors card or scroll reader.
- The fog patch is softened to about 38% and may be barely visible on some panels.
- The Council scene is a strip of a bigger painting; the Council room still shows its own advisers from real data.
- The originals in `E:\Aladdin\frontend\public\art` stay untracked on his machine; only the processed WebP files are in the PR.
