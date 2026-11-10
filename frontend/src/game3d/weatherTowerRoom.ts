/**
 * The inside of the Weather Tower (3D, 2026-11-08). Pure data and maths, no three.js and no React.
 *
 * One square tower room that shows every macro series the app stores, read from the same call as the flat Macro page
 * (`getMacroIndicators`). One dial for each series, laid out from the catalogue rather than placed by hand, so a new series
 * in the catalogue becomes a new dial: Norway on the west wall, the United States on the east wall, the computed gaps on
 * the north wall. In the middle a brass rail has one post for each point on Norway's own curve (3 months to 10 years).
 *
 * Nothing in the art is a fact. The dials and posts are plain objects; code decides every needle, trace, post height and
 * `stale` tag from the stored numbers. A needle shows where today's value sits between that series' own 24-month low and
 * high (a fact about the series, never a grade: nothing is good or bad here). A series with no reading shows an empty
 * dial with no needle. Every printed number comes from `lib/format.ts`, the same code the Macro page uses.
 *
 * Local coordinates: x east, z south, y up, the room centred on the origin. The Town is not drawn while you are in here.
 */
import { formatIndicatorChange, formatIndicatorValue } from "../lib/format";
import type { MacroIndicator, MacroIndicators } from "../lib/types";
import type { Spot } from "./layout";
import { BUILDINGS, stepOutOf } from "./townPlan";
import { WEATHER_WORDS } from "./weatherTowerWordsV1";

export const TOWER = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, height: 7 } as const;
/** A closed pair of doors in the south wall; E beside it leads back out into the Town. */
export const TOWER_DOOR = { x: 0, z: TOWER.maxZ, width: 3.2 } as const;
/** Far enough in that the follow camera (about 6 behind) is still inside the south wall. */
export const TOWER_SPAWN = { x: 0, y: 1.5, z: 5 } as const;
/** Camera yaw 0 puts the hero looking north, toward the dials on the north wall. */
export const TOWER_YAW = 0;

/** The flat page this room opens in the world panel (the Town Hall's "Wide Weather" board opens the same one). */
export const MACRO_ROUTE = "/macro";

export const TOWER_DOOR_RANGE = 3.4;
export const TOWER_DOOR_LEAVE_RANGE = 4.6;
/** Where you stand to read the weather page: in front of the north wall, behind the rail. */
export const DIALS_SPOT: Spot = { x: 0, z: -5.5 };
export const DIALS_RANGE = 3.6;
export const DIALS_LEAVE_RANGE = 4.8;
/** How close a dial must be for its readout to show. */
export const READOUT_RANGE = 2.6;
export const READOUT_LEAVE_RANGE = 3.4;

export const DIAL_RADIUS = 0.8;
/** The needle sweeps this far each side of straight up: low on the left, high on the right. */
export const NEEDLE_SWEEP = (2 * Math.PI) / 3;

/** The points on Norway's curve, short to long, with the short name the rail shows. */
export const CURVE_TENORS = [
  { key: "no_3m_bill", tenor: "3M" },
  { key: "no_6m_bill", tenor: "6M" },
  { key: "no_12m_bill", tenor: "12M" },
  { key: "no_3y", tenor: "3Y" },
  { key: "no_5y", tenor: "5Y" },
  { key: "no_7y", tenor: "7Y" },
  { key: "no_10y", tenor: "10Y" },
] as const;
const CURVE_KEYS: readonly string[] = CURVE_TENORS.map((c) => c.key);

/** Reading order inside a wall: these first, in this order; any series not listed follows in catalogue order. */
const ORDER = [
  ...CURVE_KEYS,
  "no_policy_rate",
  "no_nowa",
  "no_cpi_yoy",
  "usd_nok",
  "eur_nok",
  "us_fed_funds_upper",
  "us_10y",
  "us_10y_2y",
  "us_hy_spread",
  "us_cpi_yoy",
  "us_unemployment",
];

export type Wall = "west" | "east" | "north";

/** Rows from eye level up; columns along the wall. A series beyond the last slot is counted, not drawn. */
export const ROW_YS = [1.7, 3.6, 5.5] as const;
export const COLUMNS = 8;
export const COLUMN_GAP = 2.2;
export const CAPACITY_PER_WALL = ROW_YS.length * COLUMNS;

export type DialState = "ok" | "stale" | "empty";

export interface DialPlan {
  key: string;
  label: string;
  wall: Wall;
  /** Centre of the dial face. */
  x: number;
  y: number;
  z: number;
  /** Which way the dial faces (rotation about y): local +z turned to look into the room. */
  yaw: number;
  state: DialState;
  /** Needle rotation about the dial's own axis, or null when there is no honest place to point (no reading, or no history). */
  needle: number | null;
  /** The 24-month trace as [x, y] offsets from the dial's trace origin, left to right; empty when there is none to draw. */
  trace: Array<[number, number]>;
  /** The lines shown when you stand at the dial: name, value, changes, `stale`. */
  readout: string[];
}

export interface TowerLayout {
  dials: DialPlan[];
  /** Series the walls had no slot for: counted here, never drawn. */
  more: number;
}

const num = (s: string | null): number | null => {
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Where today's value sits between the series' own low and high over the stored history: 0 = low, 1 = high. */
export function rangeFraction(snap: Pick<MacroIndicator, "value" | "history">): number | null {
  const value = num(snap.value);
  if (value === null) return null;
  const values = snap.history.map((p) => num(p.value)).filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const lo = Math.min(value, ...values);
  const hi = Math.max(value, ...values);
  if (hi === lo) return 0.5;
  return (value - lo) / (hi - lo);
}

/** Needle rotation for a fraction: low = left (positive turn seen from the front), high = right. Null in, null out. */
export function needleAngle(fraction: number | null): number | null {
  if (fraction === null) return null;
  const f = Math.min(1, Math.max(0, fraction));
  return (0.5 - f) * 2 * NEEDLE_SWEEP;
}

/** The trace under a dial: the stored monthly history scaled to a box `w` wide and `h` tall, in time order. */
export function tracePoints(snap: Pick<MacroIndicator, "value" | "history">, w = 1.5, h = 0.5): Array<[number, number]> {
  const values = snap.history.map((p) => num(p.value)).filter((v): v is number => v !== null);
  if (values.length < 2) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v, i) => [-w / 2 + (i / (values.length - 1)) * w, hi === lo ? h / 2 : ((v - lo) / (hi - lo)) * h]);
}

export function dialState(snap: Pick<MacroIndicator, "value" | "stale">): DialState {
  if (snap.value === null) return "empty";
  return snap.stale ? "stale" : "ok";
}

/** The words shown at a dial: the flat page's own formatting, nothing re-worked. */
export function dialReadout(snap: MacroIndicator): string[] {
  const lines = [snap.label];
  if (snap.value === null) {
    lines.push(WEATHER_WORDS.noReading);
    return lines;
  }
  lines.push(`${formatIndicatorValue(snap)}${snap.stale ? ` (${WEATHER_WORDS.stale})` : ""}`);
  const changes: string[] = [];
  if (snap.change_3m !== null) changes.push(`${WEATHER_WORDS.threeMonths} ${formatIndicatorChange(snap.change_3m, snap.change_kind)}`);
  if (snap.change_12m !== null) changes.push(`${WEATHER_WORDS.twelveMonths} ${formatIndicatorChange(snap.change_12m, snap.change_kind)}`);
  if (changes.length > 0) lines.push(changes.join("  "));
  return lines;
}

function wallOf(snap: MacroIndicator): Wall {
  if (snap.derived || snap.group === "derived") return "north";
  return snap.region === "US" ? "east" : "west";
}

/** Eye-level row for the curve (Norway) and for rates and credit (US); everything else sits on the row above. */
function preferredRow(snap: MacroIndicator, wall: Wall): number {
  if (wall === "west") return CURVE_KEYS.includes(snap.key) ? 0 : 1;
  if (wall === "east") return snap.group === "rates" || snap.group === "credit" ? 0 : 1;
  return 0;
}

function rank(key: string): number {
  const i = ORDER.indexOf(key);
  return i === -1 ? ORDER.length : i;
}

/**
 * The face position of column `col`, row `row` on a wall. The side walls run north to south; the north wall's row is centred.
 * Each row up is shifted along the wall by a third of a column, so no two dials share a place on the floor and the readout
 * of every dial, high or low, is reached by walking along the wall.
 */
export function wallSlot(wall: Wall, row: number, col: number, count: number): { x: number; y: number; z: number; yaw: number } {
  const y = ROW_YS[row];
  const shift = (row * COLUMN_GAP) / 3;
  if (wall === "north") {
    const x = (col - (count - 1) / 2) * COLUMN_GAP * 1.3 + (row > 0 ? shift : 0);
    return { x, y, z: TOWER.minZ + 0.12, yaw: 0 };
  }
  const z = TOWER.minZ + 2 + col * COLUMN_GAP + shift;
  return wall === "west"
    ? { x: TOWER.minX + 0.12, y, z, yaw: Math.PI / 2 }
    : { x: TOWER.maxX - 0.12, y, z, yaw: -Math.PI / 2 };
}

/**
 * Turns the stored series into dials. Pure and driven only by what the call returned: no series is invented, a series
 * with no reading still gets its (empty) dial so a gap is visible, and the order is stable from one read to the next.
 */
export function towerLayout(macro: Pick<MacroIndicators, "indicators" | "derived"> | null | undefined): TowerLayout {
  if (!macro) return { dials: [], more: 0 };
  const all = [...macro.indicators, ...macro.derived];
  const byWall: Record<Wall, MacroIndicator[]> = { west: [], east: [], north: [] };
  for (const snap of all) byWall[wallOf(snap)].push(snap);
  const dials: DialPlan[] = [];
  let more = 0;
  for (const wall of ["west", "east", "north"] as const) {
    const items = byWall[wall]
      .map((snap, i) => ({ snap, i }))
      .sort((a, b) => rank(a.snap.key) - rank(b.snap.key) || a.i - b.i)
      .map((x) => x.snap);
    const rows: MacroIndicator[][] = ROW_YS.map(() => []);
    for (const snap of items) {
      const want = preferredRow(snap, wall);
      // The preferred row first, then the rows above it, then the ones below: a full row never costs a dial its place.
      let row = -1;
      for (let step = 0; step < rows.length; step += 1) {
        const candidate = (want + step) % rows.length;
        if (rows[candidate].length < COLUMNS) {
          row = candidate;
          break;
        }
      }
      if (row === -1) {
        more += 1;
        continue;
      }
      rows[row].push(snap);
    }
    rows.forEach((row, r) =>
      row.forEach((snap, c) => {
        const fraction = rangeFraction(snap);
        dials.push({
          key: snap.key,
          label: snap.label,
          wall,
          ...wallSlot(wall, r, c, row.length),
          state: dialState(snap),
          needle: needleAngle(fraction),
          trace: tracePoints(snap),
          readout: dialReadout(snap),
        });
      }),
    );
  }
  return { dials, more };
}

/** The middle rail: one post per curve point that has a reading. Height is the yield itself on a fixed scale, so two reads compare. */
export const RAIL = { z: 0, minX: -4.8, maxX: 4.8, metresPerPercent: 0.5, maxHeight: 4 } as const;

export interface RailPost {
  key: string;
  tenor: string;
  x: number;
  /** The post's drawn height: yield (in %) times `metresPerPercent`, capped so it stays inside the room. */
  height: number;
  /** The yield as the Macro page prints it. */
  text: string;
  stale: boolean;
}

export function curvePosts(macro: Pick<MacroIndicators, "indicators"> | null | undefined): RailPost[] {
  if (!macro) return [];
  const present = CURVE_TENORS.map((c) => ({ c, snap: macro.indicators.find((i) => i.key === c.key) })).filter(
    (x): x is { c: (typeof CURVE_TENORS)[number]; snap: MacroIndicator } => x.snap !== undefined && num(x.snap.value) !== null,
  );
  if (present.length === 0) return [];
  const step = (RAIL.maxX - RAIL.minX) / (CURVE_TENORS.length - 1);
  return present.map(({ c, snap }) => {
    const index = CURVE_TENORS.findIndex((t) => t.key === c.key);
    const value = num(snap.value) ?? 0;
    return {
      key: c.key,
      tenor: c.tenor,
      x: RAIL.minX + index * step,
      height: Math.min(RAIL.maxHeight, Math.max(0.1, value * RAIL.metresPerPercent)),
      text: formatIndicatorValue(snap),
      stale: snap.stale,
    };
  });
}

/** How many dials are reading (have a value), out of how many are drawn. Unknown (not read yet) is null. */
export function towerFacts(macro: Pick<MacroIndicators, "indicators" | "derived"> | null | undefined): { reading: number; total: number; more: number } | null {
  if (!macro) return null;
  const { dials, more } = towerLayout(macro);
  return { reading: dials.filter((d) => d.state !== "empty").length, total: dials.length, more };
}

/** The words on the plate over the north wall: short and playful, numbers exact. Not read yet says nothing extra. */
export function towerPlate(facts: ReturnType<typeof towerFacts>): string[] {
  const lines: string[] = [WEATHER_WORDS.title];
  if (facts === null) return lines;
  if (facts.total === 0) {
    lines.push(WEATHER_WORDS.nothingYet);
    return lines;
  }
  lines.push(WEATHER_WORDS.reading(facts.reading, facts.total));
  if (facts.more > 0) lines.push(WEATHER_WORDS.more(facts.more));
  return lines;
}

/** The dial nearest to `pos` within `range`, or null. */
export function nearestDial(pos: { x: number; z: number }, dials: readonly DialPlan[], range: number = READOUT_RANGE): DialPlan | null {
  let best: DialPlan | null = null;
  let bestD = range;
  for (const d of dials) {
    const dist = Math.hypot(d.x - pos.x, d.z - pos.z);
    // On a tie the lower dial wins, so the answer never depends on the order of the list.
    if (dist < bestD || (dist === bestD && best !== null && d.y < best.y) || (dist <= bestD && best === null)) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

export function nearDials(pos: { x: number; z: number }, range: number = DIALS_RANGE): boolean {
  return Math.hypot(DIALS_SPOT.x - pos.x, DIALS_SPOT.z - pos.z) <= range;
}

export function nearTowerDoor(pos: { x: number; z: number }, range: number = TOWER_DOOR_RANGE): boolean {
  return Math.hypot(TOWER_DOOR.x - pos.x, TOWER_DOOR.z - pos.z) <= range;
}

export const dialsPrompt = WEATHER_WORDS.dialsPrompt;
export const towerDoorPrompt = WEATHER_WORDS.doorPrompt;

/** Where the hero stands on the meadow, and the camera yaw, when stepping out of the Weather Tower door. */
export function towerExit(): { x: number; z: number; yaw: number } {
  const b = BUILDINGS.find((x) => x.id === "weather");
  if (!b) return { x: 0, z: 0, yaw: 0 };
  return stepOutOf(b);
}
