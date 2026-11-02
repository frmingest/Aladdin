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
import { STREET_PLOTS, STALL_SOLID } from "./streetPlan";
import { VAULT, VAULT_LEAVE_RANGE } from "./vaultPlan";
import { ENTER_REACH, exitSpot } from "./towerDoor";
import { SIZE_RADIUS } from "./stateToWorld";
import {
  MAX_BIRDS,
  PERCH,
  PERCH_LEAVE_RANGE,
  PERCH_RANGE,
  WATCH_LEAVE_RANGE,
  WATCH_POST,
  WATCH_RANGE,
  birdCount,
  birdSlots,
  nearPerch,
  nearWatch,
  watchLook,
} from "./watchPlan";

describe("the Night Watch post", () => {
  it("stands on the cobbles inside the gate, clear of every pad, person, prop, scenery piece, stall and the spawn", () => {
    expect(Math.hypot(WATCH_POST.x, WATCH_POST.z)).toBeLessThan(COBBLE_RADIUS - 1);
    const inKeep = Math.abs(WATCH_POST.x - KEEP.x) < KEEP.width / 2 + 0.5 && Math.abs(WATCH_POST.z - KEEP.z) < KEEP.depth / 2 + 0.5;
    expect(inKeep).toBe(false);
    for (const s of towerSpots()) expect(Math.hypot(WATCH_POST.x - s.x, WATCH_POST.z - s.z)).toBeGreaterThan(3.5);
    for (const n of NPCS) expect(Math.hypot(WATCH_POST.x - n.x, WATCH_POST.z - n.z)).toBeGreaterThan(3.5);
    for (const t of TOWNSFOLK) expect(Math.hypot(WATCH_POST.x - t.x, WATCH_POST.z - t.z)).toBeGreaterThan(3.5);
    for (const p of PROPS) expect(Math.hypot(WATCH_POST.x - p.x, WATCH_POST.z - p.z), p.id).toBeGreaterThan(p.solid + 2);
    for (const s of SCENERY) if (s.solid > 0) expect(Math.hypot(WATCH_POST.x - s.x, WATCH_POST.z - s.z), s.id).toBeGreaterThan(s.solid + 2);
    for (const p of STREET_PLOTS) expect(Math.hypot(WATCH_POST.x - p.x, WATCH_POST.z - p.z)).toBeGreaterThan(STALL_SOLID.hx + 2);
    expect(Math.hypot(WATCH_POST.x - SPAWN.x, WATCH_POST.z - SPAWN.z)).toBeGreaterThan(3);
    for (const z of RESERVED_ZONES) expect(Math.hypot(WATCH_POST.x - z.x, WATCH_POST.z - z.z), z.id).toBeGreaterThan(z.radius + 2);
  });

  it("is out of reach of every other thing E opens, so E never means two things", () => {
    const others = [
      { id: "desk", ...DESK, leave: DESK_LEAVE_RANGE },
      { id: "shelf", ...SHELF, leave: 0 },
      { id: "sign", ...SIGN, leave: SIGN_LEAVE_RANGE },
      { id: "drill", ...DRILL_POST, leave: DRILL_LEAVE_RANGE },
      { id: "gate", ...GATE_SPOT, leave: GATE_LEAVE_RANGE },
      { id: "vault", ...VAULT, leave: VAULT_LEAVE_RANGE },
      { id: "perch", ...PERCH, leave: PERCH_LEAVE_RANGE },
      ...BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, leave: BOOTH_LEAVE_RANGE })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, leave: 5 })),
      ...STREET_PLOTS.map((p, i) => ({ id: `stall-${i}`, x: p.x, z: p.z, leave: 4 })),
    ];
    for (const o of others) expect(Math.hypot(WATCH_POST.x - o.x, WATCH_POST.z - o.z), o.id).toBeGreaterThan(WATCH_LEAVE_RANGE + o.leave);
  });

  it("is out of reach of every tower door", () => {
    const widest = Math.max(...Object.values(SIZE_RADIUS));
    for (const s of towerSpots()) expect(Math.hypot(WATCH_POST.x - s.x, WATCH_POST.z - s.z)).toBeGreaterThan(WATCH_RANGE + widest + ENTER_REACH);
  });

  it("is never where a hero stepping out of a tower is put down", () => {
    for (const s of towerSpots())
      for (const r of Object.values(SIZE_RADIUS)) {
        const out = exitSpot(s, r);
        expect(Math.hypot(out.x - WATCH_POST.x, out.z - WATCH_POST.z)).toBeGreaterThanOrEqual(2.4);
      }
  });

  it("is reached from beside it and not from across the yard", () => {
    expect(nearWatch(WATCH_POST)).toBe(true);
    expect(nearWatch({ x: WATCH_POST.x + 3, z: WATCH_POST.z })).toBe(true);
    expect(nearWatch(SPAWN)).toBe(false);
    expect(nearWatch({ x: 0, z: 0 })).toBe(false);
  });
});

describe("the watch lantern", () => {
  it("burns for a watch that reported in, whether the night was quiet or needs a look", () => {
    expect(watchLook("quiet")).toEqual({ lit: true, mark: "" });
    expect(watchLook("attention")).toEqual({ lit: true, mark: "!" });
  });

  it("stays dark with a question mark for a watch that is not reporting or cannot be read: never drawn as calm", () => {
    expect(watchLook("unknown")).toEqual({ lit: false, mark: "?" });
    expect(watchLook(null)).toEqual({ lit: false, mark: "?" });
    expect(watchLook(undefined)).toEqual({ lit: false, mark: "?" });
  });

  it("gives every status a different picture (lit or not, and a mark), so colour is never the only signal", () => {
    const looks = (["quiet", "attention", "unknown"] as const).map((s) => JSON.stringify(watchLook(s)));
    expect(new Set(looks).size).toBe(3);
  });
});

describe("the raven perch", () => {
  it("is the prop that already stands east of the fountain", () => {
    const perch = PROPS.find((p) => p.kind === "perch");
    expect(perch).toBeDefined();
    expect(perch?.x).toBe(PERCH.x);
    expect(perch?.z).toBe(PERCH.z);
  });

  it("is out of reach of every other thing E opens", () => {
    const others = [
      { id: "sign", ...SIGN, leave: SIGN_LEAVE_RANGE },
      { id: "vault", ...VAULT, leave: VAULT_LEAVE_RANGE },
      { id: "desk", ...DESK, leave: DESK_LEAVE_RANGE },
      { id: "drill", ...DRILL_POST, leave: DRILL_LEAVE_RANGE },
      { id: "gate", ...GATE_SPOT, leave: GATE_LEAVE_RANGE },
      { id: "watch", ...WATCH_POST, leave: WATCH_LEAVE_RANGE },
      ...BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, leave: BOOTH_LEAVE_RANGE })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, leave: 5 })),
      ...STREET_PLOTS.map((p, i) => ({ id: `stall-${i}`, x: p.x, z: p.z, leave: 4 })),
    ];
    for (const o of others) expect(Math.hypot(PERCH.x - o.x, PERCH.z - o.z), o.id).toBeGreaterThan(PERCH_LEAVE_RANGE + o.leave);
  });

  it("is out of reach of every tower door", () => {
    const widest = Math.max(...Object.values(SIZE_RADIUS));
    for (const s of towerSpots()) expect(Math.hypot(PERCH.x - s.x, PERCH.z - s.z)).toBeGreaterThan(PERCH_RANGE + widest + ENTER_REACH);
  });

  it("is reached from beside it", () => {
    expect(nearPerch(PERCH)).toBe(true);
    expect(nearPerch({ x: PERCH.x - 3, z: PERCH.z })).toBe(true);
    expect(nearPerch(SPAWN)).toBe(false);
  });
});

describe("the birds on the perch", () => {
  it("shows no bird unless a real unseen raven exists", () => {
    expect(birdCount(0)).toBe(0);
    expect(birdCount(-2)).toBe(0);
    expect(birdCount(null)).toBe(0);
    expect(birdCount(undefined)).toBe(0);
    expect(birdCount(Number.NaN)).toBe(0);
    expect(birdSlots(0)).toHaveLength(0);
  });

  it("shows one bird per unseen raven up to the arm, and never more", () => {
    expect(birdCount(1)).toBe(1);
    expect(birdCount(2)).toBe(2);
    expect(birdCount(3)).toBe(MAX_BIRDS);
    expect(birdCount(40)).toBe(MAX_BIRDS);
  });

  it("keeps a bird where it is when another lands: a fuller perch adds, never rearranges", () => {
    for (let n = 1; n < MAX_BIRDS; n++) expect(birdSlots(n + 1).slice(0, n)).toEqual(birdSlots(n));
    const xs = birdSlots(MAX_BIRDS).map((s) => s.x);
    expect(new Set(xs).size).toBe(MAX_BIRDS);
  });
});
