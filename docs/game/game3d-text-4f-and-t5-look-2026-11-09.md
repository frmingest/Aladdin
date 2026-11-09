# 3D text pass 4f (Night Watch lines) and the first browser look (T5), 2026-11-09

Two small pieces from [remaining work](../sprints/remaining-work-2026-11-06.md). 4f is written and tested, in a PR, not deployed. The look is of the live site on `main` at `429e4a4` (#317), in the built-in browser.

## 4f: the Night Watch's backend sentences, in game voice
- **Problem:** the Night Watch panel in `/game3d` already had game words for its title, status and stamp (4d), but the lines under them are written by the backend: "No fortress frame has been stored yet, so the dispatch cannot say what changed. The worker stores one a day.", "4 earlier tripwire(s) are still firing on 2 tower(s)."
- **Fix:** `game3d/watchLinesWordsV1.ts` rewrites each known backend sentence on the 3D card only ("No look is saved yet, so the Watch can't say what changed. It saves one a night.", "4 earlier tripwires are still lit on 2 towers."). The headline and the small fact lines go through it too. Counts, names and hours are copied from the sentence, and singular counts read as singular (no "(s)").
- **Safe by design:** a sentence it does not know comes back untouched, so a new backend line is never dropped or guessed. The backend and the flat Fortress are not edited. The card's "new report" filter still reads the backend text before the rewrite.
- **Tests:** `watchLinesWordsV1.test.tsx` runs every backend template (`watchLinesSamples.ts`) through it: no "worker", "frame", "stored", "dispatch" or "(s)" left, numbers kept, unknown sentences unchanged. `NightWatchCard` tests still pass. `tsc` (no errors in these files), `eslint` (0 errors) and the Watch tests pass here; the full vitest run is left to CI because it does not finish in the time one shell call gets on this mount.
- **Still open in text pass 4:** temperament event explanations (backend `rule`-keyed text), Council and standing labels, the frame-change lines the backend writes with numbers in them (wall, moat, thesis), and the Realm "Buy/Sell" call (Faiz).

## T5: first look at the live `/game3d` (phone-sized pane, one angle per place)
| Place | What the pane showed |
|---|---|
| Courtyard | Loads; top menu shows Quests, Towers, Where to?, Sound off (M). So polish 5 is live. No bare white labels. |
| Siege Field (`?at=siege`) | Banners on the wall sections carry the name and a chalked loss ("▼ -17.5%", "▼ -5.9%", "▼ -4.1%"), readable against the sky. No sentence floats in the sky. World tags are empty when far, as the near-only reveal intends. |
| Weather Tower (`?at=weather`) | Opens, header says "22 of 22 dials reading", so the catalogue v3 data is in. From the entrance the four dials show plain white faces with a centre dot and no visible needle or numbers. **Not judged:** could be the angle. Needs a closer look. |

**Not done (needs a person or more time):** fps (P), sound (cannot be heard from here), Library, Town Hall, the Town at night, the Battlefield, the holding land, a desktop-width window, and walking up to a label to see it appear. T5 is therefore half done; the plan's before/after screenshots are not made.
