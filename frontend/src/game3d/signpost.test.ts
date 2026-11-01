import { describe, expect, it } from "vitest";
import { DESK, SHELF } from "./desk";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { MARKET } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { SIGN, SIGN_LEAVE_RANGE, SIGN_RANGE, nearSign } from "./signpost";
import { STANDING_TORCHES } from "./standingTorches";
import { DRILL_POST } from "./stormDrill";
import { TOWNSFOLK } from "./townsfolk";

describe("signpost", () => {
  it("stands on the cobbles, clear of the spawn point, keep, pads, people, desk, drill post, market, props, scenery and torches", () => {
    expect(Math.hypot(SIGN.x, SIGN.z)).toBeLessThan(COBBLE_RADIUS - 1);
    expect(Math.hypot(SIGN.x - SPAWN.x, SIGN.z - SPAWN.z)).toBeGreaterThan(4);
    const inKeep = Math.abs(SIGN.x - KEEP.x) < KEEP.width / 2 + 2.5 && Math.abs(SIGN.z - KEEP.z) < KEEP.depth / 2 + 2.5;
    expect(inKeep).toBe(false);
    for (const s of towerSpots()) expect(Math.hypot(SIGN.x - s.x, SIGN.z - s.z)).toBeGreaterThan(6);
    const others = [
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...SCENERY.filter((p) => p.y === 0).map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      ...[...NPCS, ...TOWNSFOLK].map((n) => ({ id: n.id, x: n.x, z: n.z, r: 1.5 })),
      { id: "desk", ...DESK, r: 3 },
      { id: "shelf", ...SHELF, r: 3 },
      { id: "drill post", ...DRILL_POST, r: 2 },
    ];
    for (const o of others) expect(Math.hypot(SIGN.x - o.x, SIGN.z - o.z), o.id).toBeGreaterThan(o.r + 1.5 + SIGN_RANGE * 0.4);
  });

  it("is on the cobbles side of the gate road: the walk from the gate to the keep stays open", () => {
    expect(Math.abs(SIGN.x)).toBeGreaterThanOrEqual(5);
  });

  it("is reached within range and has a wider leave range", () => {
    expect(nearSign(SIGN)).toBe(true);
    expect(nearSign({ x: SIGN.x + SIGN_RANGE - 0.1, z: SIGN.z })).toBe(true);
    expect(nearSign({ x: SIGN.x + SIGN_RANGE + 0.1, z: SIGN.z })).toBe(false);
    expect(nearSign({ x: SIGN.x + SIGN_RANGE + 0.1, z: SIGN.z }, SIGN_LEAVE_RANGE)).toBe(true);
    expect(SIGN_LEAVE_RANGE).toBeGreaterThan(SIGN_RANGE);
  });
});
