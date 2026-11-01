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
import { RESERVED_ZONES } from "./layout";
import { GATE_LEAVE_RANGE, GATE_SPOT } from "./townPlan";
import { ENTER_REACH, exitSpot } from "./towerDoor";
import { SIZE_RADIUS } from "./stateToWorld";
import { MAX_STACKS, VAULT, VAULT_LEAVE_RANGE, VAULT_RANGE, VAULT_SOLID, coinStacks, nearVault, stackSlots, vaultUnknown } from "./vaultPlan";
import type { FortressVaultLevel } from "../lib/types";

const LEVELS: FortressVaultLevel[] = ["deep", "stocked", "thin", "empty", "unsurveyed"];

describe("vault chest placement", () => {
  it("stands on the cobbles beside the keep door, clear of the keep, every pad, people, props, scenery and the spawn", () => {
    expect(Math.hypot(VAULT.x, VAULT.z)).toBeLessThan(COBBLE_RADIUS - 1);
    const inKeep = Math.abs(VAULT.x - KEEP.x) < KEEP.width / 2 + 0.5 && Math.abs(VAULT.z - KEEP.z) < KEEP.depth / 2 + 0.5;
    expect(inKeep).toBe(false);
    for (const s of towerSpots()) expect(Math.hypot(VAULT.x - s.x, VAULT.z - s.z)).toBeGreaterThan(3.5);
    for (const n of NPCS) expect(Math.hypot(VAULT.x - n.x, VAULT.z - n.z)).toBeGreaterThan(3.5);
    for (const t of TOWNSFOLK) expect(Math.hypot(VAULT.x - t.x, VAULT.z - t.z)).toBeGreaterThan(3.5);
    for (const p of PROPS) expect(Math.hypot(VAULT.x - p.x, VAULT.z - p.z)).toBeGreaterThan(p.solid + 2);
    for (const s of SCENERY) if (s.solid > 0) expect(Math.hypot(VAULT.x - s.x, VAULT.z - s.z), s.id).toBeGreaterThan(s.solid + 2);
    expect(Math.hypot(VAULT.x - SPAWN.x, VAULT.z - SPAWN.z)).toBeGreaterThan(10);
    for (const z of RESERVED_ZONES) expect(Math.hypot(VAULT.x - z.x, VAULT.z - z.z), z.id).toBeGreaterThan(z.radius + 2);
  });

  it("is out of reach of every other thing E opens, so E never means two things", () => {
    const others = [
      { id: "desk", ...DESK, leave: DESK_LEAVE_RANGE },
      { id: "shelf", ...SHELF, leave: 0 },
      { id: "sign", ...SIGN, leave: SIGN_LEAVE_RANGE },
      { id: "drill", ...DRILL_POST, leave: DRILL_LEAVE_RANGE },
      { id: "gate", ...GATE_SPOT, leave: GATE_LEAVE_RANGE },
      ...BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, leave: BOOTH_LEAVE_RANGE })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, leave: 5 })),
    ];
    for (const o of others) expect(Math.hypot(VAULT.x - o.x, VAULT.z - o.z), o.id).toBeGreaterThan(VAULT_LEAVE_RANGE + o.leave);
  });

  it("is out of reach of every tower door, so standing at the chest never offers a library instead", () => {
    const widest = Math.max(...Object.values(SIZE_RADIUS));
    for (const s of towerSpots()) {
      expect(Math.hypot(VAULT.x - s.x, VAULT.z - s.z), `pad ${s.x},${s.z}`).toBeGreaterThan(VAULT_RANGE + widest + ENTER_REACH);
    }
  });

  it("is never where a hero stepping out of a tower is put down", () => {
    for (const s of towerSpots())
      for (const r of Object.values(SIZE_RADIUS)) {
        const out = exitSpot(s, r);
        expect(Math.hypot(out.x - VAULT.x, out.z - VAULT.z), `exit of ${s.x},${s.z}`).toBeGreaterThanOrEqual(2.4);
      }
  });

  it("arrives at a shorter range than it leaves, so the edge does not flicker", () => {
    expect(VAULT_LEAVE_RANGE).toBeGreaterThan(VAULT_RANGE);
    expect(nearVault({ x: VAULT.x + 2, z: VAULT.z })).toBe(true);
    expect(nearVault({ x: VAULT.x + 4, z: VAULT.z })).toBe(false);
    expect(nearVault({ x: VAULT.x + 4, z: VAULT.z }, VAULT_LEAVE_RANGE)).toBe(true);
    expect(VAULT_SOLID.hx).toBeLessThan(VAULT_RANGE);
  });
});

describe("coin stacks on the lid", () => {
  it("grow with the level the backend decided and never pass the lid", () => {
    expect(LEVELS.map(coinStacks)).toEqual([MAX_STACKS, 4, 2, 0, 0]);
    for (const l of LEVELS) expect(coinStacks(l)).toBeLessThanOrEqual(MAX_STACKS);
  });

  it("show nothing for a level that cannot be read", () => {
    expect(coinStacks(null)).toBe(0);
    expect(coinStacks(undefined)).toBe(0);
    expect(coinStacks("surprise" as FortressVaultLevel)).toBe(0);
  });

  it("keep fog for unknown and never confuse it with an empty vault", () => {
    expect(vaultUnknown("unsurveyed")).toBe(true);
    expect(vaultUnknown(null)).toBe(true);
    expect(vaultUnknown(undefined)).toBe(true);
    expect(vaultUnknown("empty")).toBe(false);
    for (const l of ["deep", "stocked", "thin"] as const) expect(vaultUnknown(l)).toBe(false);
  });

  it("fill fixed slots in a fixed order: a fuller vault adds stacks and never rearranges", () => {
    const all = stackSlots(MAX_STACKS);
    expect(new Set(all.map((s) => `${s.x}:${s.z}`)).size).toBe(MAX_STACKS);
    expect(stackSlots(2)).toEqual(all.slice(0, 2));
    expect(stackSlots(0)).toEqual([]);
    expect(stackSlots(-4)).toEqual([]);
    expect(stackSlots(Number.NaN)).toEqual([]);
    expect(stackSlots(99)).toHaveLength(MAX_STACKS);
  });
});
