# 3D Hourglass: replay your fortress day by day (2026-11-15)

Status: **written on `feature/hourglass-414`, not merged, not deployed.** Issue #414 (order 4 of 4 from the 3D review of 2026-11-14). Seen in a headless browser with the API mocked (software WebGL), with the stand temporarily moved next to the spawn for that run; nobody has walked to its real spot or looked at it on a real GPU or a phone.

## What a sprint is for (plain words)

Every night the app writes down a picture of your fortress and keeps it, but today only the two newest are ever read (for the Night Watch). The Hourglass lets you turn time back in the world and watch the nights replay: towers grow and shrink, walls crack or mend, the weather shifts. Only 3D can show it, and it gets better every week as nights pile up. It is a record of what was stored, never a forecast.

**Visual verb + scene:** *Turn back.* A timber stand with two glass bulbs in the open ground in the west of the yard; the whole yard then draws the night you chose.

## What you will see

- **The hourglass** stands west of the gate road, in the open ground by the camp (-29, 34). Press **E** at it and a panel opens.
- **The panel:** the date big at the top, then **Earlier**, **Later**, **Play**, **Back to today**, a slider ("Which night"), and a row of small blocks for the last 90 nights: a solid block is a kept night, an empty outline is a gap (shape, not colour). One line counts kept nights and gaps.
- **Stepping and playing** go one calendar day at a time, gaps included. **Play** rests 1.4 seconds on each night, starts from the oldest if you are on today, and **stops at the newest night** (it never loops and never takes you home by itself).
- **A banner is always on screen while you look back:** the date, "Looking back. Nothing can be written.", and **Back to today (H)**. **H** takes you home from anywhere. Closing the panel leaves you in the past with the banner still up.
- **The yard** is drawn from that night's stored state by the same `stateToWorld` as today, so unknown stays fog. The vault chest and the weather (sky, clouds) come from that night's state too. A night with **no stored picture is a gap**: bare pads, fog, the banner says "No picture was kept this day." It is never filled in from the nights either side.

## What is shut while you look back

Only places that read stay open: the hourglass and the Realm post (which reads that night's state). Every other place says "Shut while you look back. Press H for today" and does nothing: the **desk, the drill post, the vault chest, the booths, the buildings, the signpost and the "Where to?" menu** (the flat pages behind it can write), **the Quest log** (it holds the wires), the **Night Watch post, the ravens, the towers' doors and the advisors**. Any of those that were open close the moment you go back. Today's facts that are not in a stored night (the desk's books, the lantern, ravens, marks, quest marks, the Standing torches) stay out of the past yard instead of sitting on it. The Towers panel (T) shows that night's towers.

## What the backend gives (read-only)

- `GET /game/history` lists the stored days, oldest first (keys only). With the sample fortress on it answers an empty list (the sample is never stored).
- `GET /game/history/{day}` returns one stored day exactly as stored (`HistoryFrameOut`: day, stored_at, state). A day with no frame, or one that no longer parses, is a **404, never a guess**. The sample fortress answers 404.
- No write, no migration, no provider call, no LLM. It reuses `history.stored_days` and `history.load_frame`, which the Night Watch already used.

## Decisions worth knowing

1. **Today is never "the past".** The timeline runs from the first stored day up to yesterday; today is the live fortress (even if tonight's frame is already stored).
2. **Gaps are calendar days.** The backend thins old frames (every day for 90 days, then weekly, then monthly), so older stretches show as long runs of gaps. That is honest, and the slider and block row (last 90 nights) keep it usable.
3. **A day is set only after it has been read**, so the date on screen is always the day that is drawn. The next night is read ahead during a replay.
4. **No new Stitch picture is needed.** The stand is built from code shapes like the Night Watch post. If you later want a painted one: *a small timber hourglass with brass fittings and warm pale sand, seen from the front.*
5. **Where it stands:** (-29, 34), found by search: clear of every prop, person, pad, camp piece and other post, and further than any spot's reach from the others (a placement test keeps it so).

## Game checklist

- **Pages touched:** the courtyard (one new post and panel), Game3DPage and Scene (wiring, the read-only lock).
- **Identity:** 3 on paper (scene: the stand; a real fact encoded visually: the whole yard redraws as that night; Plain view: the panel's words and the Towers panel carry the same facts). Not yet seen by Faiz.
- **Taps:** the common task "see how it looked last week": walk to the stand, E, Earlier (or the slider) = 2 presses; H to come home = 1.
- **Game voice:** short, plain, playful ("Turn the hourglass", "The sand will not turn"); numbers and dates stay exact.
- **Accessibility:** every control is a real button; the slider has a spoken date; kept versus gap is shape (solid versus outline) and a label, not colour. Reduced motion: nothing animates (the replay only swaps the picture).

## What the player learns, and what is open

- The player learns how their fortress changed over the nights it was recorded, and which nights are missing. Nothing rewards replaying, and nothing in the past can change anything today.
- **Open (needs Faiz's eyes on a real GPU, desktop and phone):** the camera when you stand at the stand with the panel open covers the stand; how the replay feels at 1.4 seconds a night; walking there for the first time.
- **Not done on purpose:** no tower-by-tower comparison view and no "what changed" text during the replay (the Night Watch already words one-night changes in `frame_diff.py`); either would be its own issue.
