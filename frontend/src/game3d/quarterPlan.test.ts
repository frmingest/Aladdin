import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { orderStreet } from "../lib/marketplace";
import type { WatchlistRow } from "../lib/types";
import { AREAS, pathToCourtyard, returnSpot, transitionSpot } from "./areas";
import { areaLine, areaName } from "./areaWordsV1";
import { DESK } from "./desk";
import { glbJson, glbTopNodes } from "./glbJson";
import { MARKET_QUARTER_URL } from "./holdingPieces";
import { KEEP, WALL_RADIUS, towerSpots } from "./layout";
import { MARKET } from "./marketPieces";
import { NO_NEARS, standingAt } from "./near";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { SCENERY } from "./sceneryPieces";
import { BOOTHS } from "./boothPlan";
import { REALM_POST } from "./realmPlan";
import { SIGN } from "./signpost";
import { SIEGE_GATE } from "./siegeField";
import { STANDING_TORCHES } from "./standingTorches";
import { DRILL_POST } from "./stormDrill";
import { STALL_LEAVE_RANGE, nearestStall } from "./stallDoor";
import { STREET_PLOTS } from "./streetPlan";
import { GATE_SPOT } from "./townPlan";
import { VAULT } from "./vaultPlan";
import { PERCH, WATCH_POST } from "./watchPlan";
import { placeFromSearch, searchFor } from "./placeLink";
import {
  FIRST_ROW_Z,
  FOG_GAP,
  GOODS_SETS,
  LANE_BANNERS,
  LANE_HOUSE,
  LANE_SIGN,
  LANE_TILES,
  QUARTER_EXIT,
  QUARTER_EXIT_LEAVE_RANGE,
  QUARTER_GATE,
  QUARTER_GATE_LEAVE_RANGE,
  QUARTER_GATE_RETURN,
  QUARTER_HALF,
  QUARTER_MAX,
  QUARTER_SPAWN,
  ROW_GAP,
  STALL_X,
  buildQuarter,
  goodsFor,
} from "./quarterPlan";
import { QUARTER_WORDS, archLine } from "./quarterWordsV1";

const row = (n: number, status: WatchlistRow["status"] = "buy_zone", over: Partial<WatchlistRow> = {}): WatchlistRow =>
  ({
    id: `w${n}`, holding_id: `h${n}`, ticker: `T${n}`, name: `Company ${String(n).padStart(2, "0")}`, sector: null, instrument_type: "equity",
    owned: false, buy_below_price: "100", buy_below_currency: "NOK", notes: null, added_at: "2026-01-01", price: "90", price_currency: "NOK",
    price_as_of: null, distance_to_buy_pct: String(-10 + n), status, dcf_base: null, margin_of_safety_base: null, ...over,
  }) as unknown as WatchlistRow;

const priced = (n: number, from = 0) => Array.from({ length: n }, (_, i) => row(from + i, (["buy_zone", "near", "above"] as const)[i % 3]));
const unpriced = (n: number, from = 100) => Array.from({ length: n }, (_, i) => row(from + i, "no_price", { price: null, distance_to_buy_pct: null }));

describe("the quarter's lane", () => {
  it("is empty, with no fog and zero counts, for no watchlist", () => {
    for (const rows of [null, undefined, []]) {
      const q = buildQuarter(rows);
      expect(q.stalls).toEqual([]);
      expect(q.overflow).toEqual([]);
      expect(q.fogZ).toBeNull();
      expect([q.total, q.inRange]).toEqual([0, 0]);
    }
  });

  it("puts stalls in the flat page's street order, nearest your price nearest the arch", () => {
    const rows = [row(3, "above"), row(1, "near"), row(2, "buy_zone"), row(4, "no_price", { price: null, distance_to_buy_pct: null })];
    const q = buildQuarter(rows);
    expect(q.stalls.map((s) => s.holdingId)).toEqual(orderStreet(rows).map((r) => r.holding_id));
    // Up the lane (z falls) as the order goes on, and the first stall is the nearest to the arch.
    const zs = q.stalls.map((s) => s.z);
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeLessThanOrEqual(zs[i - 1]);
    expect(q.stalls[0].z).toBe(FIRST_ROW_Z);
  });

  it("stands twelve at most, six rows of two, and counts the rest without drawing them", () => {
    const q = buildQuarter([...priced(10), ...unpriced(4)]);
    expect(q.stalls).toHaveLength(QUARTER_MAX);
    expect(q.overflow).toHaveLength(2);
    expect(q.total).toBe(14);
    expect(new Set(q.stalls.map((s) => s.z)).size).toBeLessThanOrEqual(QUARTER_MAX / 2 + 1);
  });

  it("keeps every stall on the ground, clear of each other, for every mix of priced and unpriced", () => {
    for (let p = 0; p <= 14; p++)
      for (let u = 0; u + p <= 14; u++) {
        const q = buildQuarter([...priced(p), ...unpriced(u)]);
        for (const s of q.stalls) {
          expect(Math.abs(s.x), `${p}/${u}`).toBe(STALL_X);
          expect(s.z, `${p}/${u}`).toBeGreaterThan(-QUARTER_HALF + 6);
          expect(s.z, `${p}/${u}`).toBeLessThanOrEqual(FIRST_ROW_Z);
        }
        for (let i = 0; i < q.stalls.length; i++)
          for (let j = i + 1; j < q.stalls.length; j++)
            expect(Math.hypot(q.stalls[i].x - q.stalls[j].x, q.stalls[i].z - q.stalls[j].z), `${p}/${u}`).toBeGreaterThanOrEqual(ROW_GAP - 0.01);
      }
  });

  it("fronts every stall toward the lane", () => {
    const q = buildQuarter(priced(4));
    for (const s of q.stalls) expect(s.yaw).toBeCloseTo(s.x < 0 ? Math.PI / 2 : -Math.PI / 2, 6);
  });

  it("stands the stalls with no price in a quiet stretch behind a gap, and says \"No price\"", () => {
    const q = buildQuarter([...priced(3), ...unpriced(3)]);
    const p = q.stalls.filter((s) => !s.unpriced);
    const u = q.stalls.filter((s) => s.unpriced);
    expect(p).toHaveLength(3);
    expect(u).toHaveLength(3);
    // Priced stalls all come first, up the lane; the first unpriced one is a whole row and the gap further on.
    expect(Math.min(...p.map((s) => s.z)) - Math.max(...u.map((s) => s.z))).toBeGreaterThanOrEqual(ROW_GAP + FOG_GAP);
    expect(q.fogZ).toBe(Math.max(...u.map((s) => s.z)));
    for (const s of u) {
      expect(s.word).toBe("No price");
      expect(s.gap).toBeNull();
      expect(s.pennant).toBe("none");
    }
  });

  it("has no quiet stretch when every stall has a price, and starts at the first row when none has", () => {
    expect(buildQuarter(priced(5)).fogZ).toBeNull();
    const all = buildQuarter(unpriced(3));
    expect(all.fogZ).toBe(FIRST_ROW_Z);
    expect(all.stalls[0].z).toBe(FIRST_ROW_Z);
  });

  it("counts the whole watchlist for the arch, in range from the flat page's own tone", () => {
    const q = buildQuarter([row(1, "buy_zone"), row(2, "buy_zone"), row(3, "near"), ...unpriced(2)]);
    expect(q.total).toBe(5);
    expect(q.inRange).toBe(2);
    const big = buildQuarter([...priced(15), ...unpriced(0)]);
    expect(big.total).toBe(15);
    expect(big.stalls).toHaveLength(12);
  });

  it("reaches the nearest stall by its own reach, and only one at a time", () => {
    const q = buildQuarter(priced(12));
    for (const s of q.stalls) expect(nearestStall({ x: s.x + (s.x < 0 ? 2 : -2), z: s.z }, q.stalls)).toBe(s.holdingId);
    // Standing in the middle of the lane between two rows reaches nothing.
    expect(nearestStall({ x: 0, z: FIRST_ROW_Z - ROW_GAP / 2 }, q.stalls)).toBeNull();
  });
});

describe("the goods and the lane's dressing never carry a fact", () => {
  const nodes = glbTopNodes(glbJson(MARKET_QUARTER_URL));

  it("uses only pieces that are in market-quarter.glb", () => {
    const used = [...GOODS_SETS.flat().map((g) => g.node), "floor_wood", "banner_thin_blue", "home_A"];
    for (const n of used) expect(nodes, n).toContain(n);
  });

  it("gives every goods set the same number of pieces, so no stall looks richer than another", () => {
    expect(new Set(GOODS_SETS.map((s) => s.length))).toEqual(new Set([3]));
  });

  it("picks a set from the company id alone, the same on every visit", () => {
    for (const id of ["h1", "h2", "h3", "alpha", "beta", "x-9"]) {
      expect(goodsFor(id)).toBe(goodsFor(id));
      expect(GOODS_SETS).toContain(goodsFor(id));
    }
    // More than one set is in use across a plain run of ids.
    expect(new Set(Array.from({ length: 12 }, (_, i) => goodsFor(`h${i}`))).size).toBeGreaterThan(1);
  });

  it("keeps the goods beside and behind the stall, off its front, its pennant and its plate", () => {
    for (const g of GOODS_SETS.flat()) {
      expect(Math.abs(g.x), g.node).toBeGreaterThanOrEqual(2);
      expect(g.z, g.node).toBeLessThanOrEqual(0.7);
      // The pennant pole stands at (1.5, 0.9) and the plate at (0, 1.9), in the stall's own frame.
      expect(Math.hypot(g.x - 1.5, g.z - 0.9), g.node).toBeGreaterThan(1);
      expect(Math.hypot(g.x, g.z - 1.9), g.node).toBeGreaterThan(2);
    }
  });

  it("keeps neighbouring rows' goods apart", () => {
    for (const a of GOODS_SETS.flat()) for (const b of GOODS_SETS.flat()) expect(Math.abs(a.x) + Math.abs(b.x), `${a.node}/${b.node}`).toBeLessThan(ROW_GAP + 3);
  });

  it("lays the boardwalk and the banners on fixed spots, off the stalls and inside the quarter", () => {
    expect(LANE_TILES.length).toBe(30);
    expect(new Set(LANE_TILES.map((t) => t.id)).size).toBe(30);
    for (const t of LANE_TILES) {
      expect(Math.abs(t.x)).toBeLessThan(STALL_X - 2);
      expect(Math.abs(t.z)).toBeLessThan(QUARTER_HALF);
    }
    for (const b of LANE_BANNERS) {
      expect(Math.abs(b.z)).toBeLessThan(QUARTER_HALF);
      // The pair at the entrance stands before the first row; every other pole stands beyond the stalls and their goods.
      if (b.z < FIRST_ROW_Z + 3) expect(Math.abs(b.x)).toBeGreaterThan(STALL_X + 3);
      else expect(b.z).toBeGreaterThan(FIRST_ROW_Z + 5);
    }
    expect(LANE_HOUSE.z).toBeGreaterThan(-QUARTER_HALF);
    expect(LANE_SIGN.z).toBeLessThan(QUARTER_SPAWN.z);
  });

  it("takes only a watchlist: the plan imports no holding theme, wall, moat, backend type or verdict", () => {
    const src = readFileSync(join(__dirname, "quarterPlan.ts"), "utf8");
    const imports = [...src.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
    expect([...new Set(imports)].sort()).toEqual(["../lib/marketplace", "../lib/types", "./npcs", "./streetPlan"].sort());
    expect(src).not.toMatch(/HoldingTheme|WallTier|MoatTier|\.level\b/);
  });
});

describe("the quarter's ground", () => {
  it("brings you in at the south of the lane, clear of every stall and of the road back", () => {
    const q = buildQuarter(priced(12));
    for (const s of q.stalls) expect(Math.hypot(s.x - QUARTER_SPAWN.x, s.z - QUARTER_SPAWN.z)).toBeGreaterThan(STALL_LEAVE_RANGE + 2);
    expect(Math.hypot(QUARTER_EXIT.x - QUARTER_SPAWN.x, QUARTER_EXIT.z - QUARTER_SPAWN.z)).toBeGreaterThan(QUARTER_EXIT_LEAVE_RANGE);
    expect(QUARTER_EXIT.z).toBeLessThan(QUARTER_HALF);
  });

  it("keeps the road back out of every stall's reach, so E never has two answers", () => {
    for (let p = 0; p <= 12; p++) {
      const q = buildQuarter([...priced(p), ...unpriced(12 - p)]);
      for (const s of q.stalls) expect(Math.hypot(s.x - QUARTER_EXIT.x, s.z - QUARTER_EXIT.z)).toBeGreaterThan(STALL_LEAVE_RANGE + QUARTER_EXIT_LEAVE_RANGE);
    }
  });

  it("keeps the house and the sign off the stalls and the walkway's ends", () => {
    const q = buildQuarter(priced(6).concat(unpriced(6)));
    for (const s of q.stalls) expect(Math.hypot(s.x - LANE_HOUSE.x, s.z - LANE_HOUSE.z)).toBeGreaterThan(LANE_HOUSE.solid + 4);
  });
});

describe("the arch in the courtyard", () => {
  const solids = [
    ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
    ...MARKET.map((m) => ({ id: m.id, x: m.x, z: m.z, r: m.solid.kind === "circle" ? m.solid.r : Math.hypot(m.solid.hx, m.solid.hz) })),
    ...NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, r: 0.5 })),
    ...SCENERY.filter((s) => s.y === 0).map((s) => ({ id: s.id, x: s.x, z: s.z, r: s.solid })),
    ...STANDING_TORCHES.map((t) => ({ id: t.id, x: t.x, z: t.z, r: 0.3 })),
    ...towerSpots().map((s, i) => ({ id: `tower${i}`, x: s.x, z: s.z, r: 4 })),
    ...STREET_PLOTS.map((s, i) => ({ id: `plot${i}`, x: s.x, z: s.z, r: 2.4 })),
    ...BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, r: 2.4 })),
    { id: "desk", ...DESK, r: 1.2 },
    { id: "keep", x: KEEP.x, z: KEEP.z, r: 10 },
  ];
  const spots = [
    { id: "desk", ...DESK },
    { id: "drill", ...DRILL_POST },
    { id: "gate", ...GATE_SPOT },
    { id: "siege", ...SIEGE_GATE },
    { id: "vault", ...VAULT },
    { id: "realm", ...REALM_POST },
    { id: "watch", ...WATCH_POST },
    { id: "perch", ...PERCH },
    { id: "sign", ...SIGN },
    ...BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z })),
  ];

  it("stands inside the wall, clear of everything and out of every other reach", () => {
    expect(Math.hypot(QUARTER_GATE.x, QUARTER_GATE.z)).toBeLessThan(WALL_RADIUS - 3);
    for (const o of solids) expect(Math.hypot(o.x - QUARTER_GATE.x, o.z - QUARTER_GATE.z), o.id).toBeGreaterThan(o.r + 2.4);
    for (const s of spots) expect(Math.hypot(s.x - QUARTER_GATE.x, s.z - QUARTER_GATE.z), s.id).toBeGreaterThan(QUARTER_GATE_LEAVE_RANGE + 7);
  });

  it("lands you out of its reach on the way back, clear of everything, and never within another door's reach", () => {
    expect(Math.hypot(QUARTER_GATE_RETURN.x - QUARTER_GATE.x, QUARTER_GATE_RETURN.z - QUARTER_GATE.z)).toBeGreaterThan(QUARTER_GATE_LEAVE_RANGE);
    expect(Math.hypot(QUARTER_GATE_RETURN.x, QUARTER_GATE_RETURN.z)).toBeLessThan(WALL_RADIUS - 2);
    for (const o of solids) expect(Math.hypot(o.x - QUARTER_GATE_RETURN.x, o.z - QUARTER_GATE_RETURN.z), o.id).toBeGreaterThan(o.r + 0.8);
    for (const s of spots) expect(Math.hypot(s.x - QUARTER_GATE_RETURN.x, s.z - QUARTER_GATE_RETURN.z), s.id).toBeGreaterThan(6);
  });
});

describe("the Market Quarter as a place", () => {
  it("is registered, outdoor, a child of the courtyard, with the road back as its one door", () => {
    const a = AREAS.quarter;
    expect(a.parent).toBe("courtyard");
    expect(a.kind).toBe("outdoor");
    expect(a.lighting).toBe("outdoor");
    expect(a.doors.map((d) => d.id)).toEqual(["exit"]);
    expect(a.doors[0].to).toBe("parent");
    expect(pathToCourtyard("quarter")).toEqual(["quarter", "courtyard"]);
    expect(AREAS.courtyard.doors.some((d) => d.id === "quarter" && d.to === "quarter")).toBe(true);
  });

  it("brings you in at the south of the lane and back out beside the arch", () => {
    expect(transitionSpot({ id: "courtyard" }, { id: "quarter" }, [])).toEqual({ ...QUARTER_SPAWN });
    const back = returnSpot({ id: "quarter" }, { id: "courtyard" }, []);
    expect(back).not.toBeNull();
    expect(back!.x).toBe(QUARTER_GATE_RETURN.x);
    expect(back!.z).toBe(QUARTER_GATE_RETURN.z);
  });

  it("answers E with the arch in the courtyard, a stall or the road back in the quarter", () => {
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, quarterGate: true })).toEqual({ kind: "quarterGate" });
    expect(standingAt({ id: "quarter" }, { ...NO_NEARS, stall: "h1" })).toEqual({ kind: "stall", holdingId: "h1" });
    expect(standingAt({ id: "quarter" }, { ...NO_NEARS, quarterExit: true })).toEqual({ kind: "leave" });
    expect(standingAt({ id: "quarter" }, NO_NEARS)).toEqual({ kind: "none" });
    // The drill post and the Siege Field's gate still beat the arch when two are in reach (they stand far apart).
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, drill: true, quarterGate: true })).toEqual({ kind: "drill" });
    expect(standingAt({ id: "courtyard" }, { ...NO_NEARS, siegeGate: true, quarterGate: true })).toEqual({ kind: "siegeGate" });
  });

  it("opens from ?at=quarter", () => {
    expect(placeFromSearch("?at=quarter")).toEqual({ id: "quarter" });
    expect(searchFor({ id: "quarter" })).toBe("?at=quarter");
  });

  it("has a name plate, a tab title and an arch line in game voice", () => {
    expect(areaLine({ id: "quarter" })).toBe("The Market Quarter");
    expect(areaName({ id: "quarter" })).toBe("Market Quarter");
    expect(QUARTER_WORDS.gatePrompt).toMatch(/^Press E /);
    expect(archLine(null)).toBeNull();
    expect(archLine({ total: 0, inRange: 0 })).toBe("No stalls yet");
    expect(archLine({ total: 1, inRange: 0 })).toBe("1 stall, 0 in range");
    expect(archLine({ total: 12, inRange: 3 })).toBe("12 stalls, 3 in range");
  });

  it("uses no buy or sell words and no red or green", () => {
    const all = JSON.stringify(QUARTER_WORDS).toLowerCase();
    expect(all).not.toMatch(/\b(buy|sell|sale|bargain|deal|offer)\b/);
    const src = readFileSync(join(__dirname, "MarketQuarter.tsx"), "utf8").toLowerCase();
    expect(src).not.toMatch(/#(f00|ff0000|0f0|00ff00)\b|\bred\b|\bgreen\b/);
  });
});
