# The Morning Round: plan, and step 1 as built (2026-11-15)

Issue #412, item 2 of 4 from the 3D review of 2026-11-14.
Status: **steps 1 and 2 merged (PR #416, PR #420), not deployed (not checked). Step 3 (today's round, PR #424) and step 4 (sample round, PR #425) merged (3ac62da, 500981e); deployment not checked.**

## What this is for

Today the 3D fortress looks the same every time you walk in. The Morning Round makes it worth a daily visit: the world
itself points at what changed since you were last here, you walk to each spot, deal with it, and the list empties.
On a day when nothing changed, it says so and you are done in ten seconds.

Rules kept throughout: no points, no streaks, no buy or sell wording, unknown stays fog. The round points at things;
it never rewards a trade.

## The four steps (one PR each)

| Step | What you get | Status |
| --- | --- | --- |
| 1. A place for everyone | Every holding has a building and a land to walk into. The yard held 8; it now holds 18 | Built, merged in #416 |
| 2. The marks | A raven circling, smoke, a bell, a lit stall: one mark per kind of change, standing where the change is | Merged in #420. Spec: `docs/game/game3d-morning-round-marks-spec-2026-11-15.md` |
| 3. Today's round | A short list in the quest log, one line per stop, each ticked off when you have dealt with it; "since last visit" is remembered; a quiet day says "All quiet" | Merged in #424 |
| 4. The sample round | The sample fortress shows a made-up round, so the feature can be seen without real data | Merged in #425 |

## Step 1 as built: no more cap of 8

**Before:** the eight biggest holdings stood in the yard. The ninth and onwards were only in the Towers list and had
no building and no land to enter.

**After:** three rings of spots inside the wall, 18 in all.

| Ring | Spots | Who stands there |
| --- | --- | --- |
| Outer (by the wall) | 8 | Holdings 1 to 8 by weight. **Unchanged**: a fortress of eight or fewer looks exactly as before |
| Inner | 6 | Holdings 9 to 14 |
| Middle (nearest the keep walk) | 4 | Holdings 15 to 18 |

- Every door still faces the middle of the yard, and no building stands in front of another's door.
- Where a holding stands still depends on its weight order only. Never on its verdict, wall, moat or thesis.
- The gate road, the walk up to the keep, the market corner, the drill camp, the desk and the vault are all left clear.
- A 19th holding and beyond still has no room. They stay in the Towers list, which now says "N more than the yard has
  room for" and marks each "(no room in the yard)". See the open question below.

Files: `frontend/src/game3d/outdoorPlan.ts` (the rings), `stateToWorld.ts` (the limit), `TowerPanel.tsx` (two lines of wording).

### How step 1 was checked

- Unit tests: 2,056 pass, with new ones for the rings and for a full yard. Every one of the 18 spots is walked against everything else in the yard: the wall,
  the keep, the corner towers, the market, the camp, both gates, the desk, the vault, the posts, the people, every prop.
  With a full yard, standing at each door enters that holding and no other, and you come back out in front of your
  own door, never inside a neighbour.
- Type check, lint and build pass.
- Seen once in a real browser (Chrome, software graphics) with a made-up fortress of 18: all 18 stand, with their
  signs, and the page shows "Towers 18". Three screenshots from the gate side.
- **Not checked:** a walk round all 18 doors by hand, the frame rate on a phone with 18 buildings, and real data.
  From the gate the far name signs overlap each other when the yard is full; that is a look-and-judge item.

## Steps 2 to 4: the design

### Visual verb + scene

**Follow the signs.** Scene: the fortress yard at first light. Each change is an object in the world you can see from
the gate, and each has its own shape, so it reads without colour.

| Change | Mark in the world | Where | Shape (not colour) | Fact it comes from |
| --- | --- | --- | --- | --- |
| A new report landed | A raven circling above the building | That holding | A moving bird, high up | Ravens (`ravens.py`), not yet seen |
| A tripwire fired | A column of smoke | That holding | Tall, thin, rising | Night Watch, fired and not yet looked at |
| A review is due | A bell on a post, swinging | That holding's door | Low, swinging | Thesis monitor: the thesis is flagged for review |
| A price came into your range | A lit lantern on the stall | Market Quarter gate, and the stall inside | A glow at head height | Watchlist: price at or under the price you wrote down |
| Something moved overnight | A notice pinned at the Watch Post | Watch Post by the gate | A sheet on the board | Night Watch change list (`frame_diff.py`) |

Unknown stays fog: if the night watch did not run, the round says "The watch did not report in", never "All quiet".
The lit stall says "In your range", which is the number you wrote down yourself. It never says buy.

### Today's round (in the quest log)

- At most 7 stops, most urgent first (smoke, bell, raven, stall, notice). More than 7 shows "and N more".
- One short line per stop in game voice: "Smoke at Vår Energi", "A raven for Kongsberg", "Bell: Bouvet is due a look".
- A stop is ticked when you have done the thing at the spot: read the raven, pressed "I have looked" on the wire,
  opened the holding's thesis, looked at the stall. Walking past does not tick it.
- Quiet day: "All quiet since Tuesday. Nothing to do." and no marks.
- Taps: from a cold load the round is already on screen (0 taps), except with real data while First Steps is open: then the round sits under a folded "More quests" (1 tap) (#478). One stop is walk there and press E (1 tap).

### "Since last visit"

The app already remembers one of these on the server: a wire you have marked "I have looked" stays looked at. Ravens
you have read are remembered in the browser. The round would keep the time of your last visit **in the browser** too,
the same way the Guide quests do. No new database table.

The cost: your phone and your PC each keep their own "last visit". A stop you cleared on one can show once more on the other.

### Pictures needed from Google Stitch

**None to start with.** All five marks can be made from parts the 3D world already has (the raven, the embers, the
lanterns, the posts, the notice board). If the bell looks too plain when built, one picture will be needed, and I will
describe it then: "a small bronze hand bell hanging from a wooden post, side view, plain background".

### Checklist answers (section A)

1. **Pages touched:** `/game3d` yard, quest log, Market Quarter gate, Watch Post panel.
2. **Identity:** `/game3d` 3 before, 3 after. The quest log goes from a list of words to a list that mirrors objects you can see.
3. **Visual win:** the marks themselves. They replace the Night Watch's paragraph of text as the first thing you read.
4. **Verb + scene:** above.
5. **Words:** the round is 7 lines of 6 words or fewer. The Night Watch panel keeps its text, one level down.
6. **Kit:** reuses `RavenBirds`, `Embers`, `LanternPost`, `QuestMarks`, the notice board. Adds one piece, the bell.
7. **Cut line:** the "something moved overnight" notice goes first if the sprint runs long. The Plain view and the fog state are never cut.
8. **Rules:** shape before colour for every mark; reduced motion stops the circling, the swing and the smoke (the mark still stands); marks are few and instanced.
9. **Taps:** 0 to see the round, 1 per stop.

## As built (steps 3 and 4), and decisions taken

Decisions taken by the assistant on 2026-11-15 after "you make decisions and go" (Faiz can reverse any of them):

- "Since last visit" is kept in the browser. No database change. Phone and PC each keep their own last visit.
- The yard stays at 18. Holdings past 18 show in words only (Towers list and the round's "No room" stops). No second yard yet.
- A price counts as fresh for 5 days; the bell is for thesis review only (named constants in `marks.ts`).
- In the sample, smoke ticks on entering that holding's land (the sample has no wire to press "I have looked" on).

How it differs from the plan above:

- **Taps:** the round itself costs one tap to read (open Quests). The 0-tap signal is the open count on the closed Quests chip ("Quests 5"). The sample fortress opens Quests once per page load; the real fortress never auto-opens. The plan said "0 taps to see the round"; this is the honest version.
- A source still loading says nothing; "did not report in" shows only after a read has failed. The round never says quiet while a source is pending or unread.
- Each stop has a small shape glyph; unticked stops say "(to do)" for screen readers.
- On phones (640 px and under) the quest panel is capped at 45% of the screen height and scrolls inside; toolbar keyboard hints are hidden to make room for the count.

Seen in a real browser (software graphics, demo stack): the sample round, glyphs, ticking at the spot (walking past does not tick), "Start again", the chip count, and the phone fit. Storage: the real round key is never written in demo.

**Not verified:** "Round done. Nothing left." and the count vanishing at 0 (unit tests only); the lamp on its stall in the sample; the real round against real data (thesis, stall, wire and carried-over ticks); Plain view; a screen reader; a real phone and its frame rate. Still clipped on a 390 px phone: the Quests chip's left edge and the "Sound" chip (the clipping existed before; not compared with `main` on every chip).

## Open questions for Faiz

1. **More than 18 holdings?** (Decided for now: stays 18, extras in words.) The yard inside the wall is now full at 18. If you hold more, the choice is a second
   yard through a gate, or leaving the smallest in the list only. How many holdings do you have today?
2. **"Since last visit" kept in the browser** (Decided: browser.) (recommended, no database change) or on the server (same on phone and PC,
   needs a small new table)?
