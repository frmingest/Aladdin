# 3D Hourglass: replay your fortress day by day (2026-11-15)

Status: **written on `feature/hourglass-414`, not merged, not deployed.** Issue #414 (order 4 of 4 from the 3D review of 2026-11-14). Seen in headless Chromium with the API mocked (software WebGL, desktop and a 390 px phone viewport), with the stand temporarily moved next to the spawn for those runs; nobody has walked to its real spot or looked at it on a real GPU or a real phone.

## What a sprint is for (plain words)

Every night the app writes down a picture of your fortress and keeps it, but today only the two newest are ever read (for the Night Watch). The Hourglass lets you turn time back in the world and watch the nights replay: towers grow and shrink, walls crack or mend, the weather shifts. Only 3D can show it, and it gets better every week as nights pile up. It is a record of what was stored, never a forecast.

**Visual verb + scene:** *Turn back.* A timber stand with two glass bulbs in the open ground in the west of the yard; the whole yard then draws the night you chose.

## What you will see

- **The hourglass** stands west of the gate road, in the open ground by the camp (-29, 34). Press **E** at it and a panel opens.
- **The panel:** one line ("Watch your fortress as it stood. A record, never a forecast."), the date big, then **Earlier** and **Later**, **Play** (on today only), and a sideways-scrolling row of blocks for the last 90 calendar days, each with its day of the month (older nights are reached with Earlier): a solid block is a kept night, an empty outline is a gap (shape, not colour). One line counts kept nights and gaps. Looking back, Play, Pause and the way home are on the banner only, so no control shows twice.
- **Stepping and playing** go one calendar day at a time, gaps included. **Play** rests 1.4 seconds on each night, starts from the oldest if you are on today, and **stops at the newest night** (it never loops and never takes you home by itself).
- **A banner is always on screen while you look back** (under the toolbar, so no button is covered): the date, "Looking back. Nothing can be written.", **Play/Pause** (so a replay can run with the panel shut) and **Back to today (H)**. **H** takes you home from anywhere. Closing the panel leaves you in the past with the banner up and a still sand-coloured edge round the screen. A replay also stops if the tab is hidden.
- **The yard** is drawn from that night's stored state by the same `stateToWorld` as today, so unknown stays fog. The vault chest and the weather (sky, clouds) come from that night's state too. A night with **no stored picture is a gap**: bare pads, fog, the banner says "No picture is kept for this day." It is never filled in from the nights either side. (Present tense on purpose: an old night may have been kept once and thinned away since.)

## What is shut while you look back

Only places that read stay open: the hourglass and the Realm post (which reads that night's state). Every other place you can press E at says "Shut while you look back. Press H for today" and does nothing, whatever it is (a test lists every place and checks that only the hourglass and the Realm post stay open). In the courtyard that is the **desk, the drill post, the vault chest, the booths, the buildings, the signpost, the gates to the Siege Field and the Market Quarter, the Night Watch post, the raven perch, the towers' doors and the advisors**; the rooms and lands behind those doors cannot be reached from the hourglass. The **"Where to?" menu** (G and its button; the flat pages behind it can write) does nothing. The **Quest log is hidden** (it holds the wires) and **Q does nothing**, so it comes back as you left it when you return to today. Whatever was open at a closed courtyard place (desk, drill, vault, Night Watch and raven panels, a booth, a talk, the lamp, the menu) closes the moment you go back. Today's facts that are not in a stored night (the desk's books, the Night Watch lantern, the ravens, marks, quest marks, the Standing torches) are left out of the past yard instead of sitting on it. The Towers panel (T) shows that night's towers. A save you had already sent before turning back is not undone.

## What the backend gives (read-only)

- `GET /game/history` lists the stored days, oldest first (keys only). With the sample fortress on it answers an empty list (the sample is never stored).
- `GET /game/history/{day}` returns one stored day exactly as stored (`HistoryFrameOut`: day, stored_at, state). A day with no frame, or one that no longer parses, is a **404, never a guess**. The sample fortress answers 404.
- No write, no migration, no provider call, no LLM. It reuses `history.stored_days` and `history.load_frame`, which the Night Watch already used.

## Decisions worth knowing

1. **Today is never "the past".** The timeline runs from the first stored day up to yesterday; today is the live fortress (even if tonight's frame is already stored).
2. **Gaps are calendar days.** The backend thins old frames (every day for 90 days, then one a week to two years, then one a month for ever), so older stretches show as long runs of gaps. That is honest; the block row covers the last 90 calendar days and Earlier walks further back.
3. **A day is set only after it has been read**, so the date on screen is always the day that is drawn. The next night is read ahead during a replay (one request per night; the newest 30 read nights stay in memory).
4. **Days are UTC days**, the backend's own. For a few hours around midnight in Norway, "today" on the timeline is the other side of the line from the clock on your wall.
5. **No new Stitch picture is needed.** The stand is built from code shapes like the Night Watch post. If you later want a painted one: *a small timber hourglass with brass fittings and warm pale sand, seen from the front.*
6. **Where it stands:** (-29, 34), found by search: clear of every prop, person, pad, camp piece and other post, and further than any spot's reach from the others (a placement test keeps it so).

## Game checklist

- **Pages touched:** the courtyard (one new post and panel), Game3DPage and Scene (wiring, the read-only lock).
- **Identity:** 3 on paper (scene: the stand; a real fact encoded visually: the whole yard redraws as that night; Plain view: the panel's words and the Towers panel carry the same facts). Not yet seen by Faiz.
- **Taps:** the common task "see how it looked last week": walk to the stand, E, Earlier = 2 presses; H to come home = 1.
- **Game voice:** short, plain, playful ("Turn the hourglass", "The sand will not turn"); numbers and dates stay exact.
- **Accessibility:** every control is a real button with a spoken date; kept versus gap is shape (solid versus outline) and a label, not colour. Reduced motion: nothing animates; the replay (only when you press Play, with Pause on the banner) just swaps the picture every 1.4 seconds.

## What the player learns, and what is open

- The player learns how their fortress changed over the nights it was recorded, and which nights are missing. Nothing rewards replaying, and nothing in the past can change anything today.
- **Open (needs Faiz's eyes on a real GPU, desktop and phone):** on a phone the banner and the open panel cover about 60% of the view (close the panel with × to see the yard; collapsing it is a follow-up); the "Where to?" button stays visible but does nothing while you look back; the sand-coloured edge is faint in screenshots; the camera when you stand at the stand with the panel open covers the stand; how the replay feels at 1.4 seconds a night; walking there for the first time.
- **Idea for Faiz to decide (not built):** mark on the block row the nights where a review or thesis was written, so Play shows which stretches you had thought through. Read-only, no score. Its own issue if wanted.
- **Not done on purpose:** no tower-by-tower comparison view and no "what changed" text during the replay (the Night Watch already words one-night changes in `frame_diff.py`); either would be its own issue.
