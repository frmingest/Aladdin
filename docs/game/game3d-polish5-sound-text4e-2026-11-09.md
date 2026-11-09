# 3D polish 5 (opt-in sound) and text pass 4e (market stall plates), 2026-11-09

Two small PRs-in-one-branch from the open lists in [remaining work](../sprints/remaining-work-2026-11-06.md). Written and tested; not seen in a browser, not deployed.

## Polish 5: sound, off until you ask
- **What:** a Sound button in the `/game3d` top menu, and the M key. Off on every load and never remembered; browsers only allow audio after a press, and a page that shows real money should not make a surprise noise. The button is hidden where the browser has no Web Audio.
- **How:** reuses the Fortress's synthesized wind (`lib/fortressSound.ts`: filtered noise, no files, no network, hard gain ceiling). New: `game3d/soundPlan.ts` (pure rules), `game3d/useAmbience.ts` (the switch), a `sound` prop on `Toolbar`.
- **Rules:** outdoors the bed follows the stored siege level the sky and clouds already show (calm wind, fuller as it turns, low rumble in a siege). Every indoor room gets the quietest bed. Unknown weather never sounds like a storm. Sound carries no fact a sighted player lacks and never plays on a trade.
- **Tests:** `soundPlan.test.ts` (outdoor follows level, indoor quiet, unknown quiet, M clashes with no key), Toolbar test (button only when supported, says on or off).
- **Faiz to check:** press M in the courtyard, walk into the Town Hall (should go quieter), try it on a phone (tap the button).

## Text pass 4e: market stall plates
- **Before:** the plate under each stall used the flat Marketplace's words: "In range · +4%".
- **After (`stallPlateWordsV1.ts`):** a short word for how the price sits against yours, then the gap in words: "In reach · 3% under", "Close · 4% over", "Too high · 30% over", "No price". Numbers stay exact; the sign is said in words. Unpriced never gets a number. The flat page keeps its own words; flags, tones and gaps still come from the same data.
- **Removed:** the unused `plateWords` in `streetPlan.ts` (and its test); the new file has its own tests.
- **Still open in text pass 4:** backend-written text (Night Watch lines, temperament explanations, Council and standing labels) and the Realm "Buy/Sell" decision, which is Faiz's call.

## Checklist section A
1. Pages touched: `/game3d` top menu (all areas), the Market Street stalls.
2. Identity before/after: unchanged (sound is an extra; plates keep the same painted plank).
3. Visual verb + scene: stall plates stay planks on two stakes, now with game-voice words; sound is wind over the courtyard.
4. Words: plate words are shorter and say over/under instead of a bare sign.
5. Rules kept: unknown is fog, no sound on trades, off by default, reduced-motion unaffected (no animation added).
6. Taps: sound is 1 tap or 1 key.
