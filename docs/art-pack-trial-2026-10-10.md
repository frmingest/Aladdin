# Art pack trial — 2026-10-10

Status: **written, tested, not merged, not deployed, not yet seen on real data.** Branch `feature/art-pack-trial`. Checked in a headless browser only (Map page, desktop and phone width, art on and off).

Faiz generated artwork with Google Stitch (prompt pack: `claude/stitch-art-prompts-2026-10-09.md` in the Claude project) and chose three files to try: P2 header banner v2, P5 Cartographer's table, P7 parchment texture. Nothing here changes data or logic; it is images and CSS behind one switch.

## What it does (game mode only)

| Piece | Source file | Where it shows |
|---|---|---|
| Header plate | P2 banner v2, cropped to its real 1280×192 band, baked-in crests painted out so the room's own crest and title sit on the plate | Every room banner (`GamePageHeader`), title and actions centred on the plate; the code torches are dropped because the art has its own |
| Table edge | P5, top 136 px only (candle, divider, inkwell) | Above the Map page content (`TableEdge`) |
| Grain | P7, border cropped, made seamless, normalised to mid-grey | Over the dark `.nightpanel` (soft-light blend) |

Why P5 is only a strip: the full painting has five fog patches baked in. Baked fog would say "five unsurveyed areas" whatever the survey found, which breaks the truth rule in `game-ui-standards.md`. The strip has no fog. To use the whole painting, regenerate it with no fog on the parchment.

Why P7 went on the dark panel: as delivered it is dark grey noise, not parchment, so it textures the dark Night panel. The light `.parchment` panel is unchanged.

## How to revert (any one of these)

1. **Per browser, instantly:** press **Painted art** in any room banner (or open any URL with `?art=off`). It is remembered. `?art=on` turns it back on.
2. **For everyone:** set `ART_PACK_DEFAULT = false` in `frontend/src/lib/artPack.ts`. Browsers that never chose then see no art.
3. **Remove entirely:** do not merge the PR, or `git revert` its merge commit. The three images live in `frontend/public/art/` (`banner-page-dark.webp`, `table-edge.webp`, `grain-tile.webp`, about 50 KB together) and every CSS rule is under `html[data-art="on"]` or `.game-banner-art` / `.table-edge`, so deleting them leaves no trace.

With the switch off, the banner, Map page and Night panel are exactly as before.

## Known rough edges

- Faint lighter rectangles remain on the plate where the baked crests were; they are subtle behind the title.
- Plain view hides the banner entirely, so the Painted art button is not reachable there; use `?art=off`.
- Not yet seen on Faiz's real data or on the Circle page's Night panel (the grain), only checked on the Map page in a headless browser with the API unreachable.
- The other generated images in `E:\Aladdin\frontend\public\art` (untracked on his machine) are not part of this PR.
