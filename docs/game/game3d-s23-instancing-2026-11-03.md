# 3D S23 PR 2: a lighter courtyard (2026-11-03)

**Status: written and tested, checked in a headless browser only, not looked at in Faiz's browser, not merged, not deployed.** Second step of [S22 and S23](game3d-s22-s23-sprint-plan-2026-11-02.md), after the measuring in [PR 1](game3d-s23-measure-2026-11-03.md) (#270, merged).

## What changed (plain words)

Every still piece in the courtyard (walls, scenery, stalls, furniture, tower bodies) was its own draw, plus its own ink outline. Now still pieces that look the same (same material, same shadow flags) are joined into one shape in the place they already stand, so the graphics card gets one order for many pieces. The look is meant to be identical. The original pieces stay in the scene, hidden, so nothing that built them is disturbed.

Also fixed: the P overlay now skips parts the camera cannot see (as the renderer does), so "parts add up to" matches the real total.

## Where it is used

`StaticBatch.tsx` wraps: models (`PropMesh`), scenery, market pieces, keep models, courtyard walls and pads, drill post, signpost, desk, vault, watch post, realm post, standing torches, tower bodies and Market Street stalls. Pieces that show a fact rebuild their batch when it changes (`rebuildKey`): books on the desk, coins in the vault, the watch mark and lit state, the realm level and siege, the torches lit, a tower's own data, the stall list.

## Stays unbatched on purpose

People (skinned, animated), the horizon (already instanced), the hero, flames and anything see-through (draw order), mirrored pieces, hidden pieces, and anything flagged `userData.noBatch`.

## Numbers

Headless browser, software graphics (about 2 fps, but draw counts are valid), same view:

| Case | Before | After |
|---|---|---|
| Courtyard, no towers or stalls | 366 draws | 234 draws |
| With 7 sample towers and 6 stalls | 505 draws, 625 shapes in memory | 298 draws, 301 shapes in memory |

Triangles are unchanged (139k). A pixel comparison of the two runs differs by 490 of about 1M pixels, around the animated characters only. Your live baseline was 650 draws; the live number with real data is **not known yet**. People (98 draws) and the tower library (264) are untouched: the library is a job for S25 and PR 3.

## Switch

Open `/game3d?nobatch` to turn batching off and compare in the same session.

## Tests

`staticBatch.test.ts` (the world-space triangles are identical before and after, none lost or added, different materials / outlines / shadow flags stay apart, hidden / flagged / mirrored / see-through left alone, rebuild after a change, undo) and a view test in `perfGroups.test.ts`. `tsc`, lint, 1437 tests and build pass.

## What Faiz does

After deploy: press P in the courtyard and send the box (compare with 650 draws; goal 300, then 150). Look at towers, stalls, the desk, the vault and torches; if anything looks off, add `?nobatch` and tell Claude what differs.

## Next

S23 PR 3: the Town, shared colour sheets and textures, a lighter tower library.
