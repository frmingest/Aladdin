# Council Chamber: ideas to make it more engaging (2026-10-18)

Status: **concept B built 2026-10-18 (PR `feature/council-lectern`, written and tested, not merged, not deployed, not seen in a browser).** The rest of this doc is the original proposal; the decisions and what was built are in section 10. Roles: game-designer (spec rules) and game-ux-designer (lane 2, identity and voice). Faiz asked for a more engaging, interactive Council page (`/fortress/council`).
Read for this: `CLAUDE.md`, both agent files, the visual-identity standard (sections 1, 4, 6), the three game skills, `CouncilPage.tsx`, `kit/CouncilChamber.tsx`, `ChamberFurniture.tsx`, `Speaker.tsx`, `SealArt.tsx`, `lib/councilSeats.ts`, `backend/app/services/game/rituals.py` (`build_council`), `schemas/game.py`, `advisor_lines_v1.py`, and the 2026-10-09 / 2026-10-16 design docs. **Not run:** the page itself (no screenshots), so the scores below are from code.

## 1. What the page does today

`GET /game/council` returns up to 8 agenda items (fixed rules: tripwire, thesis_review, review_due, weak_walls, no_moat, stale_analysis, outside_circle, cash), each with up to 4 named holdings (+ `more` count), a list of `unknowns`, and the Oracle/Partner lines already on the Fortress (`state.advisors.lines`, hand-written, rule-chosen, with `facts`). The page shows a round table with 8 seats (click an occupied seat = scroll to its folio), then a long list of parchment folios, a fog panel and speech bubbles. Everything is read-only; the only verbs are "jump to a folio", "open a link", and a "Why this line" foldout.

**Identity today: 2 (standard table says 3; I score it 2).** Evidence for 2: scene header and torches, chamber with table, chairs, candles and seated advisors; seats encode a real fact (occupied, tone seal, paper stack = holdings count, printed count); kit pieces (ParchmentPanel, SealArt, FogPanel, Speaker); Plain view in the banner. Why not 3: no memorable object tied to a *verb* (nothing to do in the room), the advisors sit as scenery while their words sit in a separate card far below, and on a quiet night the room is eight hollow "none found" seats (the 2026-10-16 review already called it the weakest room). The seats are a menu, not a place.

**Data limits to keep in mind (all verified in code):**
- Each item names at most 4 holdings (`council_max_names_per_item = 4`); the rest are only counted. Anything needing "every holding on a seat" needs the full list (small backend change) or a join with `/game/state` towers.
- `/game/holdings/{id}/advisors` returns *every* advisor line for one holding (rule, tone, text, facts). One call per holding; no batch yet.
- Advisor lines come from 15 hand-written rule templates. There is no free text, no LLM, and none should be added here.
- Tower fields already stored: `weight_pct`, `wall` + `wall_reason` + `wall_inputs` + `wall_margins`, `moat`, `freshness` + `analysis_age_days`, `thesis`, `tripwires_fired`, `margin_of_safety_pct`, `siege_exposure` + `siege_shock_pct`, `shared_wall_with`, `sector`.
- Journal has no "start an entry from this item" hook today (no query params or prefill in `JournalPage.tsx`).

## 2. Rules every concept keeps

Read-only; all numbers come from stored fields and deterministic app code (no LLM-made number, no LLM text); unknown stays unknown (fog, "no reading"); no buy / sell / trim / add wording; demo mode wins (demo council shows demo facts only); truth over flattery (an empty chair is never "all clear"); no points, streak, timer, daily return or "x of 8"; **the user's notes and thesis text are never used on this page** (so nothing here can leak into a blind pass); prompts or template text for any new answers live in versioned files, never inline.

---

## 3. Concept A: "The Table" (a table you can walk around)

**Player verb:** *Seat a tower.* Move a small holding token round the table and see which chairs claim it.
**Real fact:** which agenda rules name each holding (a holding named by two rules sits between two chairs with a thread). Source: `CouncilItemOut.holdings` (+ weights). Limit: only 4 names per item are returned, so the table shows named holdings only; to place all, extend `CouncilItemOut` with the full list (backend, small) or join `/game/state` towers.
**Interaction and feedback:** the chairs stay. Each named holding becomes a little tower token on the rim of its chair(s), sized by `size_class` (the same classes the Fortress uses). Tap or press a token: the chamber dims, the token lifts to the centre of the table, threads run to every chair that named it, and a small card lists those rules in plain words. Tap away to put it back. Nothing is saved.
**Visual verb + scene:** *Gather* at the round table. Where: the existing chamber hero, over the table (desktop); a ring list on phone. Mapping: `fact -> shape/size/fill/fog`: token = tower silhouette (reuse the Fortress tower shapes), height from `size_class`, wall tint never used for status; a thread = a rule that named it (one per kind, drawn with the kind's badge at the end); a token with no stored weight is drawn as a fog outline; empty chair stays plain, and the "not proof of nothing" note stays when `unknowns` exist. Words it lets us delete: the per-folio holding chips ("pennant + name + weight" row) and part of the summary line. Identity 2 -> 3 (a memorable object: tokens round a table).
**Game voice:** "Pick a tower." / "Named by 2 rules." / "Put it back." / "Nobody named this one." / "No size on file." (fog token tooltip).
**Accessibility:** tokens are real buttons in a labelled list (same order as the agenda), arrow keys move between tokens, Enter lifts, Esc puts back; threads also listed as text ("Named by: weak walls, no moat"). Reduced motion: no lift animation, the card just appears. Colour-blind: threads differ by badge shape and dash style, never colour. Plain view: the existing folios with the holding chips (already there).
**Phone:** the table already collapses to a 2-column seat grid below 640 px; here the tokens become a horizontal strip per seat, tap opens the same card as a bottom sheet (44 px targets).
**Size:** M (L if the full holding list needs the backend change). **Reuses:** `CouncilChamber`, `councilSeats` (seat positions), `ChamberFurniture`, `SealArt`, tower shapes from the Fortress kit, `ParchmentPanel`.
**Weakness (honest):** two rules naming one holding is often just "big and weak", so the thread mostly repeats the folio; the fun is real but the information is thin.

## 4. Concept B: "Call a councillor to the floor" (ask a question)

**Player verb:** *Ask.* Pick a holding, pick one of four fixed questions, then pick which councillor answers (Oracle or Partner).
**Real fact:** the answer is built from stored fields for that holding, never invented:
| Question | Answer is built from |
|---|---|
| "Why is this on the table?" | the seat's folio text + that holding's advisor lines (`/game/holdings/{id}/advisors`: `rule`, `text`, `facts`) |
| "How close is the edge?" | `wall_reason`, `wall_inputs`, `wall_margins` (the A1 distance to the next wall tier, already stored) |
| "What does the storm do to it?" | `siege_exposure`, `siege_shock_pct`, `siege_method` (unknown -> "no reading") |
| "Who stands beside it?" | `shared_wall_with`, `sector`, `weight_pct` |
**Where the words come from:** per-holding advisor lines already exist (hand-written, rule-chosen). The other three answers need a new small versioned template file (backend `council_questions_v1.py`, text in the Oracle's and Partner's voice, numbers filled by app code) and one read-only endpoint `GET /game/council/ask?holding_id=&q=` (or the same templates run in the browser from `/game/state`; I would prefer the backend so a rule change gets a new version). **No free-text box, no LLM:** this removes the prompt-injection and invented-number problems, and the answers stay checkable (each reply ends with the same "Why this line" fact list the page uses now).
**Interaction and feedback:** the chosen advisor leans in from the chair, a speech bubble (`Speaker`) opens *at the table* with the answer, one seal for tone, and the fact chips underneath. A second tap on "Ask the other one" gets the other voice (Partner is blunt, Oracle is patient). The other advisor stays quiet if no rule fits: "Nothing to say here." (silence is not agreement). Answers appear at once; with motion on, a short bubble fade only.
**Visual verb + scene:** *Summon* a speaker to the lectern. Where: a small lectern/question scroll between the two advisor chairs (the existing seated advisors become the buttons). Mapping: fact -> bubble content only; the wall-edge answer draws a mini wall with the stored distance as a tick on a three-step ladder (timber / stone / iron), unknown wall = fog bubble; storm answer draws the existing siege-camp icon at the stored level. Words it lets us delete: the whole "The advisors speak" card at the page bottom (its lines move to the lectern), and the "Why this line" foldout becomes the fact chips. Identity 2 -> 3 (the advisors finally *do* something; a screenshot with a bubble over the table is unmistakably Aladdin).
**Game voice:** "Call someone to the floor." / "Ask the Oracle" / "Ask the Partner" / "Why is this here?" / "How close is the edge?" / "What does the storm do?" / "Who stands beside it?" / "No reading yet." / "Nothing to say here."
**Accessibility:** advisors are real buttons (labelled "Ask the Partner about X"), questions are a radio group, answers in a live region (polite), arrow keys move through the four questions. Reduced motion: no lean or fade. Colour-blind: tone by seal shape + printed word as now. Plain view: a native `<select>` for holding + question and the answer as a labelled block.
**Phone:** holding list -> question chips -> bubble stacked under the chairs; the lectern is a bottom sheet.
**Size:** M (frontend lectern) + S/M backend (templates + endpoint, tests for each answer and the "no reading" paths).
**Reuses:** `Speaker`, `Portrait` and the seated advisor pictures, `SealArt`, `FogPanel` look for unknowns, `advisorRuleLabel`, `ADVISOR_TONE_LABEL`, per-holding advisors endpoint (exists).
**Risks:** (1) an answer must never read as an instruction, so the templates are reviewed for "buy / sell / trim" wording like the existing ones; (2) never take user-written thesis or journal text into an answer.

## 5. Concept C: "Two voices" (the councillors disagree, and you see why)

**Player verb:** *Hear both.* Tap a holding and watch the Oracle and the Partner speak in turn.
**Real fact:** tone and rule of each advisor's lines for that holding (`AdvisorLineOut.advisor`, `tone`, `rule`, `facts`), from `/game/holdings/{id}/advisors`. "They disagree" is computed by app code: one side has a `warning` line and the other a `calm` line (or has none) for the same holding. Data limit: 15 rules, so many holdings will have only one speaker; that is shown as "One voice spoke", never as agreement. There is no batch call for all holdings today (N calls, or a new batch endpoint).
**Interaction and feedback:** two facing lecterns across the table, a seal over each. Tap a holding token: each advisor's seal lights (alert / notice / steady) in turn; a crack runs across the table when seals differ, a plain line when they match; tap the crack to open the two fact lists side by side ("Partner counted: ... / Oracle counted: ..."). No verdict is shown and nothing tilts toward "better".
**Visual verb + scene:** *Face off* across the table. Where: the table centre between the two seated advisors. Mapping: seal kind = tone per side (existing shapes: triangle "!" = warning, circle "i" = note; "steady" needs a third shape, so use a plain ring); crack = disagreement flag; a side without a rule = empty lectern (fog edge). Words it lets us delete: tone chips on every bubble. Identity 2 -> 3.
**Game voice:** "Two voices." / "They differ." / "They agree." / "Only one spoke." / "Why they differ."
**Accessibility:** the pair is a labelled group with text like "Partner: look at this. Oracle: steady. They differ."; Tab through the two lecterns; no motion needed. Colour-blind: seals by shape. Plain view: a two-column table.
**Phone:** two stacked rows instead of facing lecterns.
**Size:** M-L (needs the batch or N calls first).
**Weakness (honest):** the same Oracle/Partner rules already live on the Fortress and this can feel like "the same lines, drawn". It works best as *one of the questions* inside Concept B ("Do you two agree?") rather than as its own screen.

## 6. Concept D: "Minutes" (carry an item to the Journal)

**Player verb:** *Write why.* Pick up a folio and carry it to the quill; it opens the Journal with the facts attached.
**Real fact:** the folio's own item (kind, tone, holdings + weights) and the date it was read. Source: `CouncilItemOut` + `as_of`. **Data does not exist yet:** Journal has no prefill path, so this needs a small Journal change (an optional "from the Council" header carrying `kind`, holding ids, `as_of`, text we generated, never the user's thesis). The quill does not write anything for the user.
**Interaction and feedback:** a rolled minutes scroll and quill sit at the end of the table. Drag (or press "Take it") a folio onto the scroll: the scroll unrolls and shows "To write: why this is on the list, and what would change your mind" with a link into the Journal. No count of minutes kept, no "done" state; closing it changes nothing.
**Visual verb + scene:** *Carry.* Where: end of the table / right of the chair ring. Mapping: scroll thickness is a fixed picture (no data); the folio's seal is copied onto the scroll. Words it lets us delete: the repeated "Write it in the Journal" link in every folio. Identity 2 -> 2.5 (an object, but its look encodes little).
**Game voice:** "Take it to the Journal." / "Write why." / "Leave it for now."
**Accessibility:** "Take it" is a button; no drag required. Reduced motion: no unroll. Plain view: the existing link.
**Phone:** a button, no drag. **Size:** S frontend, S backend/Journal. **Reuses:** `ParchmentPanel`, `room-scroll`, `room-inkwell` art, the Journal page.
**Weakness (honest):** it does not make the page more *fun*, only more useful. It is a good small add-on, not a headline.

---

## 7. Recommendation

**Build Concept B first ("Call a councillor to the floor").** Reasons: (1) it gives the page a verb, which is the missing piece for Identity 3; (2) the data is almost all stored already (per-holding advisor lines, wall margins, siege fields, shared walls), with no new stored fact; (3) fixed questions and templates keep it deterministic and free of LLM numbers, notes and injection; (4) it removes text (the bottom advisor card and its foldout) instead of adding it; (5) the advisors are already seated in the chamber art, so it uses the picture we already have.

**Combine:** fold C's core in as the fourth question ("Do you two agree?") using the same lectern. Fold A-lite in as step two: the holdings named by the seats appear as small tokens, so the player picks a holding by touching the table rather than a list (A's thread idea can wait). D is a cheap add-on once the Journal accepts a header. **Sequence with the open quiet-night item (design review 3.1 / S6):** when nothing is on the agenda, B still works only if a holding can be picked; so collapse the eight "none found" seats into one picture and a line first, and let B ask about any holding from a short list (largest first, from `/game/state`).

## 8. Decision needed from Faiz

1. Build Concept B first, with A-lite (tokens on the table) as the way to pick a holding? (Recommended.)
2. Are four fixed questions enough, or do you want to see a first set of answers (written in the Oracle's and Partner's voices) before any code?
3. Should the old bottom "The advisors speak" card go once the lectern exists (Plain view keeps it)?
4. Do you want the quiet-night collapse (design review D2) done first, as its own small change?
5. Is a small backend endpoint plus a versioned answer-template file acceptable, or must this stay frontend-only (then it uses only what `/game/state` already returns)?

## 9. Stitch pictures (you generate; same Stitch Master cartoon look, ink outline, transparent background)

Budget note: about 200 KB is free of the 2800 KB cap, and S5/S6 from the 2026-10-16 review are still open. Everything below is optional; B can ship with the existing advisors, chairs and scroll.
- **Lectern (needed for B):** "A small wooden lectern with a slanted top and a rolled question scroll on it, cartoon fantasy, ink outline, transparent background, side view, about 80 px wide."
- **Quiet council room (S6, from the review, helps B on a quiet night):** "A round council table with chairs pushed in and one candle burning in an empty stone hall, calm and empty, not a happy scene, transparent background."
- **Advisor leaning in (optional, B):** "The same two seated advisors, each leaning forward with one hand raised as if about to speak, same style as the existing council-sit pictures." (If skipped, a code-drawn bubble tail and a 4 px nudge do the job.)
- **Tower tokens (A only):** none; reuse the Fortress tower shapes.
- **Minutes scroll (D only):** "A rolled parchment scroll with a quill lying on it, same style as the existing room scroll." (Existing `room-scroll` already works.)

## 10. Decisions and what was built (2026-10-18)

Faiz's answers: (1) build B; (2) four questions are enough for now; (3) old bottom card: Claude decides; (4) quiet-night collapse: Claude recommends; (5) a small backend endpoint and a versioned answer file are fine.

Claude's calls on the open ones:
- **Old "The advisors speak" card:** kept, not deleted. It is now titled "What they said on the Fortress" and sits in a closed foldout, so the lectern is the main place and nothing the advisors already said is lost.
- **Quiet-night collapse (D2): done.** With nothing on the agenda the eight hollow "none found" seats are replaced by one picture of the empty hall (`council-quiet`) and one line ("Nothing on the table tonight. The rules found nothing. That is not proof there is nothing."). With art off, or when the agenda has items, the round table is unchanged. It is a layout change, not a reward: no tick, no count.
- **"Do you two agree?" (C folded in) and tokens on the table (A-lite):** not built. The four questions ship as the spec table says. The picker is a row of tower buttons (a gold pennant marks towers the agenda names).

Built:
- `GET /game/council/ask?holding_id=&question=why_here|edge|storm|beside&advisor=oracle|partner` (read-only, demo mode wins, 404 for an unknown holding, 422 for any other question). Answers are chosen in `app/services/game/council_ask.py` and worded in the versioned file `app/domain/game_mapping/council_questions_v1.py` (a change that could alter a real answer is a new `council_questions_v2.py`). Numbers are filled by application code; no model, no free text, nothing the player wrote is read.
- Each answer carries `read` (`read`, `silent` when that advisor has no rule for the holding, `none` when nothing is stored), the stored facts it was built from, and the rule names for "why is this here". Silence and "no reading" print a plain note and use the unknown seal, never an all-clear look.
- Frontend: `CouncilLectern` (tower buttons, a radio group of four questions with arrow keys, two councillor buttons with the new speaking pictures, an answer bubble with fact chips, "Ask the other one the same", link to the holding), `CouncilQuiet`, `lib/councilAsk.ts`.
- Art (Stitch pictures Faiz generated, packed by `scripts/art/pack.py`): `council-lectern`, `council-speak-oracle`, `council-speak-partner`, `council-quiet`. `pack.py` gained a `vignette` key mode for the quiet room (dark scene that fades to white at its rim; the rim is darkened so it blends into the chamber).

Identity: Council page 2 -> 3 expected (the advisors now do something). To judge in a browser: phone width, a quiet night (no agenda items), a holding with no stored stress result (no reading), and the keyboard path through the four questions.
