import { describe, expect, it } from "vitest";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { KEY_ACTIONS } from "./movement";
import { NPCS } from "./npcs";
import { PANEL_KEYS } from "./hudPanels";
import { PROPS } from "./props";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";
import { DESK } from "./desk";
import { DRILL_POST } from "./stormDrill";
import { SIGNPOST, SIGN_LEAVE_RANGE, SIGN_RANGE, WHERE_KEY, nearSignpost } from "./signpostSpot";

describe("signpost", () => {
  it("is near within range and has a wider leave range", () => {
    expect(nearSignpost({ x: SIGNPOST.x + 3, z: SIGNPOST.z })).toBe(true);
    expect(nearSignpost({ x: SIGNPOST.x + 5, z: SIGNPOST.z })).toBe(false);
    expect(nearSignpost({ x: SIGNPOST.x + 5, z: SIGNPOST.z }, SIGN_LEAVE_RANGE)).toBe(true);
    expect(SIGN_LEAVE_RANGE).toBeGreaterThan(SIGN_RANGE);
  });

  it("stands on the cobbles, clear of pads, props, people, torches, desk, drill post and the keep", () => {
    expect(Math.hypot(SIGNPOST.x, SIGNPOST.z)).toBeLessThan(COBBLE_RADIUS - 1);
    expect(Math.abs(SIGNPOST.z - KEEP.z)).toBeGreaterThan(KEEP.depth);
    const others = [
      ...towerSpots().map((s) => ({ ...s, r: 3.5 })),
      ...PROPS.map((p) => ({ x: p.x, z: p.z, r: p.solid + 1 })),
      ...NPCS.map((n) => ({ x: n.x, z: n.z, r: 1.5 })),
      ...TOWNSFOLK.map((t) => ({ x: t.x, z: t.z, r: 1.5 })),
      ...STANDING_TORCHES.map((t) => ({ x: t.x, z: t.z, r: 1.2 })),
      { ...DESK, r: 2 },
      { ...DRILL_POST, r: 2 },
      { x: SPAWN.x, z: SPAWN.z, r: 2.5 },
    ];
    for (const o of others) expect(Math.hypot(SIGNPOST.x - o.x, SIGNPOST.z - o.z)).toBeGreaterThan(o.r + 0.5);
  });

  it("keeps the gate road open", () => {
    expect(Math.abs(SIGNPOST.x)).toBeGreaterThan(3);
  });

  it("uses a key that clashes with nothing", () => {
    expect(KEY_ACTIONS[WHERE_KEY]).toBeUndefined();
    expect(Object.keys(PANEL_KEYS)).not.toContain(WHERE_KEY);
    expect(["KeyE", "KeyP", "F3"]).not.toContain(WHERE_KEY);
  });
});
