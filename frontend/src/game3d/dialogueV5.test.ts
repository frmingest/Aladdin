import { describe, expect, it } from "vitest";
import { DRILL_ORACLE, DRILL_PARTNER, pointsToDrill, talk } from "./dialogueV5";
import { talk as talkV4 } from "./dialogueV4";
import { sixMonthReckoning } from "./quest";
import type { QuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";

const BANNED = /\b(buy|sell|sold|bought|avoid|thesis|tripwire|portfolio|queue|filing)\b/i;

const done = { status: "done", total: 3 } as unknown as QuestState;
const open = { status: "open", total: 3, missing: [{ name: "Alpha", facts: { weightPct: 40 } }] } as unknown as QuestState;
const clear = sixMonthReckoning([], false);
const due = sixMonthReckoning(
  [{ id: "e", holding_id: "a", company_name: "Alpha", ticker: "AAA", thesis: "why", invalidation: "x", confidence: 4,
     outcome: { days_since: 300, review_6m_due: true, review_12m_due: false } }] as never,
  false,
);
const drillOpen: DrillQuestState = { status: "open", count: 0, latestFall: null };
const drillDone: DrillQuestState = { status: "done", count: 1, latestFall: 0.3 };

describe("dialogue v5: the drill post nudge", () => {
  it("points both people at the drill post once both journal quests are quiet and no drill is written", () => {
    expect(pointsToDrill(done, clear, drillOpen)).toBe(true);
    expect(talk("oracle", done, clear, drillOpen)).toEqual([...DRILL_ORACLE]);
    expect(talk("partner", done, clear, drillOpen)).toEqual([...DRILL_PARTNER]);
  });

  it("stays quiet about the drill when a drill is written, unknown, a sample, or not passed at all", () => {
    for (const d of [drillDone, { status: "loading", count: 0, latestFall: null }, { status: "unreadable", count: 0, latestFall: null }, { status: "sample", count: 0, latestFall: null }] as DrillQuestState[]) {
      expect(pointsToDrill(done, clear, d)).toBe(false);
      expect(talk("oracle", done, clear, d)).toEqual(talkV4("oracle", done, clear));
    }
    expect(talk("oracle", done, clear)).toEqual(talkV4("oracle", done, clear));
  });

  it("lets the earlier quests speak first", () => {
    expect(talk("oracle", open, clear, drillOpen)).toEqual(talkV4("oracle", open, clear));
    expect(talk("partner", done, due, drillOpen)).toEqual(talkV4("partner", done, due));
  });

  it("keeps the words clean: no trade wording, and it says where the post is", () => {
    for (const line of [...DRILL_ORACLE, ...DRILL_PARTNER]) expect(line).not.toMatch(BANNED);
    expect(DRILL_ORACLE.join(" ")).toMatch(/drill post/i);
    expect(DRILL_PARTNER.join(" ")).toMatch(/drill post/i);
  });
});
