/**
 * The Guide's words (version 1, 2026-11-11): the Quest log card and what the advisors say while a Guide step is open.
 * Game voice: short, plain, one idea a line, no heavy copy. Barren Wuffet stays warm and in full phrases; Marlie Chunger
 * stays clipped and dry. Hand-written, chosen by fixed rules, no model writes a word. No buy or sell wording, no cheering,
 * no reward for acting. A change to shown wording is a new version file (`guideWordsV2.ts`).
 */
import type { GuideStepId } from "./guideQuests";
import type { NpcId } from "./npcs";

export const GUIDE_WORDS_VERSION = "v1";

export const GUIDE_TAG = "Guide";
export const guideTitle = (level: number): string => `First Steps: ${level} of 5 done`;
export const GUIDE_ALL_DONE = "All five done. The quests below are the long game.";
export const GUIDE_REPLAY = "Start the guide again";
export const GUIDE_SAMPLE = "Sample fortress: stalls and whys are not saved here.";
export const GUIDE_DONE_PILL = "Done";
export const GUIDE_TODO_PILL = "To do";

export const GUIDE_STEP_TITLE: Record<GuideStepId, string> = {
  meet: "Meet the advisors",
  sal: "Visit Sal's counter",
  stall: "Stock a stall",
  weather: "See the weather",
  why: "Write your first why",
};

export const GUIDE_STEP_GOAL: Record<GuideStepId, string> = {
  meet: "Say hello to Barren and Marlie.",
  sal: "Go to Sal's counter and say hello.",
  stall: "Pick a company off Sal's shelves. It gets a stall.",
  weather: "Walk into the Weather Tower.",
  why: "Write one why at the desk, and what proves you wrong.",
};

/** One line on where to go next. `taken` is true once the giver has handed the step over. */
export function guideWhere(step: GuideStepId, taken: boolean): string {
  switch (step) {
    case "meet":
      return "They stand just inside the gate.";
    case "sal":
      return taken ? "Look for the mark over Sal's counter." : "Talk to Barren. The mark is over him.";
    case "stall":
      return "The mark is over Sal. Talk to him.";
    case "weather":
      return taken ? "Look for the mark outside the gate." : "Talk to Marlie. The mark is over her.";
    case "why":
      return taken ? "Look for the mark at the desk." : "Talk to Barren. The mark is over him.";
  }
}

/** What an advisor says while `step` is the open Guide step. `metOther` is true when the other advisor was already met. */
export function guideLines(npc: NpcId, step: GuideStepId, metOther: boolean): string[] | null {
  switch (step) {
    case "meet":
      if (npc === "oracle") {
        return metOther
          ? ["Good. You have met us both.", "Sal runs the market. Go and say hello. Look for the mark over his counter."]
          : ["Welcome, friend. I am Barren Wuffet.", "Marlie Chunger stands beside me. Say hello to her too."];
      }
      return metOther
        ? ["That's both of us.", "Barren has a job for you. Go and talk to him."]
        : ["Marlie Chunger. I keep him honest.", "Say hello to Barren too."];
    case "sal":
      return npc === "oracle"
        ? ["Sal runs the market.", "Go and say hello. Look for the mark over his counter."]
        : ["Barren has a job for you.", "Talk to him. He has the mark."];
    case "stall":
      return npc === "oracle"
        ? ["Sal has a job for you.", "Pick a company off his shelves."]
        : ["Sal is waiting.", "Pick a company off his shelves. It gets its own stall."];
    case "weather":
      return npc === "partner"
        ? ["Know the weather before you build.", "The Weather Tower is outside the gate, beside the Town Hall. Walk in. Look for the mark."]
        : ["Marlie has a job for you.", "Talk to her."];
    case "why":
      // The "why" step uses the advisors' existing lines (dialogueV6): they already say what a why is and where the desk is.
      return null;
  }
}
