import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GameState, GameTower, JournalEntry } from "../lib/types";
import { ApiError } from "../lib/api";
import { talk } from "./dialogueV4";
import QuestLog from "./QuestLog";
import { sixMonthReckoning } from "./quest";
import { unwrittenThesisV2 } from "./questV2";
import * as questWords from "./questWordsV3";
import { saveErrorDetail } from "./saveError";
import { shelvesFor } from "./libraryShelves";
import * as shelfWords from "./shelfSignsV2";
import * as yardWords from "./siegeYardWordsV2";
import { stateToWorld } from "./stateToWorld";
import { STREET_EMPTY, STREET_EMPTY_AT_SAL, emptyStreetNote } from "./streetPlan";

/** The wording rules of text pass 3, pinned so they stay fixed. */
const BANNED = /\b(buy|sell|sold|bought|avoid|thesis|tripwire|beta|ebitda|stale|filing|churn|stagflation|not surveyed|not stored|flat page|flat fortress|reckoning)\b/i;
const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const stringsOf = (o: Record<string, unknown>): string[] =>
  Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : v && typeof v === "object" ? stringsOf(v as Record<string, unknown>) : []));

const t = {
  holding_id: "a", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
  value_nok: "1000", weight_pct: "40", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
  wall_inputs: { net_debt_to_ebitda: "1.4", interest_coverage: "6.2" }, freshness: "fresh", analysis_age_days: 1, verdict_rating: "Buy",
  land: "discount", land_reason: "", margin_of_safety_pct: "10", thesis: "intact", tripwires_fired: 0, siege_exposure: "sheltered",
  siege_shock_pct: "-0.1", siege_method: "volatility", shared_wall_with: [],
} as unknown as GameTower;
const holdings = stateToWorld({ mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null, towers: [t] } as unknown as GameState).plain;

const entry = (o: Partial<JournalEntry>): JournalEntry =>
  ({ id: "e", holding_id: "a", company_name: "Alpha", ticker: "AAA", thesis: "why", invalidation: "wrong if", confidence: 4, outcome: { days_since: 300, review_6m_due: true, review_12m_due: false }, ...o }) as JournalEntry;

const quests = {
  loading: unwrittenThesisV2(holdings, null, false),
  unreadable: unwrittenThesisV2(holdings, null, true),
  empty: unwrittenThesisV2([], [], false),
  // a why without a wrong-if line still counts as missing
  open: unwrittenThesisV2(holdings, [entry({ invalidation: "" })], false),
  done: unwrittenThesisV2(holdings, [entry({})], false),
};
const due = sixMonthReckoning([entry({})], false);
const clear = sixMonthReckoning([], false);

describe("advisor voices, dialogue v4", () => {
  const lines = (npc: "oracle" | "partner") => [
    ...Object.values(quests).flatMap((q) => talk(npc, q, clear)),
    ...talk(npc, quests.done, due),
  ];

  it("has no buy, sell, avoid or finance-jargon word, and no doubled full stop", () => {
    for (const npc of ["oracle", "partner"] as const)
      for (const l of lines(npc)) {
        expect(l).not.toMatch(BANNED);
        expect(l).not.toMatch(/\.\./);
        expect(l).not.toMatch(/\bwritten reason\b/i);
        expect(words(l)).toBeLessThanOrEqual(28);
      }
  });

  it("tells the count the way the quest counts it: a holding with a why but no wrong-if line is still to write", () => {
    expect(quests.open.status).toBe("open");
    expect(quests.open.missing).toHaveLength(holdings.length);
    expect(talk("oracle", quests.open, clear)[0]).toBe("1 of your 1 holdings still need words: Alpha.");
    expect(talk("oracle", quests.done, clear)[0]).toBe("All 1 holdings have both lines.");
  });

  it("keeps two voices: the Oracle warm, the Partner clipped and dry", () => {
    expect(talk("partner", quests.open, clear)[0]).toBe("No why on paper? Then nothing can prove you wrong. Convenient.");
    const warm = talk("oracle", quests.open, clear).join(" ");
    const dry = talk("partner", quests.open, clear).join(" ");
    expect(words(dry)).toBeLessThan(words(warm));
  });

  it("points the Oracle to the desk, and nobody else", () => {
    expect(talk("oracle", quests.open, clear).at(-1)).toBe("The desk by the keep door is waiting.");
    expect(talk("partner", quests.open, clear).join(" ")).not.toContain("desk");
  });
});

describe("Quest log words, v3", () => {
  const render = (standing?: Parameters<typeof QuestLog>[0]["standing"]) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <QuestLog quest={quests.open} reviews={due} demo={false} standing={standing} />
      </MemoryRouter>,
    );

  it("uses the review's names and no banned word", () => {
    const html = render();
    expect(html).toContain("Write Your Whys");
    expect(html).toContain("Six-Month Look-back");
    expect(html).toContain("To do");
    expect(html).not.toContain(">Open<");
    expect(html).not.toContain("Unwritten Thesis");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(BANNED);
    for (const s of stringsOf(questWords as unknown as Record<string, unknown>)) expect(s).not.toMatch(BANNED);
  });

  it("counts both lines, like the quest does", () => {
    expect(render()).toContain("0 of 1 have both lines");
  });

  it("adds no second full stop to a Standing line that already ends in one", () => {
    const html = render({ headline: "Level 1 of 5: Bare Ground", next: "Nothing is known.", lit: 1, watch: "The watch has not reported. Nothing is known.", ledger: "Two look-backs." });
    expect(html).not.toMatch(/\.\.(?!\.)/);
    expect(html).toContain("Nothing is known.</p>");
  });

  it("keeps every fixed line short", () => {
    for (const s of stringsOf(questWords as unknown as Record<string, unknown>)) expect(words(s)).toBeLessThanOrEqual(16);
  });
});

describe("Siege Yard words, v2", () => {
  it("says sway, not beta, and keeps unknown as fog", () => {
    expect(yardWords.YARD_SWAY).toBe("Sway");
    expect(yardWords.YARD_SWAY_HOVER).toContain("1.0 moves with the market");
    expect(yardWords.YARD_STATUS.unmodelled).toBe("In fog");
    expect(yardWords.YARD_LEVEL_NAME.unsurveyed).toBe("In fog");
  });

  it("has no banned word and no doubled full stop", () => {
    const all = [...stringsOf(yardWords as unknown as Record<string, unknown>), yardWords.yardFogTitle(2), yardWords.yardMoreLine(3), yardWords.yardCoverageLine(2, 3, "90%")];
    for (const s of all) {
      expect(s).not.toMatch(BANNED);
      expect(s).not.toMatch(/\.\./);
    }
  });

  it("keeps the face short; the long note is only the hover", () => {
    expect(words(yardWords.YARD_GAP)).toBeLessThanOrEqual(3);
    expect(words(yardWords.yardHeadline("30%", "market fall", "gathering", "12.3", "costs"))).toBeLessThanOrEqual(14);
    expect(yardWords.yardHeadline("30%", "market fall", "gathering", "12.3", "costs")).toBe("A 30% market fall costs the fortress 12.3%. Crosses the storm line.");
  });
});

describe("shelf signs, v2", () => {
  it("keeps every sign to three words or fewer", () => {
    for (const s of Object.values(shelfWords.SHELF_SIGN)) expect(words(s)).toBeLessThanOrEqual(3);
  });

  it("has no banned word on any shelf face, even when the stored rating reads Buy", () => {
    const fog = { wall: "unsurveyed", moat: "unsurveyed", land: "fog", thesis: "not_analyzed", siege_exposure: "unsurveyed", siege_shock_pct: null, size_class: "unknown" } as Partial<GameTower>;
    for (const tower of [t, { ...t, ...fog } as GameTower, { ...t, thesis: "breached", tripwires_fired: 2, freshness: "overgrown" } as GameTower])
      for (const s of shelvesFor(tower)) {
        const face = [s.title, s.asks, ...s.lines.flatMap((l) => [l.label, l.text])].join(" | ");
        expect(face).not.toMatch(BANNED);
      }
  });

  it("writes wall numbers in plain words and keeps the digits exact", () => {
    const text = shelvesFor(t)[0].lines.map((l) => l.text).join(" | ");
    expect(text).toContain("Debt vs yearly profit: 1.40 times");
    expect(text).toContain("Times profit covers interest: 6.20 times");
  });
});

describe("bug fixes", () => {
  it("an empty Market Street points to Sal, and an unread or full one says nothing", () => {
    expect(emptyStreetNote("hype", 0)).toBe(STREET_EMPTY);
    expect(emptyStreetNote("sal", 0)).toBe(STREET_EMPTY_AT_SAL);
    expect(STREET_EMPTY).toContain("Sal");
    expect(emptyStreetNote("sal", null)).toBeNull();
    expect(emptyStreetNote("sal", 3)).toBeNull();
  });

  it("a failed save never says it could not load", () => {
    expect(saveErrorDetail(new ApiError(500, "boom"))).not.toMatch(/load/i);
    expect(saveErrorDetail(new TypeError("fetch failed"))).toBe("No answer from the server.");
    expect(saveErrorDetail("odd")).toBe("");
  });
});
