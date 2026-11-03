import { describe, expect, it } from "vitest";
import { SURVEY_CHECKS } from "../lib/survey";
import type { TowerFog } from "../lib/survey";
import {
  GATE_STONE,
  LAND_SPOT_NAMES,
  LAND_GATE,
  LAND_RADIUS,
  LAND_SPAWN,
  LAND_SPOTS,
  LANTERN_SPOTS,
  MIN_LAND_RADIUS,
  PRICE_POST,
  RECORDS_HOUSE,
  WORKPLACE,
  gateStoneFor,
  insideLand,
  landRadius,
  lanternSummary,
  lanternsFor,
  moatLook,
  pricePostFor,
  workplaceCondition,
} from "./holdingLand";

const fog = (states: Array<"clear" | "fog" | "not_judged">): TowerFog => ({
  holdingId: "h1",
  name: "X",
  ticker: "X",
  weightPct: 10,
  checks: SURVEY_CHECKS.map((c, i) => ({ id: c.id, label: c.label, state: states[i], reason: `r${i}` })),
  clear: states.filter((s) => s === "clear").length,
  judged: states.filter((s) => s !== "not_judged").length,
});

describe("land size", () => {
  it("has four fixed sizes, in order, and unknown never flatters", () => {
    expect(LAND_RADIUS.great).toBeGreaterThan(LAND_RADIUS.medium);
    expect(LAND_RADIUS.medium).toBeGreaterThan(LAND_RADIUS.small);
    expect(LAND_RADIUS.small).toBeGreaterThan(LAND_RADIUS.tiny);
    expect(landRadius("unknown")).toBeLessThanOrEqual(LAND_RADIUS.small);
  });
});

describe("the five spots", () => {
  it("all sit on the smallest land, so no size can push one off the ground", () => {
    const spots = [LAND_SPAWN, GATE_STONE, LAND_GATE, WORKPLACE, PRICE_POST, RECORDS_HOUSE, ...LANTERN_SPOTS];
    for (const s of spots) expect(insideLand(s, MIN_LAND_RADIUS)).toBe(true);
    expect(Object.keys(LAND_SPOTS)).toEqual([...LAND_SPOT_NAMES]);
  });

  it("keeps the lanterns in survey order and apart from each other", () => {
    expect(LANTERN_SPOTS.map((l) => l.check)).toEqual(SURVEY_CHECKS.map((c) => c.id));
    for (let i = 0; i < LANTERN_SPOTS.length; i++)
      for (let j = i + 1; j < LANTERN_SPOTS.length; j++)
        expect(Math.hypot(LANTERN_SPOTS[i].x - LANTERN_SPOTS[j].x, LANTERN_SPOTS[i].z - LANTERN_SPOTS[j].z)).toBeGreaterThan(2.5);
  });

  it("does not let the workplace overlap the records house", () => {
    const gap = Math.hypot(WORKPLACE.x - RECORDS_HOUSE.x, WORKPLACE.z - RECORDS_HOUSE.z);
    expect(gap).toBeGreaterThan(WORKPLACE.r + RECORDS_HOUSE.hx);
  });
});

describe("survey lanterns (fog of war)", () => {
  it("maps clear, fog and not judged to lit, mist and bare", () => {
    const l = lanternsFor(fog(["clear", "fog", "not_judged", "clear"]));
    expect(l.map((x) => x.look)).toEqual(["lit", "mist", "bare", "lit"]);
    expect(l[1].reason).toBe("r1");
    expect(lanternSummary(l)).toBe("2 of 3 lanterns lit");
  });

  it("shows four hooded lanterns when nothing was surveyed, never lit ones", () => {
    const l = lanternsFor(null);
    expect(l.every((x) => x.look === "mist")).toBe(true);
  });

  it("says not surveyed when nothing is judged", () => {
    expect(lanternSummary(lanternsFor(fog(["not_judged", "not_judged", "not_judged", "not_judged"])))).toBe("Not surveyed yet");
  });
});

describe("workplace and moat", () => {
  it("follows the wall tier only, and an unknown wall is never healthy", () => {
    expect(workplaceCondition("basalt", false)).toBe("sound");
    expect(workplaceCondition("brick", false)).toBe("worn");
    expect(workplaceCondition("rotted", false)).toBe("cracked");
    expect(workplaceCondition("unsurveyed", false)).toBe("unknown");
    expect(workplaceCondition("basalt", true)).toBe("unknown");
    expect(workplaceCondition(null, false)).toBe("unknown");
  });

  it("draws mist for a moat that was not surveyed", () => {
    expect(moatLook("wide")).toBe("wide");
    expect(moatLook("none")).toBe("none");
    expect(moatLook("unsurveyed")).toBe("mist");
    expect(moatLook("not_applicable")).toBe("mist");
    expect(moatLook(null)).toBe("mist");
  });
});

describe("gate stone", () => {
  it("prints name, weight and value, and keeps unknowns unknown", () => {
    const g = gateStoneFor({ name: "Equinor", weight_pct: "12.44", value_nok: "84200" }, true);
    expect(g).toEqual({ title: "Equinor", weight: "12.4% of the realm", value: "NOK 84 200", note: null });
    const u = gateStoneFor({ name: "Equinor", weight_pct: null, value_nok: null }, false);
    expect(u.weight).toBe("Weight not known");
    expect(u.value).toBe("Value not known");
    expect(u.note).toBe("Not surveyed yet");
  });
});

describe("price post", () => {
  it("maps thesis and siege exposure, with fog for anything unread", () => {
    const p = pricePostFor({ land: "discount", land_reason: "why", thesis: "review", siege_exposure: "breach_risk" });
    expect(p).toEqual({ gauge: "discount", scroll: "cracked", banner: "breach_risk", gaugeReason: "why" });
    const f = pricePostFor({ land: "fog", land_reason: "none", thesis: "not_analyzed", siege_exposure: "unsurveyed" });
    expect(f.scroll).toBe("fog");
    expect(f.banner).toBe("fog");
  });
});
