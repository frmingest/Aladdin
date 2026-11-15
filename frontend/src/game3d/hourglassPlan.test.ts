import { describe, expect, it } from "vitest";
import { DESK, SHELF } from "./desk";
import { MARKET } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";
import { towerSpots } from "./layout";
import { WATCH_POST, PERCH } from "./watchPlan";
import { SIGN } from "./signpost";
import { VAULT } from "./vaultPlan";
import { REALM_POST } from "./realmPlan";
import { DRILL_POST } from "./stormDrill";
import { SIEGE_GATE } from "./siegeField";
import {
  HOURGLASS,
  HOURGLASS_LEAVE_RANGE,
  HOURGLASS_RANGE,
  HOURGLASS_SOLID,
  buildTimeline,
  dayLabel,
  openInThePast,
  playNext,
  stepDay,
  todayUtc,
} from "./hourglassPlan";

describe("the hourglass stand", () => {
  it("stands clear of everything else in the courtyard", () => {
    const things = [
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, r: 0.5 })),
      ...TOWNSFOLK.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.5 })),
      ...SCENERY.filter((s) => s.y === 0).map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.solid })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      ...towerSpots().map((s, i) => ({ id: `pad-${i}`, x: s.x, z: s.z, r: 4 })),
      { id: "desk", ...DESK, r: 1.2 },
      { id: "shelf", ...SHELF, r: 1.1 },
      { id: "watch", ...WATCH_POST, r: 0.5 },
      { id: "perch", ...PERCH, r: 0.5 },
      { id: "sign", ...SIGN, r: 0.5 },
      { id: "vault", ...VAULT, r: 1 },
      { id: "realm", ...REALM_POST, r: 0.5 },
      { id: "drill", ...DRILL_POST, r: 1 },
    ];
    for (const t of things) {
      expect(Math.hypot(t.x - HOURGLASS.x, t.z - HOURGLASS.z), t.id).toBeGreaterThan(HOURGLASS_SOLID + t.r + 1.2);
    }
  });

  it("is reached from further out than the stand it walks round, and left from further still", () => {
    expect(HOURGLASS_RANGE).toBeGreaterThan(HOURGLASS_SOLID);
    expect(HOURGLASS_LEAVE_RANGE).toBeGreaterThanOrEqual(HOURGLASS_RANGE);
  });

  it("does not crowd another spot you can stand at (so its prompt stays the only answer)", () => {
    const others = [SIEGE_GATE, WATCH_POST, SIGN, PERCH, REALM_POST, VAULT, DESK, DRILL_POST, ...NPCS];
    for (const o of others) expect(Math.hypot(o.x - HOURGLASS.x, o.z - HOURGLASS.z)).toBeGreaterThan(HOURGLASS_LEAVE_RANGE + 1);
  });
});

describe("the timeline", () => {
  const today = "2026-11-15";

  it("is empty when nothing before today was stored (today is the live fortress, not the past)", () => {
    expect(buildTimeline([], today)).toEqual([]);
    expect(buildTimeline(["2026-11-15"], today)).toEqual([]);
  });

  it("marks a day with no frame as a gap and does not fill it in", () => {
    expect(buildTimeline(["2026-11-11", "2026-11-13"], today).slice(0, 3)).toEqual([
      { day: "2026-11-11", stored: true },
      { day: "2026-11-12", stored: false },
      { day: "2026-11-13", stored: true },
    ]);
  });

  it("runs on to the day before today, and the days after the last stored one are gaps too", () => {
    const t = buildTimeline(["2026-11-12"], today);
    expect(t[t.length - 1]).toEqual({ day: "2026-11-14", stored: false });
    expect(t.map((d) => d.day)).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
  });

  it("crosses a month and year end", () => {
    const t = buildTimeline(["2025-12-30"], "2026-01-02");
    expect(t.map((d) => d.day)).toEqual(["2025-12-30", "2025-12-31", "2026-01-01"]);
  });

  it("is built from unsorted input", () => {
    expect(buildTimeline(["2026-11-13", "2026-11-11"], today)[0].day).toBe("2026-11-11");
  });
});

describe("stepping", () => {
  const t = buildTimeline(["2026-11-11", "2026-11-13"], "2026-11-15");
  it("goes earlier from today to the newest day, and later from the newest day back to today", () => {
    expect(stepDay(t, null, -1)).toBe("2026-11-14");
    expect(stepDay(t, "2026-11-14", 1)).toBeNull();
    expect(stepDay(t, null, 1)).toBeNull();
  });
  it("steps one calendar day, gaps included, and stops at the oldest", () => {
    expect(stepDay(t, "2026-11-13", -1)).toBe("2026-11-12");
    expect(stepDay(t, "2026-11-12", -1)).toBe("2026-11-11");
    expect(stepDay(t, "2026-11-11", -1)).toBe("2026-11-11");
  });
  it("has nowhere to go with an empty timeline", () => {
    expect(stepDay([], null, -1)).toBeNull();
  });
  it("replays forward from the oldest day and stops at the newest instead of looping or leaving the past", () => {
    expect(playNext(t, null)).toBe("2026-11-11");
    expect(playNext(t, "2026-11-11")).toBe("2026-11-12");
    expect(playNext(t, "2026-11-14")).toBeNull();
  });
});

describe("dates and what stays open", () => {
  it("writes the date with its weekday, in UTC", () => {
    expect(dayLabel("2026-11-03")).toBe("Tue 3 Nov 2026");
  });
  it("reads today as a UTC day", () => {
    expect(todayUtc(new Date("2026-11-15T23:30:00Z"))).toBe("2026-11-15");
  });
  it("leaves open only places that read", () => {
    expect(openInThePast("hourglass")).toBe(true);
    expect(openInThePast("realm")).toBe(true);
    for (const k of ["desk", "drill", "vault", "booth", "tower", "building", "sign", "npc", "watch", "perch"]) expect(openInThePast(k)).toBe(false);
  });
});
