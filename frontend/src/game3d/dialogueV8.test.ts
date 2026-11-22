import { describe, expect, it } from "vitest";
import { talk as talkV6 } from "./dialogueV6";
import { talk as talkV7 } from "./dialogueV7";
import { guideTalk, talk } from "./dialogueV8";
import type { GuideTalk } from "./dialogueV8";
import { EMPTY_GUIDE, GUIDE_STEPS, guideStatus } from "./guideQuests";
import type { GuideStatus, GuideStepId } from "./guideQuests";
import { GUIDE_STEP_GOAL, GUIDE_STEP_TITLE, guideLines, guideTitle, guideWhere } from "./guideWordsV2";
import type { QuestState, ReviewQuestState } from "./quest";

const quest: QuestState = { status: "loading", total: 0, written: 0, missing: [] };
const reviews: ReviewQuestState = { status: "empty", entries: 0, due: [] };

function at(step: GuideStepId | null, met: GuideTalk["met"] = []): GuideTalk {
  const status: GuideStatus = {
    level: step ? GUIDE_STEPS.indexOf(step) : 5,
    done: { meet: false, sal: false, stall: false, weather: false, why: false },
    current: step,
  };
  return { status, met };
}

const BANNED = /\b(buy|buys|bought|sell|sells|sold|cheer|cheers|congrat\w*|xp|points?|streak|reward)\b/i;

describe("dialogue v8 (guide words v2)", () => {
  it("speaks v6 exactly when there is no Guide, or it is all done", () => {
    expect(talk("oracle", quest, reviews)).toEqual(talkV6("oracle", quest, reviews));
    expect(talk("partner", quest, reviews, undefined, at(null))).toEqual(talkV6("partner", quest, reviews));
    expect(talk("oracle", quest, reviews, undefined, { status: guideStatus(EMPTY_GUIDE, { stalls: 0, whys: 0 }), met: [] })).not.toEqual(
      talkV6("oracle", quest, reviews),
    );
  });

  it("leaves the first why to the existing lines (they already say what a why is and where the desk is)", () => {
    expect(guideTalk("oracle", at("why"))).toBeNull();
    expect(talk("oracle", quest, reviews, undefined, at("why"))).toEqual(talkV6("oracle", quest, reviews));
  });

  it("step 1: first hello points at the other advisor; the second hands over the next job", () => {
    const first = guideLines("oracle", "meet", false) ?? [];
    expect(first.join(" ")).toMatch(/Marlie/);
    expect((guideLines("partner", "meet", false) ?? []).join(" ")).toMatch(/Barren/);
    expect((guideLines("oracle", "meet", true) ?? []).join(" ")).toMatch(/Sal/);
    expect((guideLines("partner", "meet", true) ?? []).join(" ")).toMatch(/Barren has a job/);
  });

  it("the giver speaks the job and the other advisor points to the giver", () => {
    expect((guideLines("oracle", "sal", true) ?? []).join(" ")).toMatch(/Sal runs the market/);
    expect((guideLines("partner", "sal", true) ?? []).join(" ")).toMatch(/Barren/);
    expect((guideLines("partner", "weather", true) ?? []).join(" ")).toMatch(/pole by the keep/);
    expect((guideLines("partner", "weather", true) ?? []).join(" ")).not.toMatch(/Weather Tower|curve/);
    expect((guideLines("oracle", "weather", true) ?? []).join(" ")).toMatch(/Marlie/);
    expect((guideLines("oracle", "stall", true) ?? []).join(" ")).toMatch(/shelves/);
  });

  it("uses the step you walked up for, not the one your talk just finished", () => {
    const snap = at("meet", ["partner"]);
    expect(guideTalk("oracle", snap)?.join(" ")).toMatch(/met us both/);
  });

  it("is short, plain and never trades, cheers or rewards", () => {
    for (const step of GUIDE_STEPS) {
      for (const npc of ["oracle", "partner"] as const) {
        for (const metOther of [false, true]) {
          for (const line of guideLines(npc, step, metOther) ?? []) {
            expect(line).not.toMatch(BANNED);
            expect(line.split(/\s+/).length).toBeLessThanOrEqual(22);
          }
        }
      }
      expect(GUIDE_STEP_TITLE[step]).not.toMatch(BANNED);
      expect(GUIDE_STEP_GOAL[step]).not.toMatch(BANNED);
      for (const taken of [false, true]) expect(guideWhere(step, taken)).not.toMatch(BANNED);
    }
  });
});

describe("guide words v2 (#478)", () => {
  it("step 4 names the unknown sky too, so not surveyed is never read as calm", () => {
    expect(GUIDE_STEP_GOAL.weather).toMatch(/not known/);
    expect((guideLines("partner", "weather", true) ?? []).join(" ")).toMatch(/Not surveyed is not calm/);
  });
  it("the title counts the ticks and names the one next step", () => {
    expect(guideTitle(1, "meet")).toBe("1 of 5 done. Next: Meet the advisors");
    expect(GUIDE_STEP_TITLE.weather).toBe("Read the sky");
  });
  it("no step sends a beginner to the yield curve or the Weather Tower", () => {
    for (const step of GUIDE_STEPS) {
      const all = [GUIDE_STEP_TITLE[step], GUIDE_STEP_GOAL[step], guideWhere(step, false), guideWhere(step, true)].join(" ");
      expect(all).not.toMatch(/Weather Tower|curve|maturity/i);
    }
  });
  it("v8 speaks the v2 guide words, and everything else as v7", () => {
    const snap = at("weather", ["oracle", "partner"]);
    expect(talk("partner", quest, reviews, undefined, snap)).toEqual(guideLines("partner", "weather", true));
    expect(talk("oracle", quest, reviews, undefined, snap)).toEqual(talkV7("oracle", quest, reviews, undefined, snap));
    expect(talk("oracle", quest, reviews)).toEqual(talkV7("oracle", quest, reviews));
  });
});
