/**
 * The inside of the Royal Mint (3D, 2026-11-15, issue #413). Pure data and maths, no three.js and no React.
 *
 * A stone room with a lever wall (north), a coin press (middle), a span post (west) and a result wall (east). The levers
 * come from the backend's ledger (`GET /game/printer/ledger`), so a new lever becomes a new lever on the wall. Pulling one is
 * choosing a notch; STAMP sends the pulled notches to `GET /game/printer` and the answer is printed on the plates.
 *
 * **Every number on a plate is the backend's own.** This file places things, picks words and chooses which of the backend's
 * fields to print; it adds, converts and rounds no money and no percentage (CLAUDE.md Rule 1). The one bit of arithmetic is the
 * ladder of notch sizes: the sizes this room *asks* for, taken from each lever's own min and max, which the backend then
 * validates and runs. A NOK range is printed only when the backend says `show_amount`; otherwise the plate says a direction
 * and a reason, never a figure.
 *
 * Local coordinates: x east, z south, y up, the room centred on the origin. The Town is not drawn while you are in here.
 */
import { formatNok } from "../lib/format";
import type { PrinterHolding, PrinterLever, PrinterPull, PrinterRange, PrinterResult } from "../lib/types";
import { MINT_WORDS } from "./mintWordsV1";
import { BUILDINGS, stepOutOf } from "./townPlan";

export const MINT = { minX: -8, maxX: 8, minZ: -9, maxZ: 9, height: 6.5 } as const;
/** A closed pair of doors in the south wall; E beside it leads back out onto the road. */
export const MINT_DOOR = { x: 0, z: MINT.maxZ, width: 3.2 } as const;
/** Far enough in that the follow camera (about 6 behind) is still inside the south wall. */
export const MINT_SPAWN = { x: 0, y: 1.5, z: 4 } as const;
/** Camera yaw 0 puts the hero looking north, toward the lever wall. */
export const MINT_YAW = 0;
/** Camera yaw that looks east, at the result wall: the camera stands west of the hero (yaw 0 is north, a quarter turn the other way is east). */
export const MINT_RESULT_YAW = -Math.PI / 2;
/** Camera pitch for that view: low enough that the top row of plates (y 4.3) stays inside the 60 degree view from the press. */
export const MINT_RESULT_PITCH = 0.3;
/** How fast the camera turns to the result wall when you stamp, per second. */
export const MINT_TURN_RATE = 6;

export const MINT_DOOR_RANGE = 3.4;
export const MINT_DOOR_LEAVE_RANGE = 4.6;

/** Where you stand to work a lever: in front of the north wall. */
export const LEVER_Z = -6.4;
export const LEVER_RANGE = 1.5;
export const LEVER_LEAVE_RANGE = 1.9;
/** Most levers the wall has room for: the wall is 16 wide and the levers stand 2.8 apart, so six fit with a metre to spare (a lever beyond this is counted, never stacked). */
export const LEVER_CAPACITY = 6;
const LEVER_SPACING = 2.8;

/** The coin press, in the middle of the room: E stamps. */
export const PRESS_SPOT = { x: 0, z: -1.6 } as const;
export const PRESS_RANGE = 2.2;
export const PRESS_LEAVE_RANGE = 2.8;

/** The span post (1 or 3 years), west of the press. */
export const SPAN_SPOT = { x: -5.4, z: 1.2 } as const;
export const SPAN_RANGE = 1.8;
export const SPAN_LEAVE_RANGE = 2.4;

/** The ledger lectern in the south-east corner: E opens the plain list. */
export const BOOK_SPOT = { x: 5.6, z: 6.2 } as const;
export const BOOK_RANGE = 1.8;
export const BOOK_LEAVE_RANGE = 2.4;

export const HORIZONS = [1, 3] as const;
export const DEFAULT_HORIZON = 1;

export interface LeverPlan {
  key: string;
  name: string;
  /** Where the lever stands against the north wall, and where you stand to work it. */
  x: number;
  spotX: number;
  spotZ: number;
}

/** One lever on the wall for each lever the ledger lists, centred, evenly spaced. A lever beyond capacity is not placed. */
export function leverLayout(levers: readonly PrinterLever[]): { plans: LeverPlan[]; more: number } {
  const shown = levers.slice(0, LEVER_CAPACITY);
  const n = shown.length;
  const plans = shown.map((l, i) => {
    const x = (i - (n - 1) / 2) * LEVER_SPACING;
    return { key: l.key, name: l.name, x, spotX: x, spotZ: LEVER_Z };
  });
  return { plans, more: levers.length - shown.length };
}

/**
 * A solid block under each lever, so the hero walks round it and not through it. Half-sizes and the centre match the iron base
 * `MintRoom` draws (0.9 wide, 0.9 tall, 0.5 deep, standing 0.4 off the north wall); a pure function so a test can hold the two together.
 */
export const LEVER_BASE = { halfX: 0.45, halfY: 0.45, halfZ: 0.25, offWall: 0.4 } as const;
export function leverBaseCollider(x: number): { position: [number, number, number]; half: [number, number, number] } {
  return { position: [x, LEVER_BASE.halfY, MINT.minZ + LEVER_BASE.offWall], half: [LEVER_BASE.halfX, LEVER_BASE.halfY, LEVER_BASE.halfZ] };
}

/** True when the camera already looks roughly at the result wall (within about 20 degrees sideways and not steeply up or down), so a stamp does not turn it again. */
export function facesResultWall(from: { yaw: number; pitch: number }): boolean {
  const twoPi = Math.PI * 2;
  let d = (MINT_RESULT_YAW - from.yaw) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return Math.abs(d) < 0.35 && Math.abs(from.pitch - MINT_RESULT_PITCH) < 0.3;
}

/**
 * One step of the camera turning to the result wall: yaw the shortest way to `MINT_RESULT_YAW` and pitch down to
 * `MINT_RESULT_PITCH`, never past either. With less motion asked for it jumps. Returns the new angles and whether it has arrived.
 */
export function turnToResultWall(from: { yaw: number; pitch: number }, dt: number, reduced: boolean): { yaw: number; pitch: number; done: boolean } {
  const twoPi = Math.PI * 2;
  let dy = (MINT_RESULT_YAW - from.yaw) % twoPi;
  if (dy > Math.PI) dy -= twoPi;
  if (dy < -Math.PI) dy += twoPi;
  const dp = MINT_RESULT_PITCH - from.pitch;
  if (reduced || (Math.abs(dy) < 0.01 && Math.abs(dp) < 0.01)) return { yaw: MINT_RESULT_YAW, pitch: MINT_RESULT_PITCH, done: true };
  const k = 1 - Math.exp(-MINT_TURN_RATE * dt);
  return { yaw: from.yaw + dy * k, pitch: from.pitch + dp * k, done: false };
}

/** The lever you stand at, or null. The one you already hold keeps the wider leave range. */
export function nearestLever(pos: { x: number; z: number }, plans: readonly LeverPlan[], held: string | null): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const p of plans) {
    const reach = held === p.key ? LEVER_LEAVE_RANGE : LEVER_RANGE;
    const d = Math.hypot(p.spotX - pos.x, p.spotZ - pos.z);
    if (d <= reach && d < bestD) {
      best = p.key;
      bestD = d;
    }
  }
  return best;
}

/** One notch of a lever: the size sent to the backend, the variant, and the words. */
export interface Notch {
  size: string;
  variant: string;
  label: string;
}

const clean = (n: number): string => String(Number(n.toFixed(2)));

/**
 * The notches of a lever, from its own limits in the ledger: a signed lever (it can go either way) gets its full and half
 * pulls each way; an upward-only lever gets a quarter, a half and the full. A lever with several variants repeats the ladder for
 * each. Index -1 (not in this list) means at rest. The backend still validates every size.
 */
export function notches(lever: Pick<PrinterLever, "key" | "size_min" | "size_max" | "variants">): Notch[] {
  const min = Number(lever.size_min);
  const max = Number(lever.size_max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const sizes = min < 0 ? [min, min / 2, max / 2, max] : [max / 4, max / 2, max];
  const variants = lever.variants.length > 0 ? lever.variants : ["default"];
  const words = MINT_WORDS.notch[lever.key];
  return variants.flatMap((variant) =>
    sizes.map((s) => {
      const base = words ? words(Number(clean(s))) : `Pull to ${clean(s)}`;
      const extra = variants.length > 1 ? ` (${MINT_WORDS.variant[variant] ?? variant})` : "";
      return { size: clean(s), variant, label: `${base}${extra}` };
    }),
  );
}

/** How far a lever's arm leans for a notch, in radians: 0 at rest, toward the notch's own sign, full lean at the lever's own limit. A picture, never a figure. */
export function leverTilt(lever: Pick<PrinterLever, "key" | "size_min" | "size_max" | "variants">, index: number): number {
  if (index < 0) return 0;
  const n = notches(lever)[index];
  if (!n) return 0;
  const extent = Math.max(Math.abs(Number(lever.size_min)), Math.abs(Number(lever.size_max)));
  if (!Number.isFinite(extent) || extent === 0) return 0;
  return Math.max(-1, Math.min(1, Number(n.size) / extent)) * LEVER_MAX_TILT;
}
export const LEVER_MAX_TILT = 0.9;

/** The next notch after `current` (-1 = at rest): through every notch once, then back to rest. */
export function nextNotch(current: number, count: number): number {
  if (count <= 0) return -1;
  return current + 1 >= count ? -1 : current + 1;
}

/** The lever state of the whole wall: lever key to notch index; a lever missing from the map is at rest. */
export type LeverState = Readonly<Record<string, number>>;

/** The pulls to send, in ledger order. A lever at rest is not sent. */
export function pullsFrom(levers: readonly PrinterLever[], state: LeverState): PrinterPull[] {
  const out: PrinterPull[] = [];
  for (const l of levers) {
    const i = state[l.key] ?? -1;
    if (i < 0) continue;
    const n = notches(l)[i];
    if (n) out.push({ lever: l.key, size: n.size, variant: n.variant });
  }
  return out;
}

/** The words for the notch a lever is at. */
export function leverReadout(lever: PrinterLever, index: number): string {
  if (index < 0) return MINT_WORDS.leverOff;
  return notches(lever)[index]?.label ?? MINT_WORDS.leverOff;
}

/** A stable text for a set of pulls and a span, to tell whether the wall's answer still matches the levers. */
export function pullKey(pulls: readonly PrinterPull[], horizon: number): string {
  return `${horizon}|${pulls.map((p) => `${p.lever}:${p.size}:${p.variant}`).join(",")}`;
}

// --- The wall --------------------------------------------------------------------------------------------------------------

/** What a plate stands for. */
export type PlateMark = "up" | "leans_up" | "unclear" | "leans_down" | "down" | "unmodelled";

export interface PlateText {
  key: string;
  /** The big line: the holding's name (or "Whole book"). */
  name: string;
  /** Direction word and mark, or "Not modelled". */
  verdict: string;
  mark: PlateMark;
  /** Short lines under it: the plain and after-inflation ranges when the backend allowed them, or the reason. */
  lines: string[];
  /** True when the backend allowed a NOK figure for this plate. */
  amount: boolean;
}

const MARKS = new Set<PlateMark>(["up", "leans_up", "unclear", "leans_down", "down"]);
const markOf = (direction: string): PlateMark => (MARKS.has(direction as PlateMark) ? (direction as PlateMark) : "unclear");

const nokRange = (r: PrinterRange): string => `${formatNok(r.low)} to ${formatNok(r.high)}`;

function lines(
  amount: boolean,
  nok: PrinterRange | null,
  realNok: PrinterRange | null,
  why: string,
): string[] {
  const out: string[] = [];
  if (amount && nok) {
    out.push(`${MINT_WORDS.plain}: ${nokRange(nok)}`);
    if (realNok) out.push(`${MINT_WORDS.real}: ${nokRange(realNok)}`);
  } else {
    out.push(MINT_WORDS.directionOnly);
  }
  if (why) out.push(why);
  return out;
}

/** One holding's plate. A NOK range is printed only when `show_amount` is true and the backend sent one. */
export function holdingPlate(h: PrinterHolding): PlateText {
  if (h.status !== "modelled") {
    return {
      key: h.holding_id,
      name: h.name,
      verdict: MINT_WORDS.notModelled,
      mark: "unmodelled",
      lines: h.reason ? [h.reason] : [],
      amount: false,
    };
  }
  const mark = markOf(h.direction);
  const amount = h.show_amount && h.nok !== null;
  return {
    key: h.holding_id,
    name: h.name,
    verdict: `${MINT_WORDS.mark[mark]} ${MINT_WORDS.direction[mark] ?? MINT_WORDS.direction.unclear}`,
    mark,
    lines: lines(amount, h.nok, h.real_nok, h.why),
    amount,
  };
}

/** The whole-book plate, from the backend's own portfolio fields. Null when there is no result. */
export function bookPlate(r: PrinterResult): PlateText {
  const mark = markOf(r.portfolio_direction);
  const amount = r.show_portfolio_amount && r.portfolio_nok !== null;
  return {
    key: "book",
    name: MINT_WORDS.portfolio,
    verdict: `${MINT_WORDS.mark[mark]} ${MINT_WORDS.direction[mark] ?? MINT_WORDS.direction.unclear}`,
    mark,
    lines: lines(amount, r.portfolio_nok, r.portfolio_real_nok, ""),
    amount,
  };
}

/** Result plates on the east wall: two rows of columns, biggest swing first (the backend's order). */
export const PLATE_ROWS = [4.3, 2.3] as const;
export const PLATE_COLUMNS = 6;
export const PLATE_GAP = 2.6;
export const PLATE_CAPACITY = PLATE_ROWS.length * PLATE_COLUMNS;

export interface PlateSlot {
  x: number;
  y: number;
  z: number;
  /** Rotation about y so the plate looks into the room (the east wall faces west). */
  yaw: number;
}

export function plateSlot(index: number): PlateSlot {
  const row = Math.floor(index / PLATE_COLUMNS);
  const col = index % PLATE_COLUMNS;
  const z = (col - (PLATE_COLUMNS - 1) / 2) * PLATE_GAP;
  return { x: MINT.maxX - 0.08, y: PLATE_ROWS[row] ?? PLATE_ROWS[0], z, yaw: -Math.PI / 2 };
}

/** The holdings that get a plate (the backend's order), and how many there was no room for. */
export function wallPlates(r: PrinterResult | null): { plates: PlateText[]; more: number } {
  if (!r) return { plates: [], more: 0 };
  const all = r.holdings.map(holdingPlate);
  return { plates: all.slice(0, PLATE_CAPACITY), more: Math.max(0, all.length - PLATE_CAPACITY) };
}

/** What the wall says at the top, by state. */
export type WallState = "empty" | "loading" | "failed" | "stale" | "ready";

/** What state the wall is in: waiting on the press, jammed, bare, showing an answer that no longer matches the levers, or ready. */
export function wallStateOf(status: "idle" | "loading" | "failed", result: PrinterResult | null, stampedKey: string | null, currentKey: string): WallState {
  if (status === "loading") return "loading";
  if (status === "failed") return "failed";
  if (result === null) return "empty";
  return stampedKey === currentKey ? "ready" : "stale";
}

export function wallHeading(state: WallState): string | null {
  switch (state) {
    case "empty":
      return MINT_WORDS.wallEmpty;
    case "loading":
      return MINT_WORDS.wallLoading;
    case "failed":
      return MINT_WORDS.wallFailed;
    case "stale":
      return MINT_WORDS.wallStale;
    case "ready":
      return null;
  }
}

/** How restless the Mint's mood needle sits: the backend's own `wild` flag, nothing worked out here. */
export function moodOf(result: PrinterResult | null, state: WallState): "calm" | "restless" {
  return result?.wild && state !== "empty" ? "restless" : "calm";
}

/** The plain list: the same facts as the plates, as lines of text (the Plain view). */
export function plainLines(result: PrinterResult | null): string[] {
  if (!result) return [MINT_WORDS.wallEmpty];
  const out: string[] = [];
  const book = bookPlate(result);
  out.push(`${book.name}: ${book.verdict}`, ...book.lines.map((l) => `  ${l}`));
  for (const h of result.holdings) {
    const p = holdingPlate(h);
    out.push(`${p.name}: ${p.verdict}`, ...p.lines.map((l) => `  ${l}`));
  }
  for (const w of result.warnings) out.push(w);
  return out;
}

export const pressPrompt = MINT_WORDS.pressPrompt;
export const doorPrompt = MINT_WORDS.doorPrompt;
export const bookPrompt = MINT_WORDS.bookPrompt;

export function nearMintDoor(pos: { x: number; z: number }, range: number = MINT_DOOR_RANGE): boolean {
  return Math.hypot(MINT_DOOR.x - pos.x, MINT_DOOR.z - pos.z) <= range;
}
export function nearPress(pos: { x: number; z: number }, range: number = PRESS_RANGE): boolean {
  return Math.hypot(PRESS_SPOT.x - pos.x, PRESS_SPOT.z - pos.z) <= range;
}
export function nearSpan(pos: { x: number; z: number }, range: number = SPAN_RANGE): boolean {
  return Math.hypot(SPAN_SPOT.x - pos.x, SPAN_SPOT.z - pos.z) <= range;
}
export function nearBook(pos: { x: number; z: number }, range: number = BOOK_RANGE): boolean {
  return Math.hypot(BOOK_SPOT.x - pos.x, BOOK_SPOT.z - pos.z) <= range;
}

/** Where the hero stands on the road, and the camera yaw, when stepping out of the Mint door. */
export function mintExit(): { x: number; z: number; yaw: number } {
  const b = BUILDINGS.find((x) => x.id === "mint");
  if (!b) return { x: 0, z: 0, yaw: 0 };
  return stepOutOf(b);
}
