import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GameState, GameTower, JournalEntry } from "../lib/types";
import DialoguePanel from "./DialoguePanel";
import { lines } from "./dialogueV1";
import type { NpcId } from "./npcs";
import { unwrittenThesis } from "./quest";
import { stateToWorld } from "./stateToWorld";

const t = (holding_id: string, name: string, weight_pct: string | null) =>
  ({
    holding_id, ticker: name, name, instrument_type: "stock", sector: null, structure: "keep", value_nok: "1",
    weight_pct, size_class: "medium", moat: "wide", wall: "granite", wall_reason: "", wall_inputs: {},
    freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [],
  }) as unknown as GameTower;
const holdings = stateToWorld({
  mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null,
  towers: [t("a", "Alpha", "40"), t("b", "Beta", null)],
} as unknown as GameState).plain;
const e = (holding_id: string) => ({ holding_id, thesis: "x" }) as JournalEntry;

const quests = [
  unwrittenThesis(holdings, null, false),
  unwrittenThesis(holdings, null, true),
  unwrittenThesis([], [], false),
  unwrittenThesis(holdings, [], false),
  unwrittenThesis(holdings, [e("a")], false),
  unwrittenThesis(holdings, [e("a"), e("b")], false),
];
const people: NpcId[] = ["oracle", "partner"];

describe("courtyard dialogue v1", () => {
  it("never uses buy/sell wording or cheers, in any state", () => {
    for (const q of quests) for (const p of people) {
      const text = lines(p, q).join(" ");
      expect(text).not.toMatch(/\b(buy|sell|trim|add more|great job|well done|congrat)/i);
    }
  });

  it("names the real holdings that lack a reason, from the data, not from memory", () => {
    const open = unwrittenThesis(holdings, [e("b")], false);
    const text = lines("oracle", open).join(" ");
    expect(text).toContain("Alpha");
    expect(text).not.toContain("Beta");
    expect(text).toContain("1 of your 2");
    expect(lines("partner", open).join(" ")).toContain("Alpha, 40% of the portfolio");
  });

  it("does not invent a weight when it is unknown", () => {
    const open = unwrittenThesis(holdings, [e("a")], false);
    expect(lines("partner", open).join(" ")).toContain("Start with Beta.");
  });

  it("never claims the quest is done when the journal could not be read", () => {
    for (const p of people) {
      const text = lines(p, unwrittenThesis(holdings, null, true)).join(" ");
      expect(text).not.toMatch(/all .* have a written reason|every one has a reason/i);
    }
  });

  it("is the same words for the same state (no randomness)", () => {
    for (const q of quests) for (const p of people) expect(lines(p, q)).toEqual(lines(p, q));
  });

  it("renders as a labelled dialog with a Close button and a retry only when unreadable", () => {
    const html = renderToStaticMarkup(<DialoguePanel npc="oracle" quest={quests[1]} onClose={() => {}} onRetry={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("The Oracle");
    expect(html).toContain("Try again");
    const ok = renderToStaticMarkup(<DialoguePanel npc="partner" quest={quests[4]} onClose={() => {}} onRetry={() => {}} />);
    expect(ok).not.toContain("Try again");
    expect(ok).toContain("Close (E)");
  });
});
