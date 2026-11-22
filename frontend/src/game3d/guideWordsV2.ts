/**
 * The Guide's words (version 2, 2026-11-22, #478). What changed from v1:
 *  - The title counts the ticks the player can see, and names the next step ("1 of 5 done. Next: Meet the advisors"). v1
 *    counted only steps done in a row, so a list with one tick could read "0 of 5 done".
 *  - Step 4 is "Read the sky" at the banner pole by the keep, not the Weather Tower (a yield-curve room is not a
 *    beginner's stop). Provisional until Faiz decides the starter level (#476, #477).
 *  - The rest of the Quests panel folds under "More" while First Steps is open.
 * Game voice: short, plain, one idea a line. Barren Wuffet stays warm and in full phrases; Marlie Chunger stays clipped and
 * dry. Hand-written, chosen by fixed rules, no model writes a word. No buy or sell wording, no cheering, no reward for
 * acting. v1 stays untouched; a change to shown wording is a new version file (`guideWordsV3.ts`).
 */
import type { GuideStepId } from "./guideQuests";
import type { NpcId } from "./npcs";
import {
  GUIDE_DONE_PILL as V1_DONE_PILL,
  GUIDE_REPLAY as V1_REPLAY,
  GUIDE_SAMPLE as V1_SAMPLE,
  GUIDE_TAG as V1_TAG,
  GUIDE_TODO_PILL as V1_TODO_PILL,
  guideLines as guideLinesV1,
  guideWhere as guideWhereV1,
} from "./guideWordsV1";

export const GUIDE_WORDS_VERSION = "v2";

export const GUIDE_TAG = V1_TAG;
export const GUIDE_REPLAY = V1_REPLAY;
export const GUIDE_SAMPLE = V1_SAMPLE;
export const GUIDE_DONE_PILL = V1_DONE_PILL;
export const GUIDE_TODO_PILL = V1_TODO_PILL;

/** The card's title while the guide is open: the ticks the player sees, then the one next step. */
export const guideTitle = (ticked: number, next: GuideStepId): string => `${ticked} of 5 done. Next: ${GUIDE_STEP_TITLE[next]}`;
/** The card's title once all five are ticked. */
export const GUIDE_TITLE_DONE = "First Steps: all 5 done";
export const GUIDE_ALL_DONE = "The quests below are the long game.";

/** The fold that holds the rest of the panel (round, Standing, the long quests) while First Steps is open. */
export const GUIDE_MORE = "More quests";
/** The fold's label when today's round is inside it with stops still open, so the round is never hidden without a word. */
export const guideMoreLabel = (roundOpen: number): string =>
  roundOpen > 0 ? `${GUIDE_MORE} · ${roundOpen} ${roundOpen === 1 ? "stop" : "stops"} open` : GUIDE_MORE;
/** The Quests chip's name for screen readers while First Steps is open. */
export const guideChipLabel = (left: number): string => `Quests, ${left} first ${left === 1 ? "step" : "steps"} to go`;

export const GUIDE_STEP_TITLE: Record<GuideStepId, string> = {
  meet: "Meet the advisors",
  sal: "Visit Sal's counter",
  stall: "Stock a stall",
  weather: "Read the sky",
  why: "Write your first why",
};

export const GUIDE_STEP_GOAL: Record<GuideStepId, string> = {
  meet: "Say hello to Barren and Marlie.",
  sal: "Go to Sal's counter and say hello.",
  stall: "Pick a company off Sal's shelves. It gets a stall.",
  weather: "Calm, stormy, or not known yet? Read the plate on the pole by the keep.",
  why: "Write one why at the desk, and what proves you wrong.",
};

/** One line on where to go next. `taken` is true once the giver has handed the step over. */
export function guideWhere(step: GuideStepId, taken: boolean): string {
  if (step === "weather") return taken ? "Look for the mark over the pole by the keep." : "Talk to Marlie. The mark is over her.";
  return guideWhereV1(step, taken);
}

/** What an advisor says while `step` is the open Guide step. `metOther` is true when the other advisor was already met. */
export function guideLines(npc: NpcId, step: GuideStepId, metOther: boolean): string[] | null {
  if (step === "weather" && npc === "partner") {
    return ["Know the weather before you build.", "The pole by the keep says calm, stormy, or not surveyed. Go and read it.", "Not surveyed is not calm."];
  }
  return guideLinesV1(npc, step, metOther);
}
