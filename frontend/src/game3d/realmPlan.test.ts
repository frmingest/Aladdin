import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, RESERVED_ZONES, SPAWN, towerSpots } from "./layout";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { TOWNSFOLK } from "./townsfolk";
import { DESK, DESK_LEAVE_RANGE, SHELF } from "./desk";
import { SIGN, SIGN_LEAVE_RANGE } from "./signpost";
import { DRILL_LEAVE_RANGE, DRILL_POST } from "./stormDrill";
import { BOOTHS, BOOTH_LEAVE_RANGE } from "./boothPlan";
import { GATE_LEAVE_RANGE, GATE_SPOT } from "./townPlan";
import { VAULT, VAULT_LEAVE_RANGE } from "./vaultPlan";
import { PERCH, PERCH_LEAVE_RANGE, WATCH_LEAVE_RANGE, WATCH_POST } from "./watchPlan";
import { ENTER_REACH, exitSpot } from "./towerDoor";
import { SIZE_RADIUS } from "./stateToWorld";
import { REALM_LEAVE_RANGE, REALM_POST, REALM_RANGE, nearRealm, pennantLook } from "./realmPlan";
import { REALM_PLATE } from "./realmWordsV1";
import type { RealmLevel } from "../lib/realmVerdict";

const LEVELS: RealmLevel[] = ["attention", "mixed", "sound", "unknown"];

describe("realm post placement", () => {
  it("stands on the cobbles in front of the keep, clear of the keep, every pad, people, props, scenery and the spawn", () => {
    expect(Math.hypot(REALM_POST.x, REALM_POST.z)).toBeLessThan(COBBLE_RADIUS - 1);
    const inKeep = Math.abs(REALM_POST.x - KEEP.x) < KEEP.width / 2 + 0.5 && Math.abs(REALM_POST.z - KEEP.z) < KEEP.depth / 2 + 0.5;
    expect(inKeep).toBe(false);
    for (const s of towerSpots()) expect(Math.hypot(REALM_POST.x - s.x, REALM_POST.z - s.z)).toBeGreaterThan(3.5);
    for (const n of NPCS) expect(Math.hypot(REALM_POST.x - n.x, REALM_POST.z - n.z)).toBeGreaterThan(3.5);
    for (const t of TOWNSFOLK) expect(Math.hypot(REALM_POST.x - t.x, REALM_POST.z - t.z)).toBeGreaterThan(3.5);
    for (const p of PROPS) expect(Math.hypot(REALM_POST.x - p.x, REALM_POST.z - p.z), p.id).toBeGreaterThan(p.solid + 2);
    for (const s of SCENERY) if (s.solid > 0) expect(Math.hypot(REALM_POST.x - s.x, REALM_POST.z - s.z), s.id).toBeGreaterThan(s.solid + 2);
    expect(Math.hypot(REALM_POST.x - SPAWN.x, REALM_POST.z - SPAWN.z)).toBeGreaterThan(10);
    for (const z of RESERVED_ZONES) expect(Math.hypot(REALM_POST.x - z.x, REALM_POST.z - z.z), z.id).toBeGreaterThan(z.radius + 2);
  });

  it("is out of reach of every other thing E opens, so E never means two things", () => {
    const others = [
      { id: "desk", ...DESK, leave: DESK_LEAVE_RANGE },
      { id: "shelf", ...SHELF, leave: 0 },
      { id: "vault", ...VAULT, leave: VAULT_LEAVE_RANGE },
      { id: "watch", ...WATCH_POST, leave: WATCH_LEAVE_RANGE },
      { id: "perch", ...PERCH, leave: PERCH_LEAVE_RANGE },
      { id: "sign", ...SIGN, leave: SIGN_LEAVE_RANGE },
      { id: "drill", ...DRILL_POST, leave: DRILL_LEAVE_RANGE },
      { id: "gate", ...GATE_SPOT, leave: GATE_LEAVE_RANGE },
      ...BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, leave: BOOTH_LEAVE_RANGE })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, leave: 5 })),
    ];
    for (const o of others) expect(Math.hypot(REALM_POST.x - o.x, REALM_POST.z - o.z), o.id).toBeGreaterThan(REALM_LEAVE_RANGE + o.leave);
  });

  it("is out of reach of every tower door, so standing at the post never offers a library instead", () => {
    const widest = Math.max(...Object.values(SIZE_RADIUS));
    for (const s of towerSpots()) {
      expect(Math.hypot(REALM_POST.x - s.x, REALM_POST.z - s.z), `pad ${s.x},${s.z}`).toBeGreaterThan(REALM_RANGE + widest + ENTER_REACH);
    }
  });

  it("is never where a hero stepping out of a tower is put down", () => {
    for (const s of towerSpots())
      for (const r of Object.values(SIZE_RADIUS)) {
        const out = exitSpot(s, r);
        expect(Math.hypot(out.x - REALM_POST.x, out.z - REALM_POST.z), `exit of ${s.x},${s.z}`).toBeGreaterThanOrEqual(2.4);
      }
  });

  it("is reached from inside the range and not from outside it", () => {
    expect(nearRealm({ x: REALM_POST.x, z: REALM_POST.z + REALM_RANGE - 0.1 })).toBe(true);
    expect(nearRealm({ x: REALM_POST.x, z: REALM_POST.z + REALM_RANGE + 0.1 })).toBe(false);
    expect(REALM_LEAVE_RANGE).toBeGreaterThan(REALM_RANGE);
  });
});

describe("realm pennant", () => {
  it("has a different shape and a different word for every level, so colour is never the only signal", () => {
    expect(new Set(LEVELS.map((l) => pennantLook(l).shape)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((l) => REALM_PLATE[l])).size).toBe(LEVELS.length);
  });

  it("shows a level that could not be read as unknown, never as sound", () => {
    expect(pennantLook(null).level).toBe("unknown");
    expect(pennantLook(undefined).shape).toBe(pennantLook("unknown").shape);
    expect(pennantLook(null).shape).not.toBe(pennantLook("sound").shape);
  });

  it("uses no red or green, and never says buy or sell", () => {
    for (const l of LEVELS) {
      const hex = pennantLook(l).color.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(g > r + 30 && g > b + 30, `${l} is green`).toBe(false);
      expect(r > g + 60 && r > b + 60, `${l} is red`).toBe(false);
      expect(REALM_PLATE[l]).not.toMatch(/\b(buy|sell|add|trim)\b/i);
    }
  });
});
