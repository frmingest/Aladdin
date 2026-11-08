import { describe, expect, it } from "vitest";
import { formatIndicatorChange, formatIndicatorValue } from "../lib/format";
import type { MacroIndicator } from "../lib/types";
import { AREAS, pathToCourtyard, transitionSpot } from "./areas";
import { BUILDINGS, DOOR_RANGE, doorSpot, nearestBuilding } from "./townPlan";
import {
  CAPACITY_PER_WALL,
  COLUMNS,
  CURVE_TENORS,
  DIALS_RANGE,
  DIALS_SPOT,
  RAIL,
  ROW_YS,
  TOWER,
  TOWER_DOOR,
  TOWER_DOOR_RANGE,
  TOWER_SPAWN,
  curvePosts,
  dialReadout,
  dialState,
  nearDials,
  nearTowerDoor,
  nearestDial,
  needleAngle,
  rangeFraction,
  towerExit,
  towerFacts,
  towerLayout,
  towerPlate,
  tracePoints,
  wallSlot,
} from "./weatherTowerRoom";
import { WEATHER_WORDS } from "./weatherTowerWordsV1";

const HISTORY = ["3.00", "3.50", "4.00", "4.50", "5.00"].map((value, i) => ({ date: `2025-0${i + 1}-28`, value }));

function snap(over: Partial<MacroIndicator> & { key: string }): MacroIndicator {
  return {
    label: over.key,
    region: "NO",
    group: "rates",
    display_unit: "%",
    frequency: "daily",
    change_kind: "pp",
    description: "",
    source_name: "Norges Bank",
    source_series_id: "X",
    source_url: "",
    derived: false,
    value: "4.00",
    observed_on: "2026-11-06",
    value_3m_ago: "3.75",
    change_3m: "0.25",
    value_12m_ago: "4.50",
    change_12m: "-0.50",
    stale: false,
    age_days: 2,
    formula: null,
    last_success_at: null,
    last_error: null,
    history: HISTORY,
    ...over,
  };
}

const NO_KEYS = ["no_policy_rate", "no_nowa", "no_3m_bill", "no_6m_bill", "no_12m_bill", "no_3y", "no_5y", "no_7y", "no_10y", "usd_nok", "eur_nok", "no_cpi_yoy"];
const US_KEYS = ["us_fed_funds_upper", "us_10y", "us_10y_2y", "us_cpi_yoy", "us_unemployment", "us_hy_spread"];
const GROUPS: Record<string, string> = { usd_nok: "fx", eur_nok: "fx", no_cpi_yoy: "inflation", us_cpi_yoy: "inflation", us_unemployment: "labour", us_hy_spread: "credit" };

function fullMacro() {
  const indicators = [
    ...NO_KEYS.map((key) => snap({ key, group: GROUPS[key] ?? "rates", region: "NO" })),
    ...US_KEYS.map((key) => snap({ key, group: GROUPS[key] ?? "rates", region: "US" })),
  ];
  const derived = ["no_real_policy_rate", "us_real_policy_rate", "no_us_10y_spread", "no_curve_10y_3m"].map((key) =>
    snap({ key, group: "derived", derived: true, display_unit: "pp", frequency: "computed" }),
  );
  return { indicators, derived };
}

describe("the Weather Tower layout", () => {
  it("gives every stored series exactly one dial, once", () => {
    const m = fullMacro();
    const { dials, more } = towerLayout(m);
    expect(more).toBe(0);
    expect(dials.map((d) => d.key).sort()).toEqual([...m.indicators, ...m.derived].map((s) => s.key).sort());
  });

  it("puts Norway on the west wall, the United States on the east wall and the computed gaps on the north wall", () => {
    const { dials } = towerLayout(fullMacro());
    const wall = (key: string) => dials.find((d) => d.key === key)?.wall;
    for (const k of NO_KEYS) expect(wall(k), k).toBe("west");
    for (const k of US_KEYS) expect(wall(k), k).toBe("east");
    for (const k of ["no_real_policy_rate", "us_real_policy_rate", "no_us_10y_spread", "no_curve_10y_3m"]) expect(wall(k), k).toBe("north");
  });

  it("shows nothing when nothing has been read, and never invents a dial", () => {
    expect(towerLayout(null)).toEqual({ dials: [], more: 0 });
    expect(towerLayout(undefined).dials).toHaveLength(0);
    expect(towerLayout({ indicators: [], derived: [] }).dials).toHaveLength(0);
  });

  it("runs Norway's curve along the eye-level row in maturity order", () => {
    const { dials } = towerLayout(fullMacro());
    const curve = CURVE_TENORS.map((c) => dials.find((d) => d.key === c.key)!);
    expect(new Set(curve.map((d) => d.y))).toEqual(new Set([ROW_YS[0]]));
    const zs = curve.map((d) => d.z);
    expect([...zs].sort((a, b) => a - b)).toEqual(zs);
  });

  it("keeps every dial inside the room, on its wall, and no two on the same spot", () => {
    const { dials } = towerLayout(fullMacro());
    const seen = new Set<string>();
    for (const d of dials) {
      expect(d.x, d.key).toBeGreaterThanOrEqual(TOWER.minX);
      expect(d.x, d.key).toBeLessThanOrEqual(TOWER.maxX);
      expect(d.z, d.key).toBeGreaterThanOrEqual(TOWER.minZ);
      expect(d.z, d.key).toBeLessThanOrEqual(TOWER.maxZ);
      expect(d.y, d.key).toBeLessThan(TOWER.height);
      const spot = `${d.x.toFixed(2)},${d.y.toFixed(2)},${d.z.toFixed(2)}`;
      expect(seen.has(spot), spot).toBe(false);
      seen.add(spot);
    }
  });

  it("never puts two dials of one wall at the same place along it, so every readout can be reached", () => {
    const { dials } = towerLayout(fullMacro());
    for (const wall of ["west", "east", "north"] as const) {
      const along = dials.filter((d) => d.wall === wall).map((d) => (wall === "north" ? d.x : d.z).toFixed(2));
      expect(new Set(along).size, wall).toBe(along.length);
    }
    for (const d of dials) expect(nearestDial({ x: d.x, z: d.z }, dials)?.key, d.key).toBe(d.key);
  });

  it("is stable: the same read gives the same layout", () => {
    expect(towerLayout(fullMacro())).toEqual(towerLayout(fullMacro()));
  });

  it("grows by itself: a series the catalogue adds later gets a dial without a new rule", () => {
    const m = fullMacro();
    m.indicators.push(snap({ key: "no_30y_future", region: "NO", group: "rates" }));
    const { dials, more } = towerLayout(m);
    expect(more).toBe(0);
    expect(dials.some((d) => d.key === "no_30y_future" && d.wall === "west")).toBe(true);
  });

  it("counts series the wall has no slot for instead of drawing them on top of others", () => {
    const m = fullMacro();
    for (let i = 0; i < CAPACITY_PER_WALL; i += 1) m.indicators.push(snap({ key: `no_extra_${i}`, region: "NO" }));
    const { dials, more } = towerLayout(m);
    expect(dials.filter((d) => d.wall === "west")).toHaveLength(CAPACITY_PER_WALL);
    expect(more).toBe(NO_KEYS.length);
    expect(COLUMNS * ROW_YS.length).toBe(CAPACITY_PER_WALL);
  });

  it("slots stand on the right wall facing into the room", () => {
    expect(wallSlot("west", 0, 0, 3).yaw).toBeCloseTo(Math.PI / 2);
    expect(wallSlot("east", 0, 0, 3).yaw).toBeCloseTo(-Math.PI / 2);
    expect(wallSlot("north", 0, 1, 3).yaw).toBe(0);
    expect(wallSlot("north", 0, 1, 3).x).toBeCloseTo(0);
  });
});

describe("what a dial shows", () => {
  it("places the value between the series' own low and high, never as a grade", () => {
    expect(rangeFraction(snap({ key: "a", value: "3.00" }))).toBe(0);
    expect(rangeFraction(snap({ key: "a", value: "5.00" }))).toBe(1);
    expect(rangeFraction(snap({ key: "a", value: "4.00" }))).toBeCloseTo(0.5);
    // A value outside the stored history stretches the range rather than falling off the dial.
    expect(rangeFraction(snap({ key: "a", value: "6.00" }))).toBe(1);
  });

  it("points nowhere when there is no reading or too little history", () => {
    expect(rangeFraction(snap({ key: "a", value: null }))).toBeNull();
    expect(rangeFraction(snap({ key: "a", history: HISTORY.slice(0, 1) }))).toBeNull();
    expect(needleAngle(null)).toBeNull();
  });

  it("sweeps left for low, straight up for the middle and right for high", () => {
    expect(needleAngle(0.5)).toBeCloseTo(0);
    expect(needleAngle(0)!).toBeGreaterThan(0);
    expect(needleAngle(1)!).toBeLessThan(0);
    expect(needleAngle(0)!).toBeCloseTo(-needleAngle(1)!);
    expect(needleAngle(5)).toBe(needleAngle(1));
  });

  it("draws the stored history left to right inside its box, flat when it never moved", () => {
    const pts = tracePoints(snap({ key: "a" }), 1.5, 0.5);
    expect(pts).toHaveLength(HISTORY.length);
    expect(pts[0][0]).toBeCloseTo(-0.75);
    expect(pts[pts.length - 1][0]).toBeCloseTo(0.75);
    expect(pts[0][1]).toBe(0);
    expect(pts[pts.length - 1][1]).toBeCloseTo(0.5);
    const flat = tracePoints(snap({ key: "a", history: HISTORY.map((p) => ({ ...p, value: "4.00" })) }));
    expect(new Set(flat.map((p) => p[1])).size).toBe(1);
    expect(tracePoints(snap({ key: "a", history: [] }))).toEqual([]);
  });

  it("tells state by shape and word: empty, stale or fine", () => {
    expect(dialState(snap({ key: "a" }))).toBe("ok");
    expect(dialState(snap({ key: "a", stale: true }))).toBe("stale");
    expect(dialState(snap({ key: "a", value: null }))).toBe("empty");
    const { dials } = towerLayout({ indicators: [snap({ key: "no_policy_rate", value: null })], derived: [] });
    expect(dials[0].needle).toBeNull();
    expect(dials[0].readout).toEqual(["no_policy_rate", WEATHER_WORDS.noReading]);
  });

  it("prints the readout with the flat Macro page's own formatting and keeps `stale`", () => {
    const s = snap({ key: "no_policy_rate", label: "Norges Bank policy rate", stale: true });
    const lines = dialReadout(s);
    expect(lines[0]).toBe("Norges Bank policy rate");
    expect(lines[1]).toBe(`${formatIndicatorValue(s)} (stale)`);
    expect(lines[2]).toContain(formatIndicatorChange("0.25", "pp"));
    expect(lines[2]).toContain(formatIndicatorChange("-0.50", "pp"));
    const fx = snap({ key: "usd_nok", display_unit: "NOK", value: "10.8123", change_kind: "pct", change_3m: "1.50", change_12m: null });
    expect(dialReadout(fx)[1]).toBe(formatIndicatorValue(fx));
    expect(dialReadout(fx)[2]).toBe(`${WEATHER_WORDS.threeMonths} ${formatIndicatorChange("1.50", "pct")}`);
  });
});

describe("Norway's curve rail", () => {
  it("has one post for each maturity that has a reading, short to long, evenly spaced across the rail", () => {
    const posts = curvePosts(fullMacro());
    expect(posts.map((p) => p.tenor)).toEqual(["3M", "6M", "12M", "3Y", "5Y", "7Y", "10Y"]);
    expect(posts[0].x).toBeCloseTo(RAIL.minX);
    expect(posts[posts.length - 1].x).toBeCloseTo(RAIL.maxX);
    const gaps = posts.slice(1).map((p, i) => p.x - posts[i].x);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]);
  });

  it("sets height from the yield on a fixed scale (so two reads compare) and leaves a gap for a missing maturity", () => {
    const m = fullMacro();
    m.indicators = m.indicators.map((s) => (s.key === "no_5y" ? { ...s, value: null } : s.key === "no_3m_bill" ? { ...s, value: "2.00" } : s));
    const posts = curvePosts(m);
    expect(posts.map((p) => p.tenor)).not.toContain("5Y");
    const three = posts.find((p) => p.tenor === "3M")!;
    const ten = posts.find((p) => p.tenor === "10Y")!;
    expect(three.height).toBeCloseTo(2 * RAIL.metresPerPercent);
    expect(ten.height).toBeCloseTo(4 * RAIL.metresPerPercent);
    // 5Y is missing, but 7Y keeps its own place on the rail.
    expect(posts.find((p) => p.tenor === "7Y")!.x).toBeGreaterThan(posts.find((p) => p.tenor === "3Y")!.x + 1.5);
  });

  it("never grows past the room and says stale on a stale post", () => {
    const m = fullMacro();
    m.indicators = m.indicators.map((s) => (s.key === "no_10y" ? { ...s, value: "30.00", stale: true } : s));
    const ten = curvePosts(m).find((p) => p.tenor === "10Y")!;
    expect(ten.height).toBe(RAIL.maxHeight);
    expect(ten.stale).toBe(true);
    expect(curvePosts(null)).toEqual([]);
    expect(RAIL.maxHeight).toBeLessThan(TOWER.height);
  });
});

describe("the plate and the words", () => {
  it("says nothing extra before the first read, and counts honestly after", () => {
    expect(towerPlate(towerFacts(null))).toEqual([WEATHER_WORDS.title]);
    expect(towerPlate(towerFacts({ indicators: [], derived: [] }))).toEqual([WEATHER_WORDS.title, WEATHER_WORDS.nothingYet]);
    const m = fullMacro();
    m.indicators[0] = { ...m.indicators[0], value: null };
    const facts = towerFacts(m)!;
    expect(facts.total).toBe(22);
    expect(facts.reading).toBe(21);
    expect(towerPlate(facts)[1]).toBe("21 of 22 dials reading");
  });

  it("uses no buy, sell, good or bad words and no picture characters", () => {
    const plain = Object.values(WEATHER_WORDS).flatMap((w) => (typeof w === "string" ? [w] : []));
    const words: string[] = [...plain, WEATHER_WORDS.reading(3, 5), WEATHER_WORDS.more(2)];
    for (const w of words) {
      expect(w).not.toMatch(/\b(buy|sell|trade|invest|good|bad|safe|danger)\b/i);
      expect(w).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("the place", () => {
  it("is a door in the Town, reached from the building's door spot, and leads back to the same spot", () => {
    const b = BUILDINGS.find((x) => x.id === "weather")!;
    expect(b).toBeDefined();
    expect(b.opens).toEqual({ route: "/macro" });
    expect(nearestBuilding(doorSpot(b), BUILDINGS, DOOR_RANGE)).toBe("weather");
    const out = towerExit();
    expect(out.x).toBeCloseTo(doorSpot(b).x);
    expect(out.z).toBeCloseTo(doorSpot(b).z);
    expect(AREAS.town.doors.some((d) => d.to === "weather")).toBe(true);
    expect(AREAS.weather.parent).toBe("town");
    expect(pathToCourtyard("weather")).toEqual(["weather", "town", "courtyard"]);
    expect(transitionSpot({ id: "weather" }, { id: "town" }, [])).toMatchObject({ x: out.x, z: out.z });
  });

  it("stands clear of the other buildings and inside the Town", () => {
    const b = BUILDINGS.find((x) => x.id === "weather")!;
    for (const o of BUILDINGS.filter((x) => x.id !== "weather")) {
      expect(Math.hypot(o.x - b.x, o.z - b.z), o.id).toBeGreaterThan(12);
    }
    expect(Math.hypot(b.x, b.z)).toBeLessThan(44);
  });

  it("starts you away from the dials and the door, with the dials and the door far apart", () => {
    expect(nearDials(TOWER_SPAWN)).toBe(false);
    expect(nearTowerDoor(TOWER_SPAWN)).toBe(false);
    expect(nearTowerDoor(DIALS_SPOT)).toBe(false);
    expect(nearDials(TOWER_DOOR)).toBe(false);
    expect(nearDials({ x: DIALS_SPOT.x, z: DIALS_SPOT.z + DIALS_RANGE - 0.1 })).toBe(true);
    expect(nearTowerDoor({ x: TOWER_DOOR.x, z: TOWER_DOOR.z - TOWER_DOOR_RANGE + 0.1 })).toBe(true);
    expect(DIALS_SPOT.z).toBeLessThan(RAIL.z - 1);
  });

  it("finds the dial you stand beside", () => {
    const { dials } = towerLayout(fullMacro());
    const d = dials[0];
    expect(nearestDial({ x: d.x, z: d.z }, dials)?.key).toBe(d.key);
    expect(nearestDial({ x: 0, z: 8 }, dials)).toBeNull();
  });
});
