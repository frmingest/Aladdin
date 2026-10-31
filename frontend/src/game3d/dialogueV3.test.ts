import { describe, expect, it } from "vitest";
import { DESK_NUDGE, pointsToDesk, talk } from "./dialogueV3";
import { talk as talkV2 } from "./dialogueV2";
import type { GameState, GameTower } from "../lib/types";
import type { QuestState, ReviewQuestState } from "./quest";
import { stateToWorld } from "./stateToWorld";

const t = {
  holding_id: "a", ticker: "AAA", name: "Alpha", instrument_type: "stock", sector: null, structure: "keep",
  value_nok: "1000", weight_pct: "40", size_class: "medium", moat: "wide", wall: "granite", wall_reason: "",
  wall_inputs: {}, freshness: "fresh", analysis_age_days: 1, verdict_rating: null, land: "fog", land_reason: "",
  margin_of_safety_pct: null, thesis: "intact", tripwires_fired: 0, siege_exposure: "unsurveyed",
  siege_shock_pct: null, siege_method: null, shared_wall_with: [],
} as unknown as GameTower;
const missing = stateToWorld({ mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null, towers: [t] } as unknown as GameState).plain;
const q = (status: QuestState["status"]): QuestState => ({ status, total: 3, written: 1, missing: status === "open" ? missing : [] });
const r: ReviewQuestState = { status: "clear", entries: 0, due: [] };

describe("dialogue v3", () => {
  it("points the Oracle to the desk while something is unwritten, in 15 words or fewer", () => {
    expect(pointsToDesk("oracle", q("open"))).toBe(true);
    expect(talk("oracle", q("open"), r)).toEqual([...talkV2("oracle", q("open"), r), ...DESK_NUDGE]);
    expect(DESK_NUDGE.join(" ").split(/\s+/).length).toBeLessThanOrEqual(15);
  });

  it("changes nothing for the Partner, nor when nothing is open", () => {
    expect(pointsToDesk("partner", q("open"))).toBe(false);
    for (const s of ["loading", "unreadable", "empty", "done"] as const) {
      expect(talk("oracle", q(s), r)).toEqual(talkV2("oracle", q(s), r));
    }
    expect(talk("partner", q("open"), r)).toEqual(talkV2("partner", q("open"), r));
  });
});
