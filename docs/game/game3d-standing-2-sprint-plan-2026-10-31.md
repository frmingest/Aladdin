# 3D courtyard: next sprint, "Standing 2: the writing desk", plan, 2026-10-31

**Status: plan only. Nothing built, nothing seen in a browser.** Follows Standing 1 (merged #217, deploy not checked). Built from the [Standing 1 write-up](game3d-standing-2026-10-31.md), the [KayKit plan, S11](game3d-kaykit-sprint-plan-2026-10-31.md) and the code on `main` at `e9ac189`. Faiz picked this sprint on 2026-10-31 (over the drill camp and Level 4).

## 1. What this sprint is for (plain words)

A sprint is one small piece of the game that is finished and that you can try yourself.

Today the game tells you to **write why you own each holding**, and then sends you out of the game to the Journal page to do it. Level 3 (Reasons) is the level that asks for exactly that, so the one thing the game wants from you is the one thing it cannot let you do inside it.

This sprint puts **a writing desk in the courtyard**. Walk up, press E, write two lines (why you own it, what would prove you wrong), save. A shelf next to the desk grows one book for every holding you have written up. Nothing else about Standing changes: no points, no save file, the level still comes only from your real facts.

## 2. Where we start (checked in the repo, `main` at `e9ac189`)

- Standing 1 is merged: levels 1 to 3, torches, the Standing card, `GET /game/standing`. Level 3 already needs a written reason **and** a "wrong if" line on every holding (plus one armed wire).
- Quest 1 "Unwritten Thesis" (`quest.ts`) still counts a holding as done with a **reason only**. That disagrees with Level 3. This sprint fixes it with a new version, not an edit.
- The only write path in the game today is a link: `QuestLog.tsx` line 113, "Open the journal" to `/journal`. The Oracle and Partner talk ends there too.
- **No new backend.** `POST /journal` exists (`api.createJournalEntry`; needs `holding_id`, `action`, `decided_on`, `thesis`; `invalidation` optional).

## 3. The rungs this sprint builds

No new level. Level 3 stays the top (Level 4, The Watch, is a later sprint). What changes is how you **reach** Level 3 from inside the world.

## 4. Items (each one PR on its own branch, tests included; Claude opens the PRs)

| # | Name | What it is | Size |
|---|---|---|---|
| W1 | **The desk and the shelf** | An open-air desk by the keep door, a code-built shelf whose books are your written holdings (one book per holding with a reason and a wrong-if line). The visual win | M |
| W2 | **Write at the desk** | Walk up, press E, a small panel: holding (biggest unwritten one already chosen), two boxes, one Save. Saves with the journal write that exists, then the shelf and Standing refresh | M |
| W3 | **Quest 1, version 2** | One quest = reason **and** wrong-if. New version file; v1 stays untouched. Quest log and the Oracle's words follow it | S |
| W4 | **No more leaving the world** | The "Open the journal" button and the Oracle and Partner lines point to the desk; a small "Edit in the journal" link stays for old entries | S |
| W5 | **Look and judge** | Click through with an empty fortress, the sample fortress and real data; screenshots; tap counts; check section B | S |

**Cut line:** if the sprint runs long, cut the KayKit furniture model first (the desk stays a code-built table), then W4's old-entries link. Never cut the sample guard, the unreadable state, or the screenshots.

## 5. Rules that never bend

- **Truth.** The shelf and the level come only from real journal entries. The sample fortress shows the desk but it cannot save ("Sample fortress, not yours"). If the journal cannot be read, the desk says so and does not save.
- **Honest limit.** The game cannot tell if an entry was backdated. Stated in the Oracle's words, as in Standing 1.
- **Writes are new entries only.** The desk only creates a journal entry; it never edits or deletes an old one. Nothing is saved until the player presses Save.
- **Architecture rule 4 untouched.** The blind pass never sees notes: this sprint only writes the journal that already exists and does not read it into any analysis.
- No XP, no streaks, no daily visits, no buy or sell words. The desk entry is recorded as the word "Hold" (see decision 1).

## 6. Checklist section A

1. **Pages touched.** Only `/game3d`: the desk and shelf, the desk panel, the Quest log button, the Oracle and Partner lines. No flat Game mode page changes.
2. **Identity (0 to 3).** `/game3d`: before 3 (Standing 1, by judgement), target 3 after. The new fact encoded in the world is the shelf (books = written holdings).
3. **Visual win.** **The shelf of reasons.** Verb: *write*. Scene: the desk by the keep door. Fact: how many holdings have a written reason and a wrong-if line. Deletes the "go to the Journal page" paragraph. **No Stitch picture needed**: the books are code-built boxes, the desk is code-built (or a KayKit piece if it fits the cut line). If a picture is needed later I will tell you first, with a short description.
4. **Words (budgets, game voice).** Desk panel title 4 words or fewer; labels 5 or fewer ("Why I own it", "What proves me wrong"); Save button 2 ("Write it down"); the Oracle's nudge 15 or fewer. Before-counts are taken from the current files as the first job of W1. New wording ships as new version files (`dialogueV3` and quest v2), the old ones are not edited.
5. **Kit.** Reused: `Scenery.tsx` placement pattern, `Inked` outline, `Toolbar`/panel style from `hudPanels.ts`, `StandingTorches` look. Added: the desk and shelf props (code-built, owner `game-feel-engineer`) and one panel.
6. **Cut line.** See section 4.
7. **Rules.** Colour-blind: a book is present or absent (shape and count), never colour alone. Reduced motion: the new book appears without animation. Performance: shelf books are instanced boxes, no new lights; frame rate re-checked on a real GPU (it was 165 fps on Railway).
8. **Taps from a cold load.** Level: 0. What is next: 1 (press Q). **Write a reason: walk up, E, type, Save (2 presses plus typing; was: leave the world).** Measured in a real browser in W5, not from the diff.

## 7. Done means

- Tests: quest v2 counts a holding only with reason and wrong-if; sample never saves; unreadable journal never saves; the shelf count equals the quest count; a failed save keeps your text and says so. Then `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; backend untouched, so `pytest -q` stays as is.
- Seen in a real browser with three data states (empty, sample, real). Anything not seen is named.
- Status written as three separate facts: merged, deployed, seen on real data.

## 8. Decisions for Faiz (I go with the recommendation if you do not say otherwise)

1. **Which action does a desk entry record?** The journal needs one (buy, add, trim, sell, hold). Recommended: **Hold** with today's date, since you are writing why you own it now. A real buy or sell still goes through the Journal page.
2. **Open-air nook or a real room?** Recommended: open-air nook under the keep wall (cheap). A room with walls and a door is a separate sprint.
3. **Desk in code or a KayKit piece?** Recommended: code-built table first; a KayKit Furniture Bits table only if the screenshot looks thin (needs the pack's licence file checked in the repo).

## 9. Later (not this sprint)

Level 4 The Watch (tripwire and Night Watch quests), quests as data, Storm Drill with the drill camp (KayKit S10), Level 5 The Ledger (needs 6-month-old entries), world growth.
