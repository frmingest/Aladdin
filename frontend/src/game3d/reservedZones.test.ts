import { describe, expect, it } from "vitest";
import { RESERVED_ZONES } from "./layout";
import { DESK, SHELF } from "./desk";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { STANDING_TORCHES } from "./standingTorches";
import { TOWNSFOLK } from "./townsfolk";

describe("reserved zones (marketplace, siege simulator)", () => {
  it("have nothing standing in them today", () => {
    const things = [
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, r: 0.5 })),
      ...TOWNSFOLK.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.5 })),
      ...SCENERY.filter((s) => s.y === 0).map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.solid })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      { id: "desk", ...DESK, r: 1.2 },
      { id: "shelf", ...SHELF, r: 1.1 },
    ];
    for (const z of RESERVED_ZONES)
      for (const t of things) expect(Math.hypot(t.x - z.x, t.z - z.z), `${t.id} in ${z.id}`).toBeGreaterThan(z.radius + t.r);
  });
});
