import { describe, expect, it } from "vitest";
import {
  DRILL_LEAVE_RANGE,
  DRILL_POST,
  DRILL_RANGE,
  FALL_DEFAULT,
  FALL_MAX,
  FALL_MIN,
  clampFall,
  drillBlock,
  drillInput,
  drillReady,
  nearDrillPost,
  stormDrillQuest,
} from "./stormDrill";
import type { StormDrill } from "../lib/types";

const drill = (drop: string): StormDrill => ({ id: drop, market_drop: drop, plan: "Wait.", scenarios_version: "v4", created_at: "2026-11-01T10:00:00Z" });

describe("stormDrillQuest", () => {
  it("reads loading, unreadable, sample, open and done from stored facts only", () => {
    expect(stormDrillQuest(null, false).status).toBe("loading");
    expect(stormDrillQuest(null, true).status).toBe("unreadable");
    expect(stormDrillQuest({ drills: [], demo: true }, false).status).toBe("sample");
    expect(stormDrillQuest({ drills: [], demo: false }, false).status).toBe("open");
    const done = stormDrillQuest({ drills: [drill("0.2500"), drill("0.30")], demo: false }, false);
    expect(done).toEqual({ status: "done", count: 2, latestFall: 0.25 });
  });
  it("never counts a drill on the sample fortress, and a failed read wins over data", () => {
    expect(stormDrillQuest({ drills: [drill("0.3")], demo: true }, false).status).toBe("sample");
    expect(stormDrillQuest({ drills: [drill("0.3")], demo: false }, true).status).toBe("unreadable");
  });
  it("blocks saving unless the quest is open or done", () => {
    expect(drillBlock(stormDrillQuest(null, false))).toBe("loading");
    expect(drillBlock(stormDrillQuest(null, true))).toBe("unreadable");
    expect(drillBlock(stormDrillQuest({ drills: [], demo: true }, false))).toBe("sample");
    expect(drillBlock(stormDrillQuest({ drills: [], demo: false }, false))).toBeNull();
    expect(drillBlock(stormDrillQuest({ drills: [drill("0.3")], demo: false }, false))).toBeNull();
  });
});

describe("drill form", () => {
  it("needs words and a fall inside the slider", () => {
    expect(drillReady({ fall: FALL_DEFAULT, plan: "  " })).toBe(false);
    expect(drillReady({ fall: FALL_DEFAULT, plan: "Wait a week." })).toBe(true);
    expect(drillReady({ fall: 0.9, plan: "x" })).toBe(false);
  });
  it("sends the fall as a two-decimal fraction and trims the plan", () => {
    expect(drillInput({ fall: 0.3, plan: "  Hold.  " })).toEqual({ market_drop: "0.30", plan: "Hold." });
    expect(drillInput({ fall: 0.1 + 0.2, plan: "x" }).market_drop).toBe("0.30");
  });
  it("clamps and steps the fall", () => {
    expect(clampFall(0)).toBe(FALL_MIN);
    expect(clampFall(5)).toBe(FALL_MAX);
    expect(clampFall(0.32)).toBe(0.3);
    expect(clampFall(Number.NaN)).toBe(FALL_DEFAULT);
  });
});

describe("drill post", () => {
  it("is near inside the range and sticky out to the leave range", () => {
    expect(nearDrillPost(DRILL_POST)).toBe(true);
    const at = (d: number) => ({ x: DRILL_POST.x + d, z: DRILL_POST.z });
    expect(nearDrillPost(at(DRILL_RANGE + 0.5))).toBe(false);
    expect(nearDrillPost(at(DRILL_RANGE + 0.5), DRILL_LEAVE_RANGE)).toBe(true);
  });
});
