import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import { CAMP_URL } from "./campPieces";
import { glbJson, glbTopNodes } from "./glbJson";
import { SIEGE_URL, SKELETON_URL } from "./holdingPieces";
import { NPCS } from "./npcs";
import { SCENERY } from "./sceneryPieces";
import { standingAt, NO_NEARS } from "./near";
import { PLANTS } from "./meadowPlantsLogic";
import { SPAWN } from "./layout";
import { BUILDINGS, DOOR_LEAVE_RANGE, GATE_RETURN, VILLAGE_MARGIN, buildingReach, doorSpot } from "./townPlan";
import { WALL_RADIUS } from "./layout";
import { HORIZON_LIMIT, ROAD_HALF_WIDTH, onGateRoad } from "./horizonPieces";
import { FIELDS, RIVER_HALF, distToPolyline, fieldReach, riverLine, thinnedHorizon, tracks } from "./countrysideLogic";
import { TOWNSFOLK } from "./townsfolkLogic";
import * as V1 from "./siegeFieldWordsV1";
import * as V2Mod from "./siegeFieldWordsV2";
import {
  ATTACKERS,
  ENGINES,
  FIELD_BANNERS,
  FIELD_ENTRANCE,
  FIELD_FOG_Z,
  FIELD_HALF_WIDTH,
  FIELD_MAX_FOG,
  FIELD_MAX_SECTIONS,
  FIELD_NORTH,
  FIELD_ROCKS,
  FIELD_SOUTH,
  FIELD_TENT,
  FIELD_PRELOAD_RANGE,
  FIELD_SLEEP_RANGE,
  FIELD_WAKE_RANGE,
  FIELD_WALL_Z,
  SECTION_HEIGHT,
  SECTION_WIDTH,
  SIEGE_PLOT,
  TIER_HEIGHT,
  TIER_RUBBLE,
  breachTier,
  fieldToWorld,
  ghostsFor,
  onPlot,
  plotCorners,
  rowX,
  sectionsFor,
  tierSolid,
  worldToField,
} from "./siegeFieldLogic";
import type { BreachTier } from "./siegeFieldLogic";
import type { YardFog, YardRow } from "./siegeYard";

const KB = 1024;
const V2 = { ...V2Mod.FIELD_WORDS, FIELD_WORDS: V2Mod.FIELD_WORDS, FIELD_WORDS_VERSION: V2Mod.FIELD_WORDS_VERSION };

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
    for (const x of s) expect(Math.abs(x.x) + SECTION_WIDTH / 2).toBeLessThan(FIELD_HALF_WIDTH);
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
    const src = readFileSync(join(__dirname, "siegeFieldLogic.ts"), "utf8");
    const imports = [...src.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["./siegeYard", "./stormDrill"].sort());
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
      expect(Math.abs(t.x) + t.r, t.id).toBeLessThan(FIELD_HALF_WIDTH);
      expect(t.z + t.r, t.id).toBeLessThan(FIELD_ENTRANCE.z - 2);
      expect(t.z - t.r, t.id).toBeGreaterThan(FIELD_WALL_Z + 3);
    }
    for (let i = 0; i < things.length; i++)
      for (let j = i + 1; j < things.length; j++) {
        const a = things[i];
        const b = things[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} / ${b.id}`).toBeGreaterThan(a.r + b.r);
      }
    for (const b of FIELD_BANNERS) expect(Math.abs(b.x) + 1.5).toBeLessThan(FIELD_HALF_WIDTH);
  });

  it("keeps the whole camp, the fog and the banners inside the plot's depth", () => {
    expect(FIELD_FOG_Z - 1.4).toBeGreaterThan(FIELD_NORTH);
    expect(FIELD_WALL_Z).toBeGreaterThan(FIELD_FOG_Z);
    for (const e of ENGINES) expect(e.z - e.solid).toBeGreaterThan(FIELD_NORTH);
    expect(FIELD_ENTRANCE.z).toBeLessThan(FIELD_SOUTH);
  });
});

describe("the plot on the meadow (#466)", () => {
  const doorsOfTheTown = BUILDINGS.map((b) => ({ id: b.id, ...doorSpot(b) }));
  const corners = plotCorners();
  /** Points on a grid over the plot (edges included), in the courtyard's frame. */
  const samples = (() => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i <= 10; i++)
      for (let j = 0; j <= 10; j++) out.push(fieldToWorld({ x: -FIELD_HALF_WIDTH + (i / 10) * 2 * FIELD_HALF_WIDTH, z: FIELD_NORTH + (j / 10) * (FIELD_SOUTH - FIELD_NORTH) }));
    return out;
  })();

  it("turns local points into meadow points and back, without drift", () => {
    for (const p of [{ x: 0, z: 0 }, { x: 12.5, z: -7 }, { x: -20, z: 15 }]) {
      const back = worldToField(fieldToWorld(p));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.z).toBeCloseTo(p.z, 9);
    }
    expect(fieldToWorld({ x: 0, z: 0 })).toEqual({ x: SIEGE_PLOT.x, z: SIEGE_PLOT.z });
  });

  it("stands on the meadow outside the wall and the lane, and inside the walkable edge", () => {
    for (const c of corners) {
      expect(Math.hypot(c.x, c.z)).toBeGreaterThan(WALL_RADIUS + 5);
      expect(Math.hypot(c.x, c.z)).toBeLessThan(HORIZON_LIMIT - 4);
    }
    for (const p of samples) for (const t of tracks().filter((k) => k.kind === "ring")) expect(distToPolyline(p, t.points), "lane").toBeGreaterThan(t.width / 2 + 1);
  });

  it("has its wall line on the far side and its open end toward the fortress", () => {
    const wall = fieldToWorld({ x: 0, z: FIELD_WALL_Z });
    const entrance = fieldToWorld(FIELD_ENTRANCE);
    expect(Math.hypot(wall.x, wall.z)).toBeGreaterThan(Math.hypot(entrance.x, entrance.z) + 20);
    // South-west of the gate road, so the road and the Town are on its fortress side.
    expect(SIEGE_PLOT.x).toBeLessThan(-ROAD_HALF_WIDTH);
    expect(SIEGE_PLOT.z).toBeGreaterThan(0);
  });

  it("is clear of every Town building, every door's reach, the gate road, the river and the tracks", () => {
    for (const b of BUILDINGS) expect(onPlot(b, buildingReach(b) + VILLAGE_MARGIN), b.id).toBe(false);
    for (const d of doorsOfTheTown) expect(onPlot(d, DOOR_LEAVE_RANGE), d.id).toBe(false);
    for (const p of samples) {
      expect(onGateRoad(p.x, p.z, ROAD_HALF_WIDTH), "gate road").toBe(false);
      expect(distToPolyline(p, riverLine()), "river").toBeGreaterThan(RIVER_HALF + 1);
      for (const t of tracks()) expect(distToPolyline(p, t.points), t.id).toBeGreaterThan(t.width / 2 + 0.5);
    }
  });

  it("has no tilled patch, tree, boulder, meadow plant, person or scenery piece on its ground", () => {
    for (const f of FIELDS) expect(onPlot(f, fieldReach(f)), f.id).toBe(false);
    for (const p of thinnedHorizon().filter((h) => h.solid > 0)) expect(onPlot(p, Math.max(p.solid, p.scale * 0.45)), p.id).toBe(false);
    for (const p of PLANTS) expect(onPlot(p, 0), p.id).toBe(false);
    const people = [...NPCS, ...TOWNSFOLK, ...SCENERY.filter((s) => s.y === 0)];
    for (const o of people) expect(onPlot(o, 0), o.id).toBe(false);
  });

  it("took a tilled patch and some of the grove, and only those (dropped, never moved)", () => {
    expect(FIELDS.length).toBeLessThan(5);
    expect(thinnedHorizon().length).toBeGreaterThan(40);
  });

  it("wakes the camp only when you come near: not at the courtyard's spawn or the head of the gate road", () => {
    const d = (p: { x: number; z: number }) => Math.hypot(p.x - SIEGE_PLOT.x, p.z - SIEGE_PLOT.z);
    expect(d(SPAWN)).toBeGreaterThan(FIELD_WAKE_RANGE);
    expect(d(GATE_RETURN)).toBeGreaterThan(FIELD_WAKE_RANGE);
    expect(d({ x: 0, z: 72 })).toBeGreaterThan(FIELD_WAKE_RANGE);
    // It sleeps again further out than it wakes (no flicker at the edge), and its files start loading before it wakes.
    expect(FIELD_SLEEP_RANGE).toBeGreaterThan(FIELD_WAKE_RANGE);
    expect(FIELD_PRELOAD_RANGE).toBeGreaterThan(FIELD_SLEEP_RANGE);
    // ...and it is awake well before you reach the entrance.
    expect(d(fieldToWorld(FIELD_ENTRANCE))).toBeLessThan(FIELD_WAKE_RANGE - 20);
  });

  it("keeps the entrance's pole on the plot, off the gap between the posts", () => {
    expect(onPlot(fieldToWorld({ x: FIELD_ENTRANCE.x + 4.5, z: FIELD_ENTRANCE.z }), 0)).toBe(true);
  });

  it("keeps the entrance's gap open and its posts on the plot", () => {
    for (const x of [-1.6, 1.6]) expect(onPlot(fieldToWorld({ x: FIELD_ENTRANCE.x + x, z: FIELD_ENTRANCE.z }), 0)).toBe(true);
  });
});

describe("the Siege Field words keep version 1 as it was shown", () => {
  it("v2 carries every v1 line unchanged", () => {
    expect(V2.FIELD_WORDS_VERSION).toBe("v2");
    expect(V1.FIELD_WORDS_VERSION).toBe("v1");
    for (const [k, v] of Object.entries(V1.FIELD_WORDS)) expect((V2.FIELD_WORDS as Record<string, string>)[k], k).toBe(v);
  });
});

describe("the Siege Field is no longer a place of its own (#466)", () => {
  it("has no area, no door into it and no way back out", () => {
    expect(Object.keys(AREAS)).not.toContain("siege");
    for (const a of Object.values(AREAS)) expect(a.doors.some((d) => d.id === "siege" || d.to === ("siege" as never))).toBe(false);
  });

  it("answers E at a field tool in the courtyard, and a person or the drill post still beat it", () => {
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, fieldSpot: "winch" })).toEqual({ kind: "fieldSpot", id: "winch" });
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, drill: true, fieldSpot: "winch" })).toEqual({ kind: "drill" });
  });
});

describe("the field files stay inside the budget", () => {
  it("adds no new model file", () => {
    for (const url of [SIEGE_URL, CAMP_URL]) expect(statSync(join(__dirname, "../../public", url)).size).toBeLessThanOrEqual(1024 * KB);
  });
});
