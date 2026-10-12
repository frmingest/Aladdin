# Graphics guidelines (written in the hardening sprint, 2026-10-12)

Rules for every new picture in game mode. They restate what the code already enforces
(`frontend/src/lib/artAssets.test.ts`, `scripts/art/pack.py`) and add the checks the
hardening sprint found missing.

## Budget (enforced by `artAssets.test.ts`)

| Limit | Value | State on 2026-10-12 |
|---|---|---|
| One picture | 60 KB (room backdrop: 120 KB) | largest is 46 KB |
| Whole packed set | 2000 KB | **1996 KB used: about 4 KB free** |
| Room backdrops | at most 5 | 2 in use |
| Any image in `public/` | 150 KB | masters live in git-ignored `art-masters/` |

**The set is full.** The next graphics sprint cannot add a picture without either
raising `MAX_TOTAL_KB` (a decision for Faiz, with the reason recorded in the test comment)
or re-packing existing pictures smaller. Decide this before the sprint starts.

## Rules for each new graphic

1. Packed to `.webp` by `scripts/art/pack.py` from a master in `art-masters/`; never
   hand-copied into `src/assets/art/`. Every id is listed in `scripts/art/manifest.json`.
2. The picture carries no fact: no status colour, no count, no text. A slot whose look
   encodes data stays SVG. The SVG stays as the fallback.
3. Decorative: `alt=""`. The same information must be reachable as text (the glyph and
   word kept next to a seal, for example).
4. Only behind the Settings "Object art" switch; with it off, nothing is drawn.
5. Lazy-loaded: pictures load only when a view uses them. Backdrops are opaque and
   `loading="lazy"`.
6. Respects `prefers-reduced-motion`: no animation when it is set.
7. Readable at 360 px wide with no sideways scroll, and in both light and dark.
8. Naming: `kind-name.webp` (`stall-`, `map-`, `backdrop-`, `seal-`), lowercase, hyphens.

## Test required with each new graphic

- Add its id to the manifest and run `npx vitest run src/lib/artAssets.test.ts`.
- Add a render test next to the component (see `circleArt.test.tsx`): drawn with art
  on, absent with art off.
- The page is in `e2e/game-pages.spec.ts` (phone and desktop width, and `?art=stitch`).
  Add a row there if the graphic adds a page.
- Check the page on real data on a phone before merging.
