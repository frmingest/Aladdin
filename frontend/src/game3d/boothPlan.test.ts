import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, SPAWN, towerSpots } from "./layout";
import { DESK } from "./desk";
import { MARKET } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { SIGN } from "./signpost";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";
import { STALL_SOLID, STREET_PLOTS } from "./streetPlan";
import { BOOTHS, BOOTH_LEAVE_RANGE, BOOTH_RANGE, BOOTH_SOLID, boothPrompt, nearestBooth } from "./boothPlan";

describe("Market Street stands", () => {
  it("are Sal and the Hype Booth, once each", () => {
    expect(BOOTHS.map((b) => b.id)).toEqual(["sal", "hype"]);
  });

  it("stand on the cobbles, clear of towers, props, people, scenery, the corner, the sign, the spawn point and every stall plot", () => {
    const things = [
      ...towerSpots().map((s, i) => ({ id: `tower-${i}`, x: s.x, z: s.z, r: 3.4 })),
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, r: 0.8 })),
      ...TOWNSFOLK.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.8 })),
      ...SCENERY.filter((s) => s.y === 0).map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.solid })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      { id: "desk", ...DESK, r: 1.2 },
      { id: "sign", ...SIGN, r: 1 },
      { id: "spawn", x: SPAWN.x, z: SPAWN.z, r: 2 },
    ];
    const half = Math.hypot(BOOTH_SOLID.hx, BOOTH_SOLID.hz);
    for (const b of BOOTHS) {
      expect(Math.hypot(b.x, b.z), `${b.id} on cobbles`).toBeLessThan(COBBLE_RADIUS + 0.6);
      for (const t of things) expect(Math.hypot(b.x - t.x, b.z - t.z), `${b.id} vs ${t.id}`).toBeGreaterThan(half + t.r + 0.8);
      STREET_PLOTS.forEach((p, i) => expect(Math.hypot(b.x - p.x, b.z - p.z), `${b.id} vs plot ${i}`).toBeGreaterThan(half + Math.hypot(STALL_SOLID.hx, STALL_SOLID.hz) + 0.5));
    }
  });

  it("are far enough from each other and from every stall that only one is ever within reach", () => {
    const [a, b] = BOOTHS;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(BOOTH_LEAVE_RANGE * 1.5);
    for (const bo of BOOTHS) for (const p of STREET_PLOTS) expect(Math.hypot(bo.x - p.x, bo.z - p.z)).toBeGreaterThan(BOOTH_RANGE + 1);
  });

  it("faces the middle of the courtyard, never red or green", () => {
    for (const b of BOOTHS) {
      expect(Number.isFinite(b.yaw)).toBe(true);
      expect(b.cloth).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("nearestBooth", () => {
  it("finds the stand you stand at, and nothing when you are away", () => {
    for (const b of BOOTHS) expect(nearestBooth({ x: b.x + 1, z: b.z })).toBe(b.id);
    expect(nearestBooth({ x: 0, z: 0 })).toBeNull();
  });

  it("lets go only past the wider leave range", () => {
    const b = BOOTHS[0];
    const at = (d: number) => ({ x: b.x + d, z: b.z });
    expect(nearestBooth(at(BOOTH_RANGE + 0.2))).toBeNull();
    expect(nearestBooth(at(BOOTH_RANGE + 0.2), BOOTHS, BOOTH_LEAVE_RANGE)).toBe(b.id);
    expect(nearestBooth(at(BOOTH_LEAVE_RANGE + 0.2), BOOTHS, BOOTH_LEAVE_RANGE)).toBeNull();
  });

  it("gives the closer stand when two are in range", () => {
    const booths = [{ id: "sal" as const, x: 0, z: 0 }, { id: "hype" as const, x: 2, z: 0 }];
    expect(nearestBooth({ x: 1.5, z: 0 }, booths)).toBe("hype");
  });
});

describe("boothPrompt", () => {
  it("says what E does, and never buy or sell", () => {
    expect(boothPrompt("sal")).toMatch(/^Press E/);
    expect(boothPrompt("hype")).toMatch(/^Press E/);
    for (const b of BOOTHS) expect(b.prompt.toLowerCase()).not.toMatch(/\b(buy|sell)\b/);
    expect(boothPrompt(null)).toBeNull();
  });
});
