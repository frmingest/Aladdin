import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { TOWNSFOLK } from "./townsfolk";
import { DESK, DESK_LEAVE_RANGE, SHELF } from "./desk";
import { SIGN, SIGN_LEAVE_RANGE } from "./signpost";
import { DRILL_LEAVE_RANGE, DRILL_POST } from "./stormDrill";
import { BOOTHS, BOOTH_LEAVE_RANGE } from "./boothPlan";
import { GATE_LEAVE_RANGE, GATE_SPOT } from "./townPlan";
import { STREET_PLOTS, STALL_SOLID } from "./streetPlan";
import { VAULT, VAULT_LEAVE_RANGE } from "./vaultPlan";
import { PERCH, PERCH_LEAVE_RANGE, WATCH_LEAVE_RANGE, WATCH_POST } from "./watchPlan";
import { ENTER_REACH, exitSpot } from "./towerDoor";
import { SIZE_RADIUS } from "./stateToWorld";
import { REALM_BANNER, REALM_LEAVE_RANGE, REALM_RANGE, nearRealm, realmLook } from "./realmPlan";
import { REALM_LEVEL_LABEL } from "../lib/realmVerdict";

const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("Great Keep banner placement", () => {
  it("stands on the cobbles in front of the keep, clear of the keep, pads, people, props and the spawn", () => {
    const q = REALM_BANNER;
    expect(Math.hypot(q.x, q.z)).toBeLessThan(COBBLE_RADIUS - 1);
    const inKeep = Math.abs(q.x - KEEP.x) < KEEP.width / 2 + 0.5 && Math.abs(q.z - KEEP.z) < KEEP.depth / 2 + 0.5;
    expect(inKeep).toBe(false);
    for (const s of towerSpots()) expect(d(q, s)).toBeGreaterThan(3.5);
    for (const n of NPCS) expect(d(q, n)).toBeGreaterThan(3.5);
    for (const t of TOWNSFOLK) expect(d(q, t)).toBeGreaterThan(3.5);
    for (const p of PROPS) expect(d(q, p)).toBeGreaterThan(p.solid + 2);
    for (const s of SCENERY) if (s.solid > 0) expect(d(q, s), s.id).toBeGreaterThan(s.solid + 2);
    expect(d(q, SPAWN)).toBeGreaterThan(10);
  });

  it("is out of reach of every other thing you press E at, so E never means two things", () => {
    const reach = REALM_LEAVE_RANGE;
    expect(d(REALM_BANNER, DESK)).toBeGreaterThan(reach + DESK_LEAVE_RANGE - 3);
    expect(d(REALM_BANNER, SHELF)).toBeGreaterThan(reach);
    expect(d(REALM_BANNER, VAULT)).toBeGreaterThan(reach + VAULT_LEAVE_RANGE - 3);
    expect(d(REALM_BANNER, WATCH_POST)).toBeGreaterThan(reach + WATCH_LEAVE_RANGE);
    expect(d(REALM_BANNER, PERCH)).toBeGreaterThan(reach + PERCH_LEAVE_RANGE);
    expect(d(REALM_BANNER, SIGN)).toBeGreaterThan(reach + SIGN_LEAVE_RANGE);
    expect(d(REALM_BANNER, DRILL_POST)).toBeGreaterThan(reach + DRILL_LEAVE_RANGE);
    expect(d(REALM_BANNER, GATE_SPOT)).toBeGreaterThan(reach + GATE_LEAVE_RANGE);
    for (const b of BOOTHS) expect(d(REALM_BANNER, b)).toBeGreaterThan(reach + BOOTH_LEAVE_RANGE);
    for (const p of STREET_PLOTS) expect(d(REALM_BANNER, p)).toBeGreaterThan(reach + STALL_SOLID.hx);
    for (const npc of NPCS) expect(d(REALM_BANNER, npc)).toBeGreaterThan(reach + 4);
  });

  it("is out of reach of every tower door", () => {
    const widest = Math.max(...Object.values(SIZE_RADIUS));
    for (const s of towerSpots()) expect(d(REALM_BANNER, s), `pad ${s.x},${s.z}`).toBeGreaterThan(REALM_RANGE + widest + ENTER_REACH);
  });

  it("is never where a hero stepping out of a tower is put down", () => {
    for (const s of towerSpots())
      for (const r of Object.values(SIZE_RADIUS)) expect(d(exitSpot(s, r), REALM_BANNER)).toBeGreaterThanOrEqual(2.4);
  });

  it("arrives at a shorter range than it leaves", () => {
    expect(REALM_LEAVE_RANGE).toBeGreaterThan(REALM_RANGE);
    expect(nearRealm({ x: REALM_BANNER.x + 2, z: REALM_BANNER.z })).toBe(true);
    expect(nearRealm({ x: REALM_BANNER.x + 4.5, z: REALM_BANNER.z })).toBe(false);
    expect(nearRealm({ x: REALM_BANNER.x + 4.5, z: REALM_BANNER.z }, REALM_LEAVE_RANGE)).toBe(true);
  });
});

describe("banner look", () => {
  it("prints the flat card's own word for each level, with a mark so colour is never the only signal", () => {
    for (const lv of ["sound", "mixed", "attention", "unknown"] as const) {
      const l = realmLook(lv);
      expect(l.word).toBe(REALM_LEVEL_LABEL[lv]);
      expect(l.mark).not.toBe("");
    }
    expect(realmLook("attention").mark).toBe("■");
  });

  it("never flies a good-looking flag for a verdict that could not be read", () => {
    for (const lv of [null, undefined]) {
      const l = realmLook(lv);
      expect(l.mark).toBe("?");
      expect(l.word).not.toBe(REALM_LEVEL_LABEL.sound);
    }
  });

  it("uses no red and no green cloth", () => {
    for (const lv of ["sound", "mixed", "attention", "unknown"] as const) {
      const hex = realmLook(lv).cloth;
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(r > g + 24 && r > b + 24).toBe(false);
      expect(g > r + 24 && g > b + 24).toBe(false);
    }
  });
});
