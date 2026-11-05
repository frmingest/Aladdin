import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { standingAt, NO_NEARS } from "./near";
import { FIELD_BANNERS, FIELD_EXIT, FIELD_HALF, FIELD_ROCKS, ATTACKERS, ENGINES, FIELD_TENT } from "./siegeField";
import {
  BANNER_FOR,
  DEFAULT_TOOLS,
  FIELD_SPOTS,
  applySpot,
  fieldSpotAt,
  spotPrompt,
  stonePlate,
  winchPosition,
  winchTurn,
  yardstickName,
} from "./siegeFieldTools";
import type { FieldTools } from "./siegeFieldTools";
import { FIELD_TOOLS_WORDS } from "./siegeFieldToolsWordsV1";
import { FALL_DEFAULT, FALL_MAX, FALL_MIN } from "./stormDrill";
import { yardView } from "./siegeYard";
import type { SiegeSim } from "../lib/types";

const tools = (over: Partial<FieldTools> = {}): FieldTools => ({ ...DEFAULT_TOOLS("local"), toStorm: 0.15, toSiege: 0.34, ...over });

describe("the winch", () => {
  it("starts at the drill's own default fall", () => {
    expect(DEFAULT_TOOLS("local").fall).toBe(FALL_DEFAULT);
  });
  it("turns up one step at a time and rounds to the bottom after the top", () => {
    expect(winchTurn(0.3, FALL_MIN, FALL_MAX)).toBe(0.35);
    expect(winchTurn(0.55, FALL_MIN, FALL_MAX)).toBe(0.6);
    expect(winchTurn(0.6, FALL_MIN, FALL_MAX)).toBe(FALL_MIN);
  });
  it("walks the whole range and comes back to where it began", () => {
    let f: number = FALL_MIN;
    const seen = new Set<number>();
    for (let i = 0; i < 40 && !seen.has(f); i++) {
      seen.add(f);
      f = winchTurn(f, FALL_MIN, FALL_MAX);
    }
    expect(f).toBe(FALL_MIN);
    expect(seen.size).toBe(12);
  });
  it("the weight mirrors the fall, from 0 to 1", () => {
    expect(winchPosition(FALL_MIN, FALL_MIN, FALL_MAX)).toBe(0);
    expect(winchPosition(FALL_MAX, FALL_MIN, FALL_MAX)).toBe(1);
    expect(winchPosition(0.3, FALL_MIN, FALL_MAX)).toBeGreaterThan(0);
    expect(winchPosition(0.3, FALL_MIN, FALL_MAX)).toBeLessThan(1);
    expect(winchPosition(5, FALL_MIN, FALL_MAX)).toBe(1);
    expect(winchPosition(0.3, 0.3, 0.3)).toBe(0);
  });
});

describe("the marker stones", () => {
  it("E at a stone sets the fall to the flat page's own preset", () => {
    expect(applySpot("storm", tools())?.fall).toBe(0.15);
    expect(applySpot("siege", tools())?.fall).toBe(0.34);
  });
  it("a line the range never reaches does nothing, says so, and offers no prompt", () => {
    const t = tools({ toSiege: null });
    expect(applySpot("siege", t)).toBeNull();
    expect(spotPrompt("siege", t)).toBeNull();
    expect(stonePlate("siege", t)).toBe(FIELD_TOOLS_WORDS.stoneNever("Siege line"));
  });
  it("before the answer is read the stones do nothing (unknown stays unknown)", () => {
    const t = tools({ toStorm: null, toSiege: null });
    expect(applySpot("storm", t)).toBeNull();
    expect(applySpot("siege", t)).toBeNull();
  });
  it("a stone you are already at does nothing and offers no prompt", () => {
    const t = tools({ fall: 0.15 });
    expect(applySpot("storm", t)).toBeNull();
    expect(spotPrompt("storm", t)).toBeNull();
  });
  it("the plate and the prompt print the preset as a percentage", () => {
    expect(stonePlate("storm", tools())).toBe("Storm line 15%");
    expect(spotPrompt("siege", tools())).toBe("Press E to set the fall to 34% (Siege line)");
  });
});

describe("the yardstick banners", () => {
  it("E swaps the yardstick, and only when it is not already in use", () => {
    expect(applySpot("global", tools())?.benchmark).toBe("global");
    expect(applySpot("local", tools())).toBeNull();
    expect(applySpot("local", tools({ benchmark: "global" }))?.benchmark).toBe("local");
  });
  it("uses the flat page's own short names", () => {
    expect(yardstickName("local")).toBe("Oslo");
    expect(yardstickName("global")).toBe("World");
    expect(spotPrompt("global", tools())).toBe("Press E to measure against World");
  });
  it("each yardstick flies on the banner that stands at its post", () => {
    for (const key of ["local", "global"] as const) {
      const banner = FIELD_BANNERS.find((b) => b.id === BANNER_FOR[key]);
      const spot = FIELD_SPOTS.find((s) => s.id === key);
      expect(banner).toBeTruthy();
      expect(spot?.x).toBe(banner?.x);
    }
  });
  it("changing the yardstick or the fall keeps everything else", () => {
    const t = tools({ fall: 0.2 });
    const next = applySpot("global", t);
    expect(next).toMatchObject({ fall: 0.2, toStorm: 0.15, toSiege: 0.34, min: t.min, max: t.max });
  });
});

describe("where the tools stand", () => {
  it("there is a fixed set of five", () => {
    expect(FIELD_SPOTS.map((s) => s.id).sort()).toEqual(["global", "local", "siege", "storm", "winch"]);
  });
  it("each tool is picked when you stand at it, and not from across the field", () => {
    for (const s of FIELD_SPOTS) {
      expect(fieldSpotAt({ x: s.x, z: s.z }, null)).toBe(s.id);
      expect(fieldSpotAt({ x: s.x + s.range + 0.5, z: s.z }, null)).not.toBe(s.id);
    }
  });
  it("keeps the tool a little past its reach, then lets go (no flicker)", () => {
    const s = FIELD_SPOTS[0];
    const between = { x: s.x + (s.range + s.leaveRange) / 2, z: s.z };
    expect(fieldSpotAt(between, null)).toBeNull();
    expect(fieldSpotAt(between, s.id)).toBe(s.id);
    expect(fieldSpotAt({ x: s.x + s.leaveRange + 0.3, z: s.z }, s.id)).toBeNull();
  });
  it("no two tools overlap, so one E means one thing", () => {
    for (const a of FIELD_SPOTS)
      for (const b of FIELD_SPOTS) {
        if (a.id === b.id) continue;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.leaveRange + b.leaveRange);
      }
  });
  it("the road back is clear of every tool, and the arrival spot too", () => {
    for (const s of FIELD_SPOTS) {
      expect(Math.hypot(s.x - FIELD_EXIT.x, s.z - FIELD_EXIT.z)).toBeGreaterThan(s.leaveRange + 6.5);
    }
  });
  it("every tool stands on the field, off the engines, skeletons, tent and rocks", () => {
    for (const s of FIELD_SPOTS) {
      expect(Math.abs(s.x)).toBeLessThan(FIELD_HALF - 2);
      expect(Math.abs(s.z)).toBeLessThan(FIELD_HALF - 2);
      for (const e of ENGINES) expect(Math.hypot(s.x - e.x, s.z - e.z)).toBeGreaterThan(e.solid + 2);
      for (const a of ATTACKERS) expect(Math.hypot(s.x - a.x, s.z - a.z)).toBeGreaterThan(2);
      expect(Math.hypot(s.x - FIELD_TENT.x, s.z - FIELD_TENT.z)).toBeGreaterThan(FIELD_TENT.solid + 2);
      for (const r of FIELD_ROCKS) expect(Math.hypot(s.x - r.x, s.z - r.z)).toBeGreaterThan(4);
    }
  });
  it("a tool beats the road back; with none in reach the road back still works", () => {
    expect(standingAt({ id: "siege" }, { ...NO_NEARS, fieldSpot: "storm", fieldExit: true })).toEqual({ kind: "fieldSpot", id: "storm" });
    expect(standingAt({ id: "siege" }, { ...NO_NEARS, fieldExit: true })).toEqual({ kind: "leave" });
    expect(standingAt({ id: "siege" }, NO_NEARS)).toEqual({ kind: "none" });
  });
  it("tools are only offered inside the field", () => {
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, fieldSpot: "winch" })).toEqual({ kind: "none" });
  });
});

describe("the stones read the backend's own answer", () => {
  const sim = (over: Partial<SiegeSim>): SiegeSim =>
    ({
      market_drop: "0.30",
      level: "calm",
      portfolio_shock_pct: null,
      portfolio_loss_nok: null,
      weighted_beta: null,
      coverage: null,
      holdings: [],
      drop_to_gathering: "0.1432",
      drop_to_besieged: null,
      drop_min: "0.05",
      drop_max: "0.60",
      drop_step: "0.05",
      ...over,
    }) as unknown as SiegeSim;
  it("rounds a preset up to a whole percent, exactly as the flat page does", () => {
    const v = yardView(sim({}));
    expect(v.toStorm).toBe(0.15);
  });
  it("a line that is never reached stays null", () => {
    expect(yardView(sim({})).toSiege).toBeNull();
  });
  it("a line outside the slider's range stays null", () => {
    expect(yardView(sim({ drop_to_gathering: "0.9" })).toStorm).toBeNull();
  });
  it("carries the backend's range", () => {
    const v = yardView(sim({ drop_min: "0.10", drop_max: "0.50" }));
    expect([v.dropMin, v.dropMax]).toEqual([0.1, 0.5]);
  });
});

describe("the tools never carry a fact", () => {
  it("the module imports no holding, theme, wall, moat or verdict", () => {
    const src = readFileSync(new URL("./siegeFieldTools.ts", import.meta.url), "utf8");
    const paths = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(paths.join("\n")).not.toMatch(/holding|theme|wall|moat|verdict|standing|survey/i);
  });
  it("the words carry no red or green and no buy or sell", () => {
    const text = JSON.stringify([FIELD_TOOLS_WORDS.winchPlate("30%"), FIELD_TOOLS_WORDS.stonePrompt("Storm line", "15%"), FIELD_TOOLS_WORDS.bannerPrompt("World"), FIELD_TOOLS_WORDS.stoneNever("Siege line")]);
    expect(text).not.toMatch(/\b(red|green|buy|sell)\b/i);
  });
});
