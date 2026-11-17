import { describe, expect, it } from "vitest";
import type { PrinterHolding, PrinterLever, PrinterResult } from "../lib/types";
import {
  BOOK_LEAVE_RANGE,
  BOOK_SPOT,
  LEVER_CAPACITY,
  LEVER_LEAVE_RANGE,
  LEVER_MAX_TILT,
  LEVER_Z,
  LEVER_BASE,
  MINT,
  MINT_RESULT_PITCH,
  MINT_RESULT_YAW,
  MINT_DOOR,
  MINT_DOOR_LEAVE_RANGE,
  PLATE_CAPACITY,
  plateCapacityOf,
  plateLayoutFor,
  plateScaleOf,
  PRESS_LEAVE_RANGE,
  PRESS_SPOT,
  SPAN_LEAVE_RANGE,
  SPAN_SPOT,
  bookPlate,
  facesResultWall,
  holdingPlate,
  leverBaseCollider,
  leverLayout,
  leverReadout,
  leverTilt,
  mintExit,
  moodOf,
  nearBook,
  nearMintDoor,
  nearPress,
  nearSpan,
  nearestLever,
  nextNotch,
  notches,
  plainLines,
  plateSlot,
  pullKey,
  pullsFrom,
  turnToResultWall,
  wallHeading,
  wallPlates,
  wallStateOf,
} from "./mintRoom";
import { cameraOffset, MAX_PITCH, MIN_PITCH } from "./movement";
import { cameraPull } from "./cameraRoom";
import { PLATE } from "./weatherTowerRoom";
import { PLATE_PX } from "./weatherPlateArt";
import { MINT_WORDS } from "./mintWordsV1";
import { BUILDINGS, doorSpot } from "./townPlan";

const lever = (key: string, min: string, max: string, variants = ["default"]): PrinterLever => ({
  key,
  name: key.toUpperCase(),
  real_tool: "tool",
  tide: "up",
  unit_label: "units",
  size_min: min,
  size_max: max,
  size_default: "0",
  variants,
});

const TOLL = lever("toll_gate", "-3", "3");
const PRESS = lever("great_press", "0", "10");
const HARBOUR = lever("harbour_guard", "-5", "5", ["sterilised", "unsterilised"]);
const FIVE = ["toll_gate", "great_press", "great_melt", "coin_rain", "harbour_guard"].map((k) => lever(k, "0", "10"));

const range = (low: string, base: string, high: string) => ({ low, base, high });

const holding = (over: Partial<PrinterHolding> = {}): PrinterHolding => ({
  holding_id: "h1",
  ticker: "EQNR",
  name: "Equinor",
  sector: "Energy",
  value_nok: "100000",
  status: "modelled",
  reason: null,
  confidence: "low",
  pct: range("-4", "-2", "0"),
  real_pct: range("-5", "-3", "-1"),
  show_amount: false,
  nok: null,
  real_nok: null,
  direction: "leans_down",
  real_direction: "leans_down",
  why: "Mostly the stock market's own move.",
  terms: [],
  ...over,
});

const result = (over: Partial<PrinterResult> = {}): PrinterResult => ({
  version: "v1",
  banner: "A game of consequences, not a trading signal. Scenario, not forecast.",
  demo: false,
  horizon: 1,
  pulls: [],
  holdings: [holding()],
  portfolio_confidence: "low",
  portfolio_pct: range("-4", "-2", "0"),
  portfolio_real_pct: null,
  show_portfolio_amount: false,
  portfolio_nok: null,
  portfolio_real_nok: null,
  portfolio_direction: "leans_down",
  covered_value_nok: "100000",
  total_value_nok: "100000",
  coverage: "1",
  wild: false,
  warnings: [],
  notes: [],
  ...over,
});

describe("the lever wall", () => {
  it("places one lever for each lever the ledger lists, centred and evenly spaced", () => {
    const { plans, more } = leverLayout(FIVE);
    expect(plans.map((p) => p.key)).toEqual(FIVE.map((l) => l.key));
    expect(more).toBe(0);
    expect(plans.reduce((a, p) => a + p.x, 0)).toBeCloseTo(0, 6);
    for (let i = 1; i < plans.length; i++) expect(plans[i].x - plans[i - 1].x).toBeCloseTo(plans[1].x - plans[0].x, 6);
  });

  it("counts a lever beyond the wall's room instead of stacking it", () => {
    const many = Array.from({ length: LEVER_CAPACITY + 2 }, (_, i) => lever(`l${i}`, "0", "1"));
    const { plans, more } = leverLayout(many);
    expect(plans).toHaveLength(LEVER_CAPACITY);
    expect(more).toBe(2);
  });

  it("keeps every lever inside the room, and no two within each other's reach", () => {
    const { plans } = leverLayout(Array.from({ length: LEVER_CAPACITY }, (_, i) => lever(`l${i}`, "0", "1")));
    for (const p of plans) {
      expect(p.spotX).toBeGreaterThan(MINT.minX + 0.5);
      expect(p.spotX).toBeLessThan(MINT.maxX - 0.5);
    }
    for (let i = 1; i < plans.length; i++) expect(plans[i].spotX - plans[i - 1].spotX).toBeGreaterThan(LEVER_LEAVE_RANGE);
  });

  it("finds the lever you stand at, and holds it out to the wider range", () => {
    const { plans } = leverLayout(FIVE);
    const p = plans[0];
    expect(nearestLever({ x: p.spotX, z: LEVER_Z }, plans, null)).toBe(p.key);
    // Past the end of the wall, with no neighbour: out of the arrival range, still inside the held range.
    expect(nearestLever({ x: p.spotX - 1.7, z: LEVER_Z }, plans, null)).toBeNull();
    expect(nearestLever({ x: p.spotX - 1.7, z: LEVER_Z }, plans, p.key)).toBe(p.key);
    expect(nearestLever({ x: 0, z: 7 }, plans, null)).toBeNull();
  });

  it("picks the nearer lever when two are in reach", () => {
    const { plans } = leverLayout(FIVE);
    const [a, b] = plans;
    expect(nearestLever({ x: a.spotX + 1.45, z: LEVER_Z }, plans, null)).toBe(b.key);
    expect(nearestLever({ x: a.spotX + 0.2, z: LEVER_Z }, plans, null)).toBe(a.key);
  });
});

describe("the notches", () => {
  it("gives a signed lever its full and half pulls each way, in its own limits", () => {
    expect(notches(TOLL).map((n) => n.size)).toEqual(["-3", "-1.5", "1.5", "3"]);
  });

  it("gives an upward-only lever a quarter, a half and the full pull", () => {
    expect(notches(PRESS).map((n) => n.size)).toEqual(["2.5", "5", "10"]);
  });

  it("repeats the ladder for each variant and says which in the words", () => {
    const n = notches(HARBOUR);
    expect(n).toHaveLength(8);
    expect(new Set(n.map((x) => x.variant))).toEqual(new Set(["sterilised", "unsterilised"]));
    expect(n[0].label).toContain(MINT_WORDS.variant.sterilised);
  });

  it("gives no notch for a lever whose limits make no sense, never a guess", () => {
    expect(notches(lever("x", "5", "5"))).toEqual([]);
    expect(notches(lever("x", "nope", "5"))).toEqual([]);
  });

  it("goes through every notch once, then back to rest", () => {
    let i = -1;
    const seen: number[] = [];
    for (let k = 0; k < 5; k++) {
      i = nextNotch(i, 4);
      seen.push(i);
    }
    expect(seen).toEqual([0, 1, 2, 3, -1]);
    expect(nextNotch(-1, 0)).toBe(-1);
  });

  it("sends only the pulled levers, in ledger order, with the notch's own size and variant", () => {
    const pulls = pullsFrom([TOLL, PRESS, HARBOUR], { great_press: 2, toll_gate: 0, harbour_guard: 4 });
    expect(pulls).toEqual([
      { lever: "toll_gate", size: "-3", variant: "default" },
      { lever: "great_press", size: "10", variant: "default" },
      { lever: "harbour_guard", size: "-5", variant: "unsterilised" },
    ]);
    expect(pullsFrom([TOLL], {})).toEqual([]);
    expect(pullsFrom([TOLL], { toll_gate: -1 })).toEqual([]);
  });

  it("says a lever's words at rest and at a notch (no buy or sell word)", () => {
    expect(leverReadout(TOLL, -1)).toBe(MINT_WORDS.leverOff);
    expect(leverReadout(TOLL, 0)).toMatch(/Cut the rate/);
    expect(leverReadout(TOLL, 3)).toMatch(/Raise the rate/);
    for (const l of [TOLL, PRESS, HARBOUR, ...FIVE]) for (let i = -1; i < notches(l).length; i++) expect(leverReadout(l, i)).not.toMatch(/\b(buy|sell|buys|sells)\b/i);
  });

  it("leans the arm toward the notch's own side, never past the limit, and not at all at rest", () => {
    expect(leverTilt(TOLL, -1)).toBe(0);
    expect(leverTilt(TOLL, 0)).toBeCloseTo(-LEVER_MAX_TILT, 6);
    expect(leverTilt(TOLL, 3)).toBeCloseTo(LEVER_MAX_TILT, 6);
    expect(leverTilt(PRESS, 2)).toBeCloseTo(LEVER_MAX_TILT, 6);
    for (let i = 0; i < 8; i++) expect(Math.abs(leverTilt(HARBOUR, i))).toBeLessThanOrEqual(LEVER_MAX_TILT + 1e-9);
    expect(leverTilt(TOLL, 99)).toBe(0);
  });

  it("tells whether an answer still matches the levers", () => {
    const a = pullKey([{ lever: "toll_gate", size: "-3", variant: "default" }], 1);
    expect(pullKey([{ lever: "toll_gate", size: "-3", variant: "default" }], 1)).toBe(a);
    expect(pullKey([{ lever: "toll_gate", size: "-3", variant: "default" }], 3)).not.toBe(a);
    expect(pullKey([{ lever: "toll_gate", size: "3", variant: "default" }], 1)).not.toBe(a);
  });
});

describe("the plates print only what the backend allowed", () => {
  it("prints no NOK figure when the backend gave no amount, even if it sent a range", () => {
    const p = holdingPlate(holding({ show_amount: false, nok: range("-5000", "-2000", "0"), real_nok: range("-6000", "-3000", "-1000") }));
    expect(p.amount).toBe(false);
    expect(p.lines.join(" ")).not.toMatch(/kr/);
    expect(p.lines[0]).toBe(MINT_WORDS.directionOnly);
    expect(p.verdict).toContain(MINT_WORDS.direction.leans_down);
  });

  it("prints plain and after-inflation ranges side by side when the backend allowed them", () => {
    const p = holdingPlate(
      holding({ show_amount: true, confidence: "medium", nok: range("-5000", "-2000", "0"), real_nok: range("-6000", "-3000", "-1000") }),
    );
    expect(p.amount).toBe(true);
    expect(p.lines[0]).toMatch(/^Plain: .*kr to .*kr$/);
    expect(p.lines[1]).toMatch(/^After inflation: .*kr to .*kr$/);
  });

  it("prints no range if the backend says show_amount but sent none", () => {
    const p = holdingPlate(holding({ show_amount: true, nok: null }));
    expect(p.amount).toBe(false);
    expect(p.lines[0]).toBe(MINT_WORDS.directionOnly);
  });

  it("says why a holding is not modelled and prints no direction", () => {
    const p = holdingPlate(holding({ status: "not_modelled", reason: "no beta stored", pct: null, direction: "unclear" }));
    expect(p.mark).toBe("unmodelled");
    expect(p.verdict).toBe(MINT_WORDS.notModelled);
    expect(p.lines).toEqual(["no beta stored"]);
  });

  it("carries the reason (the backend's own words) under the verdict", () => {
    expect(holdingPlate(holding()).lines).toContain("Mostly the stock market's own move.");
  });

  it("gives every direction a mark and a word, so shape and word carry it, never colour", () => {
    for (const d of ["up", "leans_up", "unclear", "leans_down", "down"]) {
      expect(MINT_WORDS.mark[d].length).toBeGreaterThan(0);
      expect(MINT_WORDS.direction[d].length).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(MINT_WORDS.mark)).size).toBe(5);
  });

  it("treats a direction the room does not know as unclear, never as a guess", () => {
    expect(holdingPlate(holding({ direction: "sideways" })).mark).toBe("unclear");
  });

  it("makes the whole-book plate from the backend's portfolio fields, under the same rule", () => {
    const quiet = bookPlate(result({ portfolio_nok: range("-1", "0", "1"), show_portfolio_amount: false }));
    expect(quiet.lines.join(" ")).not.toMatch(/kr/);
    const loud = bookPlate(
      result({ show_portfolio_amount: true, portfolio_nok: range("-9000", "-4000", "0"), portfolio_real_nok: range("-9500", "-4500", "-500"), portfolio_direction: "down" }),
    );
    expect(loud.amount).toBe(true);
    expect(loud.verdict).toContain(MINT_WORDS.direction.down);
    expect(loud.name).toBe(MINT_WORDS.portfolio);
  });

  it("uses no buy or sell word anywhere on the face", () => {
    const all = JSON.stringify(MINT_WORDS) + holdingPlate(holding()).lines.join(" ");
    expect(all).not.toMatch(/\b(buy|sell|invest|trade)\b/i);
  });
});

describe("the wall", () => {
  it("fits a plate for each holding, keeps the backend's order and counts the rest", () => {
    const many = Array.from({ length: PLATE_CAPACITY + 3 }, (_, i) => holding({ holding_id: `h${i}`, name: `N${i}` }));
    const { plates, more } = wallPlates(result({ holdings: many }));
    expect(plates).toHaveLength(PLATE_CAPACITY);
    expect(plates[0].name).toBe("N0");
    expect(more).toBe(3);
    expect(wallPlates(null)).toEqual({ plates: [], more: 0 });
  });

  it("puts every plate slot on the east wall, inside the room, none on top of another", () => {
    const seen = new Set<string>();
    for (let i = 0; i < PLATE_CAPACITY; i++) {
      const s = plateSlot(i);
      expect(s.x).toBeLessThan(MINT.maxX);
      expect(s.x).toBeGreaterThan(MINT.maxX - 0.5);
      expect(s.z).toBeGreaterThan(MINT.minZ);
      expect(s.z).toBeLessThan(MINT.maxZ);
      seen.add(`${s.y}|${s.z}`);
    }
    expect(seen.size).toBe(PLATE_CAPACITY);
  });

  it("says what the wall is waiting for, and nothing when it is ready", () => {
    expect(wallHeading("empty")).toBe(MINT_WORDS.wallEmpty);
    expect(wallHeading("stale")).toBe(MINT_WORDS.wallStale);
    expect(wallHeading("failed")).toBe(MINT_WORDS.wallFailed);
    expect(wallHeading("loading")).toBe(MINT_WORDS.wallLoading);
    expect(wallHeading("ready")).toBeNull();
  });

  it("marks an answer stale the moment the levers or the span no longer match what was stamped", () => {
    const r = result();
    expect(wallStateOf("idle", null, null, "1|")).toBe("empty");
    expect(wallStateOf("idle", r, "1|a", "1|a")).toBe("ready");
    expect(wallStateOf("idle", r, "1|a", "3|a")).toBe("stale");
    expect(wallStateOf("loading", r, "1|a", "1|a")).toBe("loading");
    expect(wallStateOf("failed", r, "1|a", "1|a")).toBe("failed");
  });

  it("follows the backend's own wild flag for the mood, and works nothing out", () => {
    expect(moodOf(result({ wild: true }), "ready")).toBe("restless");
    expect(moodOf(result({ wild: true }), "stale")).toBe("restless");
    expect(moodOf(result({ wild: false }), "ready")).toBe("calm");
    expect(moodOf(null, "empty")).toBe("calm");
  });

  it("lists the same plates in plain words, with the backend's warnings", () => {
    const lines = plainLines(result({ holdings: [holding(), holding({ holding_id: "h2", name: "Orkla", direction: "up" })], warnings: ["A wild pull."] }));
    expect(lines.some((l) => l.startsWith("Equinor:"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Orkla:"))).toBe(true);
    expect(lines).toContain("A wild pull.");
    expect(plainLines(null)).toEqual([MINT_WORDS.wallEmpty]);
  });
});

describe("the room", () => {
  it("keeps every spot inside the room, apart from the others", () => {
    const spots = [
      { id: "press", x: PRESS_SPOT.x, z: PRESS_SPOT.z, reach: PRESS_LEAVE_RANGE },
      { id: "span", x: SPAN_SPOT.x, z: SPAN_SPOT.z, reach: SPAN_LEAVE_RANGE },
      { id: "book", x: BOOK_SPOT.x, z: BOOK_SPOT.z, reach: BOOK_LEAVE_RANGE },
      { id: "door", x: MINT_DOOR.x, z: MINT_DOOR.z, reach: MINT_DOOR_LEAVE_RANGE },
    ];
    for (const s of spots) {
      expect(s.x, s.id).toBeGreaterThan(MINT.minX);
      expect(s.x, s.id).toBeLessThan(MINT.maxX);
      expect(s.z, s.id).toBeGreaterThan(MINT.minZ);
      expect(s.z, s.id).toBeLessThanOrEqual(MINT.maxZ);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i];
        const b = spots[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} / ${b.id}`).toBeGreaterThan(Math.max(a.reach, b.reach));
      }
    // The levers stand along the north wall, far from the press, the span post and the door.
    const { plans } = leverLayout(Array.from({ length: LEVER_CAPACITY }, (_, i) => lever(`l${i}`, "0", "1")));
    for (const p of plans)
      for (const s of spots) expect(Math.hypot(p.spotX - s.x, LEVER_Z - s.z), `${p.key} / ${s.id}`).toBeGreaterThan(Math.max(s.reach, LEVER_LEAVE_RANGE));
  });

  it("finds each fixed spot where it stands, and not from across the room", () => {
    expect(nearPress(PRESS_SPOT)).toBe(true);
    expect(nearSpan(SPAN_SPOT)).toBe(true);
    expect(nearBook(BOOK_SPOT)).toBe(true);
    expect(nearMintDoor(MINT_DOOR)).toBe(true);
    expect(nearPress({ x: 0, z: 7 })).toBe(false);
    expect(nearSpan({ x: 6, z: -6 })).toBe(false);
  });

  it("steps back out onto the lawn in front of the Royal Mint's own door, out of reach of every door", () => {
    const b = BUILDINGS.find((x) => x.id === "mint");
    expect(b).toBeDefined();
    const out = mintExit();
    const s = doorSpot(b!);
    expect(Math.hypot(out.x - s.x, out.z - s.z)).toBeGreaterThan(4.6);
  });
});

describe("stamp view (#431)", () => {
  it("turns the camera to the result wall and stops there, by the shortest way", () => {
    let o = { yaw: 0, pitch: 0.45 };
    for (let i = 0; i < 200; i++) {
      const r = turnToResultWall(o, 1 / 60, false);
      o = { yaw: r.yaw, pitch: r.pitch };
      if (r.done) break;
    }
    expect(o.yaw).toBeCloseTo(MINT_RESULT_YAW, 5);
    expect(o.pitch).toBeCloseTo(MINT_RESULT_PITCH, 5);
    // From just past a full turn the short way round is taken, not the long one.
    const r = turnToResultWall({ yaw: Math.PI * 1.9, pitch: 0.3 }, 1 / 60, false);
    expect(r.yaw).toBeLessThan(Math.PI * 1.9); // the wall is 72 degrees back, not 288 forward
    expect(r.yaw).toBeGreaterThan(Math.PI * 1.5);
  });

  it("does not turn again when the camera already faces the result wall", () => {
    const p = MINT_RESULT_PITCH;
    expect(facesResultWall({ yaw: MINT_RESULT_YAW, pitch: p })).toBe(true);
    expect(facesResultWall({ yaw: MINT_RESULT_YAW + 0.3, pitch: p })).toBe(true);
    expect(facesResultWall({ yaw: 0, pitch: p })).toBe(false);
    expect(facesResultWall({ yaw: MINT_RESULT_YAW + Math.PI * 2, pitch: p })).toBe(true);
    expect(facesResultWall({ yaw: MINT_RESULT_YAW, pitch: 1.0 })).toBe(false); // facing east but looking steeply down
  });

  it("jumps when the system asks for less motion", () => {
    const r = turnToResultWall({ yaw: 2, pitch: 1 }, 1 / 60, true);
    expect(r).toEqual({ yaw: MINT_RESULT_YAW, pitch: MINT_RESULT_PITCH, done: true });
  });

  it("keeps the pitch inside what the player may look at", () => {
    expect(MINT_RESULT_PITCH).toBeGreaterThanOrEqual(MIN_PITCH);
    expect(MINT_RESULT_PITCH).toBeLessThanOrEqual(MAX_PITCH);
  });

  it("has every plate in a 16:9 view from the press (the camera at its usual 7 metres, pulled in by the walls)", () => {
    const fov = (60 * Math.PI) / 180;
    const halfV = fov / 2;
    const halfH = Math.atan(Math.tan(halfV) * (16 / 9));
    const focus: [number, number, number] = [PRESS_SPOT.x, 1.5, PRESS_SPOT.z];
    const off = cameraOffset(MINT_RESULT_YAW, MINT_RESULT_PITCH, 7);
    const pull = cameraPull(focus, off, MINT);
    const cam = [focus[0] + off[0] * pull, focus[1] + off[1] * pull, focus[2] + off[2] * pull];
    expect(cam[0]).toBeGreaterThan(MINT.minX); // the camera sits inside the room, west of the press
    expect(cam[0]).toBeLessThan(focus[0]);
    // The view axis: from the camera to the hero.
    const axisPitch = Math.atan2(cam[1] - focus[1], Math.hypot(cam[0] - focus[0], cam[2] - focus[2]));
    for (let i = 0; i < PLATE_CAPACITY; i++) {
      const s = plateSlot(i);
      for (const dz of [-1, 1]) for (const dy of [-0.75, 0.75]) {
        const dx = s.x - cam[0];
        const horizontal = Math.abs(Math.atan2(s.z + dz - cam[2], dx));
        const vertical = Math.abs(Math.atan2(s.y + dy - cam[1], dx) + axisPitch);
        expect(horizontal, `plate ${i} sideways`).toBeLessThan(halfH);
        expect(vertical, `plate ${i} up/down`).toBeLessThan(halfV);
      }
    }
  });

  it("picks the tall plate layout on a portrait screen and the wide one otherwise (#434)", () => {
    expect(plateLayoutFor(9 / 19.5)).toBe("tall");
    expect(plateLayoutFor(1)).toBe("wide");
    expect(plateLayoutFor(16 / 9)).toBe("wide");
    expect(plateCapacityOf("wide")).toBe(PLATE_CAPACITY);
    expect(plateCapacityOf("tall")).toBe(9);
  });

  it("has every tall-layout plate in view from the press on a tall phone, none touching another or the banners (#434)", () => {
    const aspect = 9 / 19.5; // a tall modern phone, upright
    const halfV = (60 * Math.PI) / 180 / 2;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const focus: [number, number, number] = [PRESS_SPOT.x, 1.5, PRESS_SPOT.z];
    const off = cameraOffset(MINT_RESULT_YAW, MINT_RESULT_PITCH, 7);
    const pull = cameraPull(focus, off, MINT);
    const cam = [focus[0] + off[0] * pull, focus[1] + off[1] * pull, focus[2] + off[2] * pull];
    const axisPitch = Math.atan2(cam[1] - focus[1], Math.hypot(cam[0] - focus[0], cam[2] - focus[2]));
    const scale = plateScaleOf("tall");
    const halfW = (PLATE.width * scale) / 2;
    const halfHt = ((PLATE.width * PLATE_PX.h) / PLATE_PX.w) * scale / 2;
    const seen = new Set<string>();
    for (let i = 0; i < plateCapacityOf("tall"); i++) {
      const s = plateSlot(i, "tall");
      seen.add(`${s.y}|${s.z}`);
      expect(s.z - halfW).toBeGreaterThan(MINT.minZ);
      expect(s.y + halfHt, `plate ${i} under the heading banner (y 5.2 and up)`).toBeLessThan(5.2);
      expect(s.y - halfHt, `plate ${i} above the "more" banner`).toBeGreaterThan(0.55);
      for (const dz of [-halfW, halfW]) for (const dy of [-halfHt, halfHt]) {
        const dx = s.x - cam[0];
        expect(Math.abs(Math.atan2(s.z + dz - cam[2], dx)), `plate ${i} sideways`).toBeLessThan(halfH);
        expect(Math.abs(Math.atan2(s.y + dy - cam[1], dx) + axisPitch), `plate ${i} up/down`).toBeLessThan(halfV);
      }
    }
    expect(seen.size).toBe(plateCapacityOf("tall"));
    // Rows are far enough apart that plates do not overlap.
    expect(plateSlot(3, "tall").y - plateSlot(6, "tall").y).toBeGreaterThan(halfHt * 2);
    expect(plateSlot(0, "tall").y - plateSlot(3, "tall").y).toBeGreaterThan(halfHt * 2);
    expect(Math.abs(plateSlot(1, "tall").z - plateSlot(0, "tall").z)).toBeGreaterThan(halfW * 2);
  });

  it("gives every lever a solid base that matches the iron block drawn, clear of the spot you stand at", () => {
    const { plans } = leverLayout(Array.from({ length: LEVER_CAPACITY }, (_, i) => lever(`l${i}`, "0", "1")));
    for (const p of plans) {
      const c = leverBaseCollider(p.x);
      expect(c.half).toEqual([LEVER_BASE.halfX, LEVER_BASE.halfY, LEVER_BASE.halfZ]);
      expect(c.position[1]).toBe(LEVER_BASE.halfY); // stands on the floor
      expect(c.position[2] + c.half[2]).toBeLessThan(p.spotZ - 0.35); // the hero (radius 0.35) can still reach the stand spot
      expect(c.position[2] - c.half[2]).toBeGreaterThanOrEqual(MINT.minZ); // inside the room
    }
  });
});
