# Market Street: the analyst's top mark (2026-10-17)

Status: **built on `feature/market-street` (written and tested, not deployed).** Defaults taken: F1 "Top mark", F2 animate in every priced district, F3 90/180 days, F4 no loop, F5 cap 3, F6 no mark for Avoid/Sell yet, F7 static seal under the fog. Built deviations: the seal and printed ribbon sit on the top-right corner of the slim signboard (it shows only the name); an old read beats the fog, so an old unpriced Strong Buy shows "Old mark"; the motion follows the game-feel-engineer doc for the performance rules (one shared observer, transform and opacity only). Original status: spec only. Branch `feature/market-street`. It builds on `docs/game/market-street-redesign-2026-10-17.md` (the lane, the parchment plate, decision D2 that takes the "Buy"/"Hold" badge off the plate face) and keeps `.claude/standards/game-visual-identity.md` and `game-ui-standards.md`.

Faiz asked: "when a company has a strong buy, ask the designers to come up with a cool animation engaging users to look at it."

**Visual verb + scene:** *Spot the seal.* A small gold wax seal is **pressed onto the top-right corner of the stall's parchment plate**, and the plate gets a gilded frame. This happens in the Market Street lane, on every stall whose stored `verdict_rating` is "Strong Buy". The motif is the existing **seal** (the analyst's report is a sealed scroll elsewhere in the game), plus the kit's gilded frame corners. The mapping is pure and lives in `lib/marketStreet.ts`: `topMark(row, now) -> "fresh" | "ageing" | "old" | "fogged" | null` and `animatedMarks(plan) -> Set<rowId>`. The seal shape, frame and motion follow from it (table in section 3). Unknown look: no analysis means no seal at all, never a blank or default seal. An old analysis gets a dashed seal with "Old mark" and no frame. A stall in the fog lane gets a static seal under the mist. **Words it lets us delete:** none of the plate face. The seal is the face-safe replacement for the "Strong Buy" badge that D2 removes. On the key, the "analyst word" pip explanation for these stalls becomes one key item (seal + "Top mark"). **Identity score: 2 before (as seen live). The lane redesign is the work that targets 3. This mark leaves the score where it is** (motion is a bonus, not identity), so it is sequenced **after** the lane redesign lands.

## 1. Three concepts

| | Concept | Visual verb + scene | Verdict |
|---|---|---|---|
| A | **Lantern night.** The lamp over the stall lights up and sparks drift up past the awning. | *Light the lamp.* Lamp post beside the stall, sparks over the stall picture. `Strong Buy -> lamp lit + 6-8 spark particles`. | **Rejected.** The redesign keeps lamps unlit because a glow reads as status. Particles mean many animated layers and a looping feel. Sparks over a good-news stall are fanfare (it flatters). |
| B | **Raven with a banner.** A raven lands on the stall roof and a banner unfurls under it with the word. | *A raven brings word.* Roof ridge of the stall. `Strong Buy -> raven + banner`. | **Runner-up, rejected for now.** Everywhere else in the game a raven means "a new report arrived" (`RavenMark`). Here it would land on a verdict that may be months old, so it would lie about freshness. It also sits on the stall picture, and pictures carry no fact. |
| C | **The analyst's seal.** A gold wax seal presses onto the plate corner. Then one gilded light sweeps once across the plate frame, and everything stays still. | *Spot the seal.* Top-right corner of the parchment plate. `Strong Buy + fresh -> seal + gilded frame + one press and one sweep`. | **Picked.** |

**Why C:**
1. The seal motif already means "the analyst's sealed word" (scrolls, Records). One meaning for one shape.
2. It lives on the code-drawn plate, not on the raster stall picture, so pictures still carry no fact.
3. The end state is static identity (seal + gilded frame). Reduced motion gets the same end state with nothing lost.
4. It is the cheapest: 2 layers, transform/opacity only, done in under 1.5 s, and nothing runs at idle.
5. It invites the *investigate* step (step into the store, read the scroll). It does not invite a trade.

## 2. Spec (template from `game-design-reward-knowing`)

| Field | Spec |
|---|---|
| Player verb | Spot the seal, step into the stall, read the analyst's scroll. |
| Real fact surfaced | The stored analyst verdict on the watchlist row: `row.verdict_rating === "Strong Buy"`, which is the top of the five-word scale. Freshness comes from `analyzed_at` through the existing `evidenceGate` thresholds (fresh <= 90 days, ageing <= 180 days, `MARKET_RULES`). Only `row.verdict_rating` counts. "Buy" and lower get nothing, and the street never reads the reconciled run. |
| Feedback | The seal presses onto the plate corner (once), one gilded sweep crosses the plate frame (once), then a static gilded frame and a seal with the printed words "Top mark". Hover/focus replays the sweep only. No sound, no counter, no HUD change. |
| Unknown / stale | No analysis: no seal (the five dashed pips already say "not analysed"). Ageing (91-180 days): static seal and frame, **no animation**, tooltip gives the age. Old (> 180 days) or no date: **dashed seal, words "Old mark", no gilded frame, no animation**. Fog lane (no price, no price of yours, currencies differ): **static seal under the mist, no frame, no animation**. The analyst's word is a known fact, so it is shown. The price comparison is unknown, so the stall is not spotlighted. |
| Rules kept | **Read-only:** the stall stays a link to the store, and the seal is not a button. **Deterministic:** the trigger and the cap are pure functions of the ordered rows and `now`, with no randomness. **Unknown stays unknown:** sections above. **No buy/sell wording:** "Top mark" / "Old mark" on the face and in the screen-reader text, with "Strong Buy" only in Plain view and normal mode. **Demo mode wins:** demo rows behave the same, the site banner already says the data is painted, and nothing extra is added. **Truth over flattery:** the mark never animates on old or unpriced data, never makes the stall picture bigger, brighter or nearer, and never moves the stall in the lane (street order is unchanged). |
| Rewards rejected | No "3 top marks" counter or HUD tally. No sound, confetti or sparkle loop. No "new!" badge. No memory of what you have seen (nothing in localStorage), so there is no return-visit reward. No extra motion when a sealed stall enters "In range" (that is fanfare for price movement). Nothing that makes acting feel better than waiting. |
| Cheapest prototype | CSS keyframes, one shared IntersectionObserver in `MarketStreet.tsx`, and one new SVG seal variant in the kit (`SealMark` gains a `"top"` kind, or a small `TopMarkSeal` added to `components/fortress/kit/` by `game-feel-engineer`). About half a day after the lane redesign. |
| How we will know it is good | Playtest for Faiz: "Without reading, which stalls did the analyst rate highest, and which of those marks are old?" A second one: "Did the seal make you want to step in and read, or did it feel like an ad?" |
| One thing to cut | Any looping animation (see section 4). |

## 3. Trigger and mapping (pure, `lib/marketStreet.ts`, with tests)

```
topMark(row, now) ->
  null        if row.verdict_rating !== "Strong Buy"
  "fogged"    if districtOf(row) === "fog"            // static seal under the mist, no frame
  "old"       if age === null || age > 180            // dashed seal, "Old mark", no frame
  "ageing"    if age > 90                             // seal + frame, static
  "fresh"     otherwise                               // seal + frame, animates (if within the cap)
  (age = analysisAgeDays(null, row.analyzed_at, now))

animatedMarks(plan) -> the first 3 rows with topMark "fresh", in street order (place)
```

| topMark | Seal | Gilded frame | Printed word | Entrance | Hover/focus |
|---|---|---|---|---|---|
| fresh, within cap | solid gold wax, star glyph | yes | Top mark | press + sweep | sweep |
| fresh, over cap | solid gold wax, star glyph | yes | Top mark | none (static) | sweep |
| ageing | solid gold wax, star glyph | yes | Top mark | none | none |
| old | dashed rim, no wax, star glyph | no | Old mark | none | none |
| fogged | solid gold wax under the mist | no | Top mark | none | none |
| null | none | no | none | none | none |

Tests: only "Strong Buy" yields a mark ("Buy", "Hold", "Sell", "Avoid" and null give null). The fog district always gives "fogged", even when the analysis is fresh. A null `analyzed_at` gives "old". Day 90 is fresh, 91 is ageing, 180 is ageing, 181 is old. With 5 fresh marks, `animatedMarks` returns the 3 lowest places. The same input and `now` always give the same output.

**Several strong stalls at once.** At most **3** stalls animate on a visit. They are the first 3 fresh marks in street order, which are the ones nearest the fountain, so the eye walks down the lane. Every other fresh mark shows its static end state at once. When more than one capped stall enters view together, their entrances are staggered 400 ms in place order.

## 4. Motion, duration, loop

- **Entrance (once per page visit per stall):** it starts when the plate is at least 60% in view (one shared `IntersectionObserver`, threshold 0.6, `unobserve` after the first play). Nothing is stored, so a new visit plays it again, the same way.
  - Layer 1, the seal press: `transform: scale(1.35) translateY(-4px)` to `scale(1)`, `opacity 0 -> 1`, 450 ms, ease-out.
  - Layer 2, the gilded sweep: a pseudo-element strip (soft gold-to-transparent `linear-gradient` drawn once, never animated) moves `translateX(-120%) -> translateX(120%)` across the plate inside `overflow: hidden`, 900 ms, starting 300 ms after the press. One pass.
  - Total about 1.2 s. After that the stall is static.
- **Hover/focus replay:** the sweep only, one pass per hover or focus entry, ignored while a sweep is already running. Only on stalls where `topMark` is "fresh".
- **No loop (recommended).** The standard lists "looping animation as identity" as an anti-pattern, and the redesign asks for "calm, not a bazaar". The option Faiz offered (one slow sweep every 12 s on the first sealed stall only, paused when off-screen or when the tab is hidden) is decision F4.
- **Flash rule:** no luminance flashing. One sweep is one soft pass, under 1 per second per stall. With the stagger the whole screen stays under 3 per second, which clears WCAG 2.3.1.
- **Skippable:** any key press or pointer down on the street adds `is-settled` to every playing mark and jumps it to the end state (`game-ui-standards` 3).

## 5. Reduced motion

`prefers-reduced-motion: reduce` gives the static end state only: the gilded frame and the seal with the printed "Top mark", shown at once. There is no press, no sweep, no hover replay, and the observer is not attached. Nothing about the fact is lost.

## 6. Colour-blind safety

The mark never relies on colour alone. It has a **shape** (a round seal with a star glyph), a **printed word** ("Top mark" / "Old mark"), and a **frame shape** (double rule with four corner studs from the kit's frame corners, not just a gold tint). The old state differs by shape (dashed rim, no wax) and by word, not by fading. Ink text on parchment is at least 4.5:1. The gold sits on the plate next to the tone flag, so it must not be mistaken for a tone: the tone keeps its flag shape and word, and the seal sits in the opposite corner.

## 7. Phone performance budget

- Only `transform` and `opacity` animate. No `filter`, no `box-shadow` animation, no animated gradient position, no SVG filter, no SMIL.
- At most **2 animated layers per stall** (seal, sweep) and at most 3 stalls, so at most 6 short-lived layers. `will-change` is set only while playing and removed on `animationend`.
- No animation runs at idle: 0 running animations about 1.5 s after the last mark enters view.
- CSS keyframes plus one `IntersectionObserver`. No JS animation loop, no `requestAnimationFrame`.
- Check: 390 px on a mid phone, 4x CPU throttle, 30 demo stalls with 5 Strong Buys. No long task over 50 ms, no layout shift (the seal and frame take up their space from the first paint, so only opacity and transform change).

## 8. Words (game voice)

| Place | Text |
|---|---|
| Seal ribbon on the plate (fresh, ageing, fogged) | **Top mark** |
| Seal ribbon (old) | **Old mark** |
| Seal tooltip (`title`) | "The analyst's top word, 34 days ago." / old: "The analyst's top word, 212 days ago. Old: re-read first." / no date: "The analyst's top word. Date unknown." |
| Foldout key, new item | [seal] Top mark |
| Screen reader (appended to `stallLabel`, before "Step inside.") | "Analyst's top mark, 34 days old." / "Analyst's top mark, 212 days old: old." / "Analyst's top mark, date unknown." |
| Plain view | No seal and no motion. The existing `VerdictBadge` "Strong Buy" with title "Stored analyst verdict" stays exactly as it is (Plain view keeps exact wording). |

Rejected words: "Prize stall" (a prize is a reward for the player and hints you win by buying), "Top pick" (stock-tip language, really a buy word), "Hot", "Deal", "Bargain" (selling words, and "deal" is the hype booth's job).

The seal itself is decorative (`aria-hidden`). Its fact is in the stall's one-sentence `aria-label`, so a screen reader hears it once, in order.

## 9. Plain view

Same facts, labelled, without art: the Plain grid's `VerdictBadge` already shows "Strong Buy". Nothing new is added, nothing animates, and the age stays on the freshness pip. Normal mode is unchanged.

## 10. Build order (after the lane redesign, same branch or a follow-up)

1. `topMark` and `animatedMarks` plus tests (pure).
2. Kit: a "top" seal variant (solid and dashed) and a gilded plate frame, added by `game-feel-engineer`, with no inline hex in `MarketStreet.tsx`.
3. Plate markup and CSS keyframes, the reduced-motion block, `is-settled`.
4. The observer, the cap and the stagger in `MarketStreet.tsx`.
5. Look-and-judge screenshots: (a) desktop, 1 fresh Strong Buy. *Do you look at it first, and does it feel like the analyst's word or an ad?* (b) phone, 5 Strong Buys. *Is it calm after 2 seconds?* (c) an old mark next to a fresh one. *Can you tell which is old without reading?* (d) a Strong Buy in the fog lane. *Does it look unpriced first?* (e) reduced motion on. *Is anything missing?* (f) Plain view. *Same facts?*
6. `docs/PROGRESS.md` and `claude/progress.md` in the same PR. Score before/after in the sprint doc (2 before, unchanged by this mark).

## 11. Decisions needed from Faiz

- **F1. The word.** "Top mark" (recommended), or "Analyst's seal". Not "Top pick" or "Prize stall" (section 8).
- **F2. Which districts animate.** Every priced district, including "Further off" (recommended: the mark is about the analyst's word, not your price, and tying motion to "In range" is fanfare). The alternative is In range and Near only.
- **F3. Freshness cut-off.** Animate only on fresh marks (90 days or less), static at 91-180, "Old mark" past 180 (recommended, the same thresholds as the freshness pip).
- **F4. Loop.** None, with hover/focus replay only (recommended). Or one slow sweep every 12 s on the first sealed stall, paused off-screen.
- **F5. Cap.** 3 animated stalls per visit, first in street order (recommended). Or 1.
- **F6. The other end of the scale.** Should "Avoid"/"Sell" get a static, never-animated mark too ("Low mark", cracked seal), so the street does not only decorate good news? Recommended as a follow-up spec. It is not in this build.
- **F7. Fog lane.** Show the static seal under the mist on unpriced Strong Buys (recommended: the word is known, the price is not), or hide it until there is a price.
