# 3D courtyard S16, PR 3 of 3: weather, the verdict banner and the lamp (2026-11-02)

**Status: written; `tsc`, `eslint`, all 1232 tests and the build pass on a case-sensitive Linux checkout; not merged, not deployed, not seen in a browser (no headless screenshot was taken this time).** Branch `feature/game3d-fortress-panels-3`, stacked on `feature/game3d-fortress-panels-2` (PR 2, not merged yet). Merge PR 2 first; this PR retargets to `main` by itself.

## What a sprint is for (plain words)

The flat Fortress tells you three more things the 3D world could not: what the weather is, the one-line verdict on the whole fortress, and the Genie in his lamp. This step gives each a place in the world. In every case the flat page's own words and card open, so the two cannot disagree.

## What you will see

- **The sky follows the weather.** Calm skies is exactly today's sky. Storm clouds gathering: a greyer sky, nearer fog, six clouds high over the walls. Under siege: a darker slate-violet sky, nearer fog, twelve clouds. Weather not surveyed (or unreadable): a pale mist, never a clear sky. No light changes, so no tower is lit kindly or harshly by the weather. No red or green (the flat page's red horizon is not copied).
- **The Great Keep banner.** A tall pole on the cobbles in front of the keep door (x = 0, z = -24). The plate prints the flat verdict's own word with its mark (● no flag, ▲ mixed, ■ needs a look, ? cannot judge); a verdict that could not be read says "Not read yet" with a "?". Press **E**: the flat RealmVerdict card opens in a panel with the weather named in words ("Weather: Calm skies"). "Open these towers first" goes to that holding's flat page.
- **The lamp on the writing desk.** A small brass lamp sits on the desk. The desk panel gains **Rub the lamp**, which opens the flat Genie (same three wishes, same single queue call, same "nothing is analysed yet" honesty, demo mode keeps wishes off).

## How it works (short)

- `weatherPlan.ts` (+ tests): level to sky, fog, cloud count; `cloudSlots` fixed places. `Weather.tsx`: one instanced, unlit mesh for all clouds; nothing moves. `Scene.tsx` sets background and fog from the look; lights are untouched.
- `realmPlan.ts` (+ tests): banner place, reach, `realmLook(level)`. A placement test keeps it out of reach of the desk, Vault, watch post, perch, sign, drill, gate, booths, stalls, every tower door and tower exit, so E never means two things. `RealmBanner.tsx`, `RealmPanel.tsx`.
- `MagicLamp` gained two optional props (`openOnMount`, `onClosed`); the flat Fortress uses it unchanged.
- New strings in `realmWordsV1.ts`. No backend change, no migration, no new endpoint.

## Decisions (you may overrule)

- Banner in front of the keep door, not on the keep itself, so it has a place to walk up to.
- Weather is shown by sky and clouds only, and named in the banner panel; there is no separate HUD chip.
- Lamp lives inside the desk panel (one place to go), like the old books.

## Not done / not checked

- Not seen in a browser or on Railway; cloud counts, sky colours and the banner spot are judged from code and tests only. Please look at calm, gathering, besieged and mist.
- Cut line from the plan taken in the other direction: nothing cut, but the red siege fires on the flat horizon are not drawn.
- Local `tsc` and `build` on `E:\Aladdin` still fail with the old Windows case-clash errors; CI does not.
