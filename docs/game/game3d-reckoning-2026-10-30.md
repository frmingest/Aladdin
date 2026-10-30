# 3D courtyard, week 4: quest 2, "Six-Month Reckoning" (2026-10-30)

Status: **written and tested, not merged, not deployed, not yet seen in a browser.** Branch
`feature/game3d-reckoning`, stacked on `feature/game3d-npcs` (week 3, not confirmed merged when this
was written; merge it first, or retarget this PR to `main` after it lands). Frontend only: no
backend, migration or prompt change.

## What it does
- A second quest in the quest log (left panel): **Six-Month Reckoning** - "When a journal entry is six
  months old, write what actually happened next to what you expected."
- **Derived, never stored.** `sixMonthReckoning()` (`quest.ts`) reads the same `GET /journal` as quest 1
  and lists entries whose `outcome.review_6m_due` / `review_12m_due` is true. Those flags are the
  backend's own (old enough and no review text yet); the 182/365-day rules stay in
  `backend/app/services/journal.py` and are not repeated in the browser. No save file, XP or reward.
- Entries for holdings that were since sold still count: a review is owed on the decision, not on the
  position.
- **Unknown stays unknown:** loading says so; an unreadable journal says so and the NPCs say they cannot
  read it; an empty journal is "no entries yet", never "clear"; "clear" only when entries exist and none
  is due.
- **Prices and returns are never read** by the quest or the dialogue, so it cannot lean on how the
  position did.
- Dialogue (`talk()` in `dialogueV1.ts`): the first open quest speaks. Missing reasons come first
  (unchanged week 3 words); once every holding has a reason and reviews are due, the Oracle lists them
  ("Alpha (6 months), Beta (6 and 12 months)") and the Partner points at the due entry written with the
  highest confidence, else the oldest; confidence is quoted only when it was written. Nothing due or
  unreadable: week 3 words stand. Still hand-written, rule-chosen, no model, no randomness, no buy/sell
  wording, no cheering.

## Tests
`quest.test.ts` (+5: loading/unreadable, empty is not clear, only the service's flags count, order and
which review, Partner pick without inventing confidence) and `dialogueV1.test.tsx` (+5: reviews only after
reasons, Partner confidence rule, fallbacks, no buy/sell/cheer/price words, markup). Game3D suite: 54 pass.
`tsc --noEmit` clean, ESLint clean on `src/game3d` and `Game3DPage.tsx`. Full `vitest run` and `vite build`
not run for this change (the dev machine's work volume was full; CI runs them).

## Known gaps
- Not seen in a browser; the quest log panel is now taller (check it does not cover a tower on a small
  window).
- The demo journal never marks a review due, so quest 2 only shows "clear" or "empty" on sample data.
  The "open" state is covered by tests, not yet seen on a real journal.
- Quest still only reads the journal; writing a review happens on the Journal page.

## To look at (Faiz)
Open `/game3d` with your real journal. Does the quest log list the entries the Journal page flags as
review due? Walk to the Oracle once every reason is written: do the names and "6 / 12 months" match?

## Next (week 5)
Real hero model replacing the capsule; then the third quest, Storm Drill. See the Stitch list in the
chat reply for design inputs.
