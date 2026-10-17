# Siege Simulator: backdrops for "The towers under attack" (2026-10-17)

Status: **written, type-checked and tested; the four Stitch pictures are packed (about 140 KB). Uncommitted, not merged, not deployed, not looked at in a browser.**

## What changed

- **Order on the Siege page:** title, then "The towers under attack", then the Oslo | World banner, toggle and "falls by" slider, then "What it does to the realm". The whole section moved, list included.
- **A picture behind the tower row that follows the "falls by" slider** (Game mode on only). Four moods, picked by the size of the fall (not by the book's own storm and siege lines): **calm** under 15%, **storm** 15 to 29%, **siege** 30 to 44%, **ruin** 45% and up. Pictures cross-fade; with reduced motion they swap.
- **Safe without pictures:** a missing or broken picture leaves the plain dark panel; if only some stages exist, the nearest one is used. With a picture present, the old drawn sky and hills step aside (the grass strip stays so towers always stand on something).
- Code: `fallStage` in `lib/siege.ts`, `lib/siegeBackdrop.ts`, `SiegeTowersBackdrop.tsx`, a `scenery` flag on `SiegeArtStrip`. Art ids to pack: `backdrop-siege-towers-calm`, `-storm`, `-siege`, `-ruin`. Backdrop cap in `artAssets.test.ts` raised 6 to 10 (reason in the comment).

## Stitch descriptions (one picture each, same scene every time)

Shared brief for all four: wide 16:9 landscape, painted fantasy game style matching the other Fortress backdrops, **no text, no numbers, no UI, no people close up, no towers or keeps** (the app draws the towers), a calm empty stretch of dark ground across the bottom fifth, detail kept in the middle band, edges quiet. Soft light, nothing bright at the very top so text above stays readable.

1. **Calm** ("Quiet fields"): "A wide painted valley at golden hour, soft green hills, a still river, a few small fluffy clouds in a warm sky, a peaceful far-off village with thin chimney smoke. Dark earthy ground along the bottom. Peaceful, safe."
2. **Storm** ("Clouds gathering"): "The same valley as the sky turns heavy: grey-violet clouds rolling in, long cold shadows over the hills, wind bending the grass, a few distant rooks, far campfires just visible on the horizon. Dark earthy ground along the bottom. Uneasy, watchful."
3. **Siege** ("Army at the gates"): "The same valley at dusk under a dark red-orange sky: a large enemy camp on the far hills with rows of tents, tiny siege engines and banners, many glowing campfires and a drifting haze of smoke. Dark scorched ground along the bottom. Tense, threatening."
4. **Ruin** ("Burning night"): "The same valley at night: black smoke columns, an ember-red sky, fires burning across the hills, broken fences and scattered rubble, sparks drifting up, a pale moon behind the smoke. Dark ash-covered ground along the bottom. Grim but still painterly, not gory."

## Pictures (packed 2026-10-17)

Faiz's four Stitch pictures (one valley, four moods) are in `art-masters/Design_master/siege_towers_calm|storm|siege|ruin/screen.png`, packed to 960x536 WebP (29 to 33 KB each, quality 74) as `backdrop-siege-towers-<stage>` and listed in `scripts/art/manifest.json` and `artManifest.ts`. The PC helper had no disk space for `pack.py`, so they were packed with the same settings in the cloud and the manifest lines added by hand; re-running `pack.py` later will reproduce them. The original export folder moved out of `public/` to `art-masters/_siegeupdate-2026-10-17/`. Art total cap raised 3000 to 3200 KB (reason in the test comment).

## Verified

`tsc --noEmit` clean; `eslint` on the changed files clean; vitest: 37 of 38 passed in the four relevant files (`siege`, `siegeTowersBackdrop`, `siegeWorldBanner`, `artAssets`). The one failure was already there: a 971 KB Stitch master `public/art/design sprint/.../screen.png` trips "no big images in public/" (it should live in `art-masters/`). Not looked at in a browser; there are no pictures to see yet.
