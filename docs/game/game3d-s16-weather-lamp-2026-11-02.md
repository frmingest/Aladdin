# 3D courtyard S16, PR 3 of 3: the weather, the realm's verdict and the Magic Lamp (2026-11-02)

**Status: written; `tsc`, `eslint`, `vitest` (149 files, 1,238 tests) and `npm run build` pass; seen and clicked through in a headless browser on made-up sample data (pictures below); not merged until you merge the PR, not deployed, not seen on real data. The painted clouds and the sky tint were not seen in a picture (the headless camera cannot look up): they are covered by tests only.** Branch `feature/game3d-weather-lamp`, off `main` at `7da9228` (#249, S16 PR 2, is merged).

## What a sprint is for (plain words)

The flat Fortress tells you three more things the 3D world could not: **what the weather is** (calm, storm clouds, under siege), **one verdict on the whole fortress** (the card you get by pressing the Great Keep), and it has the **Magic Lamp** with its three wishes. This step gives each of them a place in the courtyard. In every case the *same* card and the *same words* as the flat page open, so the two can never disagree. This finishes S16.

## What you will see

- **The Realm post**, a banner pole on the road between the fountain and the keep door. The pennant on top is the verdict on the whole fortress, told by **shape and word**, never by colour alone: a square "Look first" (needs a look), a triangle "Mixed", a disc "No flags", an open ring "Unknown ?". A second small plate under it says the weather in the flat page's own words ("Calm skies", "Storm clouds gathering", "Under siege", "Weather not surveyed"). Press **E**: the flat "The whole fortress" verdict card opens in a panel, with its look-first list and its rules. A fortress that cannot be read is the ring, **never** the calm disc. ([needs a look](img/game3d-s16-3-realm-post-attention-2026-11-02.png), [no flags](img/game3d-s16-3-realm-post-calm-2026-11-02.png), [unknown](img/game3d-s16-3-realm-post-unknown-2026-11-02.png), [panel](img/game3d-s16-3-realm-panel-2026-11-02.png))
- **The weather over the walls.** The sky and fog follow the backend's storm level: **calm keeps the courtyard's own sky exactly as it was**; storm clouds gathering turns it grey-blue and hangs seven flat painted clouds; under siege is darker with nine; weather not surveyed (or unreadable) is a **pale mist that closes in, never a calm sky**. Only the sky and fog colour change. **No light on any tower changes** (flat neutral lighting stays), and nothing moves.
- **The Magic Lamp on the writing desk**: a small brass lamp on the desk top. Open the desk (E), press **Rub the lamp**: the flat page's own Genie opens with the same three wishes (they only add rows to the analysis queue; the analysis runs later on your PC). In demo mode the Genie says his magic is only scenery. Escape or Close puts you back at the desk. ([Genie](img/game3d-s16-3-lamp-genie-2026-11-02.png))

## How it works (short)

- `weatherPlan.ts` (+ 5 tests): `weatherLook(level)` gives sky, fog and cloud count; cloud strength is taken from the flat sky's own `siegeSky`, so the two never disagree. Fixed cloud slots: worse weather adds clouds and never moves one. Never works out a level.
- `realmPlan.ts` (+ 8 tests): where the post stands, its reach, `pennantLook(level)` (shape, word, colour; null is "unknown"). The level itself comes from `summarizeRealm` in `lib/realmVerdict.ts`, the same function the flat card calls.
- `RealmPost.tsx`, `Weather.tsx`: code-built, same ink outline, no light, no animation. `RealmPanel.tsx` hosts the flat `RealmVerdict` card as it is (the holding links go to the flat holding page).
- `MagicLamp.tsx` gained an `embedded` mode (no corner lamp, the Genie dialog opens at once, closing tells the parent). The flat page's lamp is unchanged (a test checks both). `DeskPanel.tsx` gained the "Rub the lamp" button. `Desk.tsx` draws the lamp.
- New strings are in a new version file (`realmWordsV1.ts`). No backend change, no endpoint, no migration.

## What the checks caught

1. **My first spot for the Realm post was too close to the desk and the vault chest.** At z = -12 it sat inside the reach of both, so E could mean two things. The placement test (every reach added together, as for the Vault) failed; it now stands at z = -6, on the road between the fountain and the keep door.
2. **My first "needs a look" colour was orange.** The no-red-or-green test flagged it; it is now the warm yellow the Vault coins use.
3. **Walking to the post by hand in a headless browser was too imprecise** at low frame rates. To click through the prompt, panel and lamp I used a **throwaway build (not committed) with the post and the desk moved next to the spawn**; the real positions are covered by the placement tests, not by that click-through.

## Game sprint checklist

Pages touched: `/game3d` only; flat pages unchanged except one optional prop on `MagicLamp`. Identity: stays 3 (verbs *read the banner*, *rub*; scenes: a banner pole, a stormy sky, a lamp on a desk; facts: the realm's level, the weather level). Words: the flat pages' own, plus a few short new ones in a version-1 file; no buy or sell words (a test checks the plate words). Colour: pennants are yellow, teal, cream and slate; skies and clouds are grey-blue; no red or green, and shape plus word carry the meaning. Reduced motion: nothing moves. Performance: a handful of small code-built meshes and at most nine flat clouds (not measured: software rendering). Taps from a cold load: walk up, E (1) for the verdict; E at the desk then one click for the lamp (2).

## Decisions I took (you may overrule)

- **A post, not the keep itself.** The keep is a model with a collider; a pole on the road in front of it needed no new interaction rules beyond the ones the Vault chest already has.
- **The lamp lives in the desk panel**, not as a second thing to walk up to: one place for "write, read, wish", and no new reach to clash with the desk's.
- **The Genie opens at once** (no rubbing animation): the button is the rub.
- **Weather is a sky tint and flat clouds only**, no rain or fog banks on towers, so the "no light changes with weather" rule holds.

## Not done / not checked

- **The clouds and the sky tint were not seen in a picture** (headless, camera cannot tilt up); only the horizon is visible in the shots. Please look up in `/game3d` with the sample fortress and with a real storm level.
- Not seen on Railway or on real data; not deployed. The pictures use made-up data in a headless browser with software rendering (no fps number is meaningful).
- A real wish (not demo mode) was not made; the lamp's wishes are the flat page's own `queueReadyHoldings` call, unchanged.
- The flat Fortress page still keeps its own cards; nothing there changed.
