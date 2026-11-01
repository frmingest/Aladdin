import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Standing } from "../lib/types";
import QuestLog from "./QuestLog";
import { sixMonthReckoning, unwrittenThesis } from "./quest";
import { litTorches } from "./standingTorches";
import { standingWordsV3, wordsFor } from "./standingWordsV3";

const gate = (level: number, fact: string) => ({ level, title: "", met: false, done: null, total: null, fact });
const v3 = (over: Partial<Standing> = {}): Standing => ({
  version: "v3", demo: false, level: 4, max_level: 5, title: "The Watch",
  next_step: "Look back: when an entry turns six months, write what really happened.",
  gates: [gate(4, "The watch reports in. Every wire looked at"), gate(5, "1 look-back due")],
  gaps: [], ...over,
});

describe("standing words v3 (The Ledger)", () => {
  it("names the level out of five and says what the ledger shows once levels 1 to 4 hold", () => {
    const w = standingWordsV3(v3(), false);
    expect(w.headline).toBe("Level 4 of 5: The Watch");
    expect(w.lit).toBe(4);
    expect(w.ledger).toBe("1 look-back due");
    expect(w.next).toMatch(/six months/);
  });

  it("lights the fifth torch only at level 5, and says it is held, not won", () => {
    const w = standingWordsV3(v3({ level: 5, title: "The Ledger", next_step: null, gates: [gate(5, "3 look-backs written, none due")] }), false);
    expect(w.lit).toBe(5);
    expect(litTorches(w.lit)).toBe(5);
    expect(w.ledger).toBe("3 look-backs written, none due");
    expect(w.next).toBe("All five lit. Keep looking back as entries age.");
  });

  it("says nothing about the ledger below level 4, for the sample and when unreadable", () => {
    expect(standingWordsV3(v3({ level: 3, title: "Reasons" }), false).ledger).toBeNull();
    expect(standingWordsV3(v3({ demo: true, level: 0, title: null }), false)).toMatchObject({ lit: 0, ledger: null, headline: "Sample fortress: no Standing yet." });
    expect(standingWordsV3(null, true)).toMatchObject({ lit: 0, ledger: null });
    expect(standingWordsV3(null, false)).toMatchObject({ lit: 0, ledger: null });
  });

  it("stays short and never uses buy/sell wording, a score or a streak", () => {
    const facts = ["Too soon to look back: the first opens in 92 days", "2 look-backs due", "No journal entries yet. Nothing to look back on"];
    for (const f of facts) {
      for (const s of [v3({ gates: [gate(5, f)] }), v3({ level: 5, next_step: null, gates: [gate(5, f)] })]) {
        const w = standingWordsV3(s, false);
        for (const t of [w.headline, w.next ?? "", w.ledger ?? ""]) {
          expect(t.split(/\s+/).length).toBeLessThanOrEqual(12);
          expect(t).not.toMatch(/\b(buy|sell|trim|great job|well done|congrat|xp|points|streak)/i);
        }
      }
    }
  });

  it("wordsFor follows the version the backend served, so v2 keeps its own words", () => {
    expect(wordsFor(v3(), false).headline).toBe("Level 4 of 5: The Watch");
    const v2 = v3({ version: "v2", max_level: 4, level: 4, next_step: null, gates: [gate(4, "The watch reports in. Every wire looked at")] });
    expect(wordsFor(v2, false)).toMatchObject({ headline: "Level 4 of 4: The Watch", ledger: null });
    expect(wordsFor(v2, false).next).toMatch(/wire/);
    expect(wordsFor(null, true).lit).toBe(0);
  });

  it("the Quest log shows the ledger line under the watch line", () => {
    const quest = unwrittenThesis([], [], false);
    const reviews = sixMonthReckoning([], false);
    const html = renderToStaticMarkup(
      <MemoryRouter><QuestLog quest={quest} reviews={reviews} demo={false} standing={wordsFor(v3(), false)} /></MemoryRouter>,
    );
    expect(html).toContain("1 look-back due.");
    expect(html.indexOf("The watch reports in")).toBeLessThan(html.indexOf("look-back due"));
  });
});
