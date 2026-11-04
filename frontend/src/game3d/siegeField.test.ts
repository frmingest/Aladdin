import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS, pathToCourtyard, returnSpot, transitionSpot } from "./areas";
import { CAMP_URL } from "./campPieces";
import { glbJson, glbTopNodes } from "./glbJson";
import { SIEGE_URL, SKELETON_URL } from "./holdingPieces";
import { MARKET } from "./marketPieces";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { STANDING_TORCHES } from "./standingTorches";
import { standingAt, NO_NEARS } from "./near";
import { DESK } from "./desk";
import { DRILL_LEAVE_RANGE, DRILL_POST, DRILL_RANGE } from "./stormDrill";
import { GATE_SPOT } from "./townPlan";
import { towerSpots, WALL_RADIUS } from "./layout";
import { areaLine, areaName } from "./areaWordsV1";
import {
  ATTACKERS,
  ENGINES,
  FIELD_BANNERS,
  FIELD_EXIT,
  FIELD_EXIT_LEAVE_RANGE,
  FIELD_FOG_Z,
  FIELD_HALF,
  FIELD_MAX_FOG,
  FIELD_MAX_SECTIONS,
  FIELD_ROCKS,
  FIELD_SPAWN,
  FIELD_TENT,
  FIELD_WALL_Z,
  SECTION_HEIGHT,
  SECTION_WIDTH,
  SIEGE_GATE,
  SIEGE_GATE_LEAVE_RANGE,
  SIEGE_GATE_RETURN,
  TIER_HEIGHT,
  TIER_RUBBLE,
  breachTier,
  ghostsFor,
  rowX,
  sectionsFor,
  tierSolid,
} from "./siegeField";
import type { BreachTier } from "./siegeField";
import type { YardFog, YardRow } from "./siegeYard";

const KB = 1024;

const row = (id: string, bar: number, extra: Partial<YardRow> = {}): YardRow => ({
  id,
  name: `Tower ${id}`,
  status: "Exposed",
  shock: `-${bar}%`,
  loss: "1 000 kr",
  line: "line",
  bar,
  rough: false,
  gap: null,
  ...extra,
});

describe("the files the field draws", () => {
  const siege = new Set(glbTopNodes(glbJson(SIEGE_URL)));
  const camp = new Set(glbTopNodes(glbJson(CAMP_URL)));

  it("finds every engine, the wall, the rocks and the banner in siege.glb, and the tent in camp.glb", () => {
    for (const e of ENGINES) expect(siege.has(e.model), e.model).toBe(true);
    for (const n of ["wall", "rocks_small", "rocks_large", "flag_banner_long"]) expect(siege.has(n), n).toBe(true);
    for (const r of FIELD_ROCKS) expect(siege.has(r.model), r.model).toBe(true);
    expect(camp.has("tent")).toBe(true);
  });

  it("gives every attacker a skeleton file under 1.5 MB that has the Idle clip", () => {
    for (const a of ATTACKERS) {
      const url = SKELETON_URL(a.file);
      expect(statSync(join(__dirname, "../../public", url)).size).toBeLessThanOrEqual(1.5 * 1024 * KB);
      const buf = readFileSync(join(__dirname, "../../public", url));
      const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
      expect((json.animations ?? []).map((c: { name: string }) => c.name)).toContain("Idle");
    }
  });
});

describe("breach reads from shape, from the backend's own damage width", () => {
  it("steps up at 10, 30 and 60 and is never random", () => {
    const at = (b: number) => breachTier(b);
    expect([0, 9, 10, 29, 30, 59, 60, 100].map(at)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(at(NaN)).toBe(0);
    expect(at(-5)).toBe(0);
  });

  it("never lets a worse tier stand taller, and only the breached tier opens a gap", () => {
    const tiers: BreachTier[] = [0, 1, 2, 3];
    for (let i = 1; i < tiers.length; i++) {
      expect(TIER_HEIGHT[tiers[i]]).toBeLessThan(TIER_HEIGHT[tiers[i - 1]]);
      expect(TIER_RUBBLE[tiers[i]]).toBeGreaterThan(TIER_RUBBLE[tiers[i - 1]]);
    }
    expect(tiers.map(tierSolid)).toEqual([true, true, true, false]);
    expect(TIER_HEIGHT[0]).toBe(1);
  });
});

describe("the wall line", () => {
  it("makes one section per modelled tower, in the panel's order, level and centred", () => {
    const rows = [row("a", 70), row("b", 40), row("c", 15), row("d", 0)];
    const s = sectionsFor(rows);
    expect(s.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(s.map((x) => x.tier)).toEqual([3, 2, 1, 0]);
    expect(new Set(s.map((x) => x.z))).toEqual(new Set([FIELD_WALL_Z]));
    expect(s.reduce((sum, x) => sum + x.x, 0)).toBeCloseTo(0);
    for (let i = 1; i < s.length; i++) expect(s[i].x - s[i - 1].x).toBeCloseTo(SECTION_WIDTH);
    expect(s[3].height).toBeCloseTo(SECTION_HEIGHT);
    expect(s[0].solid).toBe(false);
    expect(s[1].solid).toBe(true);
  });

  it("is drawn from the damage width alone: name, wording and amounts change nothing", () => {
    const x = sectionsFor([row("a", 42)])[0];
    const y = sectionsFor([row("a", 42, { name: "Other", status: "Sheltered", shock: "-1%", loss: "9 kr", rough: true, gap: "x" })])[0];
    expect({ ...x, name: "", status: "", shock: "" }).toEqual({ ...y, name: "", status: "", shock: "" });
  });

  it("stops at twelve sections and keeps them on the field", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`t${i}`, i * 5));
    const s = sectionsFor(rows);
    expect(s).toHaveLength(FIELD_MAX_SECTIONS);
    for (const x of s) expect(Math.abs(x.x) + SECTION_WIDTH / 2).toBeLessThan(FIELD_HALF);
  });

  it("shows a gaining tower unhurt, not as a made-up breach", () => {
    expect(sectionsFor([row("g", 0, { status: "Gains", shock: "+4%" })])[0].tier).toBe(0);
  });

  it("is empty when nothing could be modelled", () => {
    expect(sectionsFor([])).toEqual([]);
  });

  it("puts the fog ghosts behind the line, with no number anywhere", () => {
    const fog: YardFog[] = Array.from({ length: 9 }, (_, i) => ({ id: `f${i}`, name: `Fog ${i}`, reason: "Too little price history." }));
    const g = ghostsFor(fog);
    expect(g).toHaveLength(FIELD_MAX_FOG);
    for (const x of g) {
      expect(x.z).toBe(FIELD_FOG_Z);
      expect(x.z).toBeLessThan(FIELD_WALL_Z);
      expect(Object.keys(x).sort()).toEqual(["id", "name", "x", "z"]);
    }
    expect(ghostsFor([])).toEqual([]);
  });

  it("centres a row of any size", () => {
    for (const n of [1, 2, 5, 12]) expect(rowX(n).reduce((a, b) => a + b, 0)).toBeCloseTo(0);
  });
});

describe("the camp is fixed: it never carries a fact", () => {
  it("has five different engines and eight skeletons, always", () => {
    expect(ENGINES).toHaveLength(5);
    expect(new Set(ENGINES.map((e) => e.model)).size).toBe(5);
    expect(ATTACKERS).toHaveLength(8);
    expect(new Set(ATTACKERS.map((a) => a.id)).size).toBe(8);
  });

  it("takes no input: the module imports no holding, theme, wall, moat, backend type or verdict", () => {
    const src = readFileSync(join(__dirname, "siegeField.ts"), "utf8");
    const imports = [...src.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./npcs", "./siegeYard", "./stormDrill"].sort());
    expect(src).not.toMatch(/HoldingTheme|WallTier|MoatTier|\.level\b/);
  });

  it("stands on the field, clear of the wall line, the fog and each other", () => {
    const things = [
      ...ENGINES.map((e) => ({ id: e.id, x: e.x, z: e.z, r: e.solid })),
      ...ATTACKERS.map((a) => ({ id: a.id, x: a.x, z: a.z, r: 0.5 })),
      { id: "tent", x: FIELD_TENT.x, z: FIELD_TENT.z, r: FIELD_TENT.solid },
      ...FIELD_ROCKS.map((r) => ({ id: r.id, x: r.x, z: r.z, r: 1.4 })),
    ];
    for (const t of things) {
      expect(Math.abs(t.x) + t.r, t.id).toBeLessThan(FIELD_HALF);
      expect(Math.abs(t.z) + t.r, t.id).toBeLessThan(FIELD_HALF);
      expect(t.z - t.r, t.id).toBeGreaterThan(FIELD_WALL_Z + 3);
    }
    for (let i = 0; i < things.length; i++)
      for (let j = i + 1; j < things.length; j++) {
        const a = things[i];
        const b = things[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} / ${b.id}`).toBeGreaterThan(a.r + b.r);
      }
    for (const b of FIELD_BANNERS) expect(Math.abs(b.x)).toBeLessThan(FIELD_HALF);
  });

  it("keeps the spawn and the road back off every piece and out of each other's reach", () => {
    expect(Math.hypot(FIELD_EXIT.x - FIELD_SPAWN.x, FIELD_EXIT.z - FIELD_SPAWN.z)).toBeGreaterThan(FIELD_EXIT_LEAVE_RANGE + 1);
    expect(FIELD_EXIT.z).toBeLessThan(FIELD_HALF);
    for (const a of ATTACKERS) expect(Math.hypot(a.x - FIELD_SPAWN.x, a.z - FIELD_SPAWN.z)).toBeGreaterThan(1.5);
    for (const e of ENGINES) expect(Math.hypot(e.x - FIELD_SPAWN.x, e.z - FIELD_SPAWN.z)).toBeGreaterThan(e.solid + 1.5);
  });
});

describe("the gate in the courtyard", () => {
  it("stands inside the wall, clear of the drill post's reach and everything else", () => {
    expect(Math.hypot(SIEGE_GATE.x, SIEGE_GATE.z)).toBeLessThan(WALL_RADIUS - 3);
    // The drill post is checked first, so the gate must be out of its reach and the post out of the gate's.
    expect(Math.hypot(SIEGE_GATE.x - DRILL_POST.x, SIEGE_GATE.z - DRILL_POST.z)).toBeGreaterThan(Math.max(DRILL_RANGE, DRILL_LEAVE_RANGE) + SIEGE_GATE_LEAVE_RANGE);
    expect(Math.hypot(SIEGE_GATE.x - GATE_SPOT.x, SIEGE_GATE.z - GATE_SPOT.z)).toBeGreaterThan(SIEGE_GATE_LEAVE_RANGE + 4);
    const others = [
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
      ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, r: 0.5 })),
      ...SCENERY.filter((s) => s.y === 0).map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.solid })),
      ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
      ...towerSpots().map((s, i) => ({ id: `tower${i}`, x: s.x, z: s.z, r: 4 })),
      { id: "desk", ...DESK, r: 1.2 },
    ];
    for (const o of others) expect(Math.hypot(o.x - SIEGE_GATE.x, o.z - SIEGE_GATE.z), o.id).toBeGreaterThan(o.r + 2.4);
  });

  it("lands you out of its reach on the way back, and never within a door's reach to bounce you", () => {
    expect(Math.hypot(SIEGE_GATE_RETURN.x - SIEGE_GATE.x, SIEGE_GATE_RETURN.z - SIEGE_GATE.z)).toBeGreaterThan(SIEGE_GATE_LEAVE_RANGE);
    expect(Math.hypot(SIEGE_GATE_RETURN.x - DRILL_POST.x, SIEGE_GATE_RETURN.z - DRILL_POST.z)).toBeGreaterThan(DRILL_LEAVE_RANGE);
    expect(Math.hypot(SIEGE_GATE_RETURN.x, SIEGE_GATE_RETURN.z)).toBeLessThan(WALL_RADIUS - 2);
  });
});

describe("the Siege Field as a place", () => {
  it("is registered, outdoor, a child of the courtyard, with the road back as its one door", () => {
    const a = AREAS.siege;
    expect(a.parent).toBe("courtyard");
    expect(a.kind).toBe("outdoor");
    expect(a.lighting).toBe("outdoor");
    expect(a.doors.map((d) => d.id)).toEqual(["exit"]);
    expect(a.doors[0].to).toBe("parent");
    expect(pathToCourtyard("siege")).toEqual(["siege", "courtyard"]);
    expect(AREAS.courtyard.doors.some((d) => d.id === "siege" && d.to === "siege")).toBe(true);
  });

  it("brings you in at the south of the field and back out beside the gate", () => {
    expect(transitionSpot({ id: "courtyard" }, { id: "siege" }, [])).toEqual({ ...FIELD_SPAWN });
    const back = returnSpot({ id: "siege" }, { id: "courtyard" }, []);
    expect(back).not.toBeNull();
    expect(back!.x).toBe(SIEGE_GATE_RETURN.x);
    expect(back!.z).toBe(SIEGE_GATE_RETURN.z);
  });

  it("answers E with the gate in the courtyard, and the road back in the field", () => {
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, siegeGate: true })).toEqual({ kind: "siegeGate" });
    expect(standingAt({ id: "siege" }, { ...NO_NEARS, fieldExit: true })).toEqual({ kind: "leave" });
    expect(standingAt({ id: "siege" }, NO_NEARS)).toEqual({ kind: "none" });
    // The drill post still beats the gate when both are in reach.
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, drill: true, siegeGate: true })).toEqual({ kind: "drill" });
  });

  it("has a name plate and a tab title in game voice", () => {
    expect(areaLine({ id: "siege" })).toBe("The Siege Field");
    expect(areaName({ id: "siege" })).toBe("Siege Field");
  });
});

describe("the field files stay inside the budget", () => {
  it("adds no new model file", () => {
    for (const url of [SIEGE_URL, CAMP_URL]) expect(statSync(join(__dirname, "../../public", url)).size).toBeLessThanOrEqual(1024 * KB);
  });
});
