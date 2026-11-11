import { describe, expect, it } from "vitest";
import { DESK } from "./desk";
import { DESK_NUDGE, DESK_WHERE, DIALOGUE_VERSION, DRILL_ORACLE, DRILL_PARTNER, closeLabel, pointsToDesk, pointsToImport, sayShare, talk } from "./dialogueV6";
import { NPCS } from "./npcs";
import { sixMonthReckoning } from "./quest";
import type { QuestState, ReviewQuestState } from "./quest";
import type { DrillQuestState } from "./stormDrill";

/** The same banned words as the earlier dialogue tests, plus the old jargon this pass removed. */
const BANNED = /\b(buy|sell|sold|bought|avoid|thesis|tripwire|portfolio|queue|filing|wrong-if|both lines|need words|missing line)\b/i;
const CHEER = /(great job|well done|congrat|nice work|awesome|amazing|!)/i;
const RAW_LONG_NUMBER = /\d{4,}/;

const raw = "16.55923263615708780773615393";
const missing = (name: string, weightPct: string | number | null) => ({ name, facts: { weightPct } });
const q = (status: QuestState["status"], m: ReturnType<typeof missing>[] = []): QuestState =>
  ({ status, total: 7, written: 7 - m.length, missing: m }) as unknown as QuestState;
const quests: QuestState[] = [
  q("loading"),
  q("unreadable"),
  q("empty"),
  q("open", [missing("Orkla", raw)]),
  q("open", [missing("Orkla", raw), missing("Alpha", "3.456"), missing("Beta", null)]),
  q("done"),
];
const clear = sixMonthReckoning([], false);
const dueEntry = (id: string, name: string, conf: number | null, days: number) =>
  ({ id, holding_id: id, ticker: name, company_name: name, thesis: "x", confidence: conf, outcome: { days_since: days, review_6m_due: true, review_12m_due: false } }) as never;
const dueOne = sixMonthReckoning([dueEntry("a", "Alpha", 5, 300)], false);
const dueMany = sixMonthReckoning([dueEntry("a", "Alpha", 5, 300), dueEntry("b", "Beta", 2, 200), dueEntry("c", "Gamma", null, 190)], false);
const reviews: ReviewQuestState[] = [clear, dueOne, dueMany];
const drillOpen: DrillQuestState = { status: "open", count: 0, latestFall: null };

const all = (): string[] => {
  const out: string[] = [];
  for (const who of ["oracle", "partner"] as const) {
    for (const quest of quests) for (const r of reviews) for (const d of [undefined, drillOpen]) out.push(...talk(who, quest, r, d));
  }
  return out;
};

describe("dialogue v6: plain words", () => {
  it("is version v6", () => expect(DIALOGUE_VERSION).toBe("v6"));

  it("never shows trade wording, cheering or the old jargon, in any state", () => {
    for (const line of all()) {
      expect(line).not.toMatch(BANNED);
      expect(line).not.toMatch(CHEER);
    }
  });

  it("keeps every sentence short (20 words or fewer)", () => {
    for (const line of all()) {
      for (const sentence of line.split(/(?<=[.?])\s+/)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20);
      }
    }
  });

  it("never prints the raw share: 16.559... is said as 'about 17%', and the long number is gone", () => {
    const text = talk("partner", quests[3], clear).join(" ");
    expect(text).toContain("Orkla: about 17% of your fortress");
    for (const line of all()) expect(line).not.toMatch(RAW_LONG_NUMBER);
  });

  it("says shares the way a person says them, and keeps unknown unknown", () => {
    expect(sayShare("16.55923263615708780773615393")).toBe("about 17%");
    expect(sayShare("40")).toBe("40%");
    expect(sayShare(40)).toBe("40%");
    expect(sayShare("3.456")).toBe("about 3.5%");
    expect(sayShare("3.5")).toBe("3.5%");
    expect(sayShare("0.02")).toBe("under 0.1%");
    expect(sayShare("0")).toBe("0%");
    expect(sayShare(null)).toBeNull();
    expect(sayShare("")).toBeNull();
    expect(sayShare("not a number")).toBeNull();
    expect(sayShare("-3")).toBeNull();
  });

  it("drops the share when it is unknown, and never invents one", () => {
    const text = talk("partner", q("open", [missing("Beta", null)]), clear).join(" ");
    expect(text).toContain("Beta.");
    expect(text).not.toMatch(/%/);
  });

  it("names holdings from the data and counts them exactly", () => {
    const one = talk("oracle", quests[3], clear);
    expect(one[0]).toBe("One holding has no why yet: Orkla.");
    const three = talk("oracle", quests[4], clear);
    expect(three[0]).toBe("3 of your 7 holdings have no why yet: Orkla, Alpha and Beta.");
    expect(talk("partner", quests[4], clear)[0]).toBe("3 holdings with no why. The biggest is Orkla: about 17% of your fortress.");
  });

  it("explains what a 'why' is, once, in plain words, while something is unwritten", () => {
    expect(talk("oracle", quests[3], clear).join(" ")).toMatch(/why you own it, and what would prove you wrong/);
    expect(talk("partner", quests[3], clear).join(" ")).toMatch(/why you own it, what proves you wrong/);
  });

  it("tells the player where the desk is, and the words match the world", () => {
    expect(DESK_NUDGE.join(" ")).toContain(DESK_WHERE);
    expect(talk("oracle", quests[3], clear).join(" ")).toContain(DESK_WHERE);
    expect(talk("partner", quests[3], clear).join(" ")).toContain(DESK_WHERE);
    // "Straight on toward the keep, on your left" holds for someone who has walked in at the gate (the advisors' spot):
    // the desk is further north than the advisors (toward the keep) and west of the road in (the left, heading north).
    for (const n of NPCS) {
      expect(DESK.z).toBeLessThan(n.z - 20);
      expect(DESK.x).toBeLessThan(0);
    }
  });

  it("is unknown when the journal cannot be read: never 'done', never a guessed count", () => {
    for (const who of ["oracle", "partner"] as const) {
      const text = talk(who, quests[1], clear).join(" ");
      expect(text).not.toMatch(/all \d+|written\./i);
      expect(text).not.toMatch(/\d/);
    }
  });

  it("keeps the two voices apart: the Oracle in full phrases, the Partner clipped", () => {
    const words = (who: "oracle" | "partner") => quests.flatMap((quest) => talk(who, quest, clear)).join(" ").split(/\s+/).length;
    expect(words("partner")).toBeLessThan(words("oracle"));
    expect(talk("oracle", quests[5], clear).join(" ")).toMatch(/come back/i);
    expect(talk("partner", quests[5], clear)[0]).toBe("All 7 written. That was the easy part.");
  });

  it("lets the earlier quests speak first, then points at the drill post", () => {
    expect(talk("oracle", quests[3], clear, drillOpen)).toEqual(talk("oracle", quests[3], clear));
    expect(talk("partner", quests[5], dueOne, drillOpen)).toEqual(talk("partner", quests[5], dueOne));
    expect(talk("oracle", quests[5], clear, drillOpen)).toEqual([...DRILL_ORACLE]);
    expect(talk("partner", quests[5], clear, drillOpen)).toEqual([...DRILL_PARTNER]);
  });

  it("speaks the look-backs in singular and plural", () => {
    expect(talk("oracle", quests[5], dueOne)[0]).toBe("One note is old enough to look back on: Alpha (6 months).");
    expect(talk("oracle", quests[5], dueMany)[0]).toMatch(/^3 notes are old enough to look back on: /);
    expect(talk("partner", quests[5], dueOne)[0]).toBe("1 look-back due. Start with Alpha, where you were 5 out of 5 sure.");
    expect(talk("partner", quests[5], dueMany)[0]).toBe("3 look-backs due. Start with Alpha, where you were 5 out of 5 sure.");
  });

  it("is the same words for the same state (no randomness)", () => {
    expect(all()).toEqual(all());
  });

  it("points to import and to the desk for the right advisor and state only", () => {
    expect(pointsToImport("oracle", quests[2])).toBe(true);
    expect(pointsToImport("partner", quests[2])).toBe(false);
    expect(pointsToDesk("oracle", quests[3])).toBe(true);
    expect(pointsToDesk("partner", quests[3])).toBe(false);
  });

  it("labels the close button: 'Not now' beside another next step, else 'Got it'", () => {
    expect(closeLabel("oracle", quests[2])).toBe("Not now (E)");
    expect(closeLabel("oracle", quests[1])).toBe("Not now (E)");
    expect(closeLabel("partner", quests[3])).toBe("Got it (E)");
    expect(closeLabel("oracle", quests[5])).toBe("Got it (E)");
  });
});
