/**
 * A holding's own land (S25, plain version). Pure data and maths, no three.js and no React.
 *
 * Every holding gets the same five spots in the same places, so a weak holding is never harder to read than a
 * strong one. Only the size of the ground changes, and it follows the holding's size class (four fixed sizes).
 * Nothing here reads a verdict: a spot shows a fact the app already stored, or fog when the fact is unknown.
 *
 * Local coordinates: x east, z south, y up, the land centred on the origin. You arrive at the south gate looking
 * north. Only one area is drawn at a time, so the land can sit at the origin without touching the courtyard.
 *
 * The five spots:
 *   1. gate stone   where you arrive: name, weight, value
 *   2. survey ring  four lanterns, one per survey check (fog of war)
 *   3. workplace    the centre; its condition comes from the wall and moat tiers only
 *   4. records      the open-fronted house with the seven shelves and the reading table (today's library)
 *   5. price post   margin of safety, thesis state, siege exposure
 */
import { SURVEY_CHECKS } from "../lib/survey";
import type { SurveyCheckId, SurveyState, TowerFog } from "../lib/survey";
import type { FortressLand, FortressSiegeExposure, FortressSize, FortressThesis, GameTower } from "../lib/types";
import type { Spot } from "./layout";
import { SHELF_ORDER } from "./libraryShelves";
import type { ShelfSlot } from "./libraryRoom";

/** The ground radius per size class. Four fixed sizes; an unknown size takes the small one, never a flattering one. */
export const LAND_RADIUS: Record<FortressSize, number> = {
  great: 22,
  medium: 19.5,
  small: 17.5,
  tiny: 16.5,
  unknown: 17.5,
};

/** The smallest land. Every spot sits inside it, so no size can push a spot off the ground. */
export const MIN_LAND_RADIUS = LAND_RADIUS.tiny;

export function landRadius(size: FortressSize): number {
  return LAND_RADIUS[size] ?? LAND_RADIUS.unknown;
}

/** Where you stand on arriving, just inside the gate, looking north (camera yaw 0, as in the library). */
export const LAND_SPAWN = { x: 0, z: 10.2, yaw: 0 } as const;
/** The gate stone stands ahead and to the west of where you arrive, so it is the first thing you read. */
export const GATE_STONE = { x: -3, z: 8.4 } as const;
/** Leaving: the gate near the south end. E here takes you back to the courtyard. */
export const LAND_GATE = { x: 0, z: 14.2 } as const;
export const GATE_RANGE = 2.6;
export const GATE_LEAVE_RANGE = 3.6;

/** The four survey lanterns on an arc across the land, in the order of SURVEY_CHECKS. */
export const LANTERN_SPOTS: readonly (Spot & { check: SurveyCheckId })[] = [
  { check: SURVEY_CHECKS[0].id, x: -4.5, z: 3.6 },
  { check: SURVEY_CHECKS[1].id, x: -1.5, z: 2.6 },
  { check: SURVEY_CHECKS[2].id, x: 1.5, z: 2.6 },
  { check: SURVEY_CHECKS[3].id, x: 4.5, z: 3.6 },
];
export const LANTERN_RANGE = 2.2;
export const LANTERN_LEAVE_RANGE = 3.2;

/** The workplace in the middle. `r` is the footprint radius. */
export const WORKPLACE = { x: 0, z: -3, r: 3 } as const;

/**
 * The records house on the west side, open on its east front. `hx` and `hz` are the half sizes of the room inside
 * the walls. Seven bays fit round it at three quarters of the library's size: two on the north wall, three on the
 * west wall, two on the south wall; the reading table stands in the open middle.
 */
export const RECORDS_HOUSE = { x: -9, z: -3, hx: 3.3, hz: 5.2 } as const;
/** The bays are drawn at this share of the library's size, so seven fit in a house that fits the smallest land. */
export const BAY_SCALE = 0.75;
/** You stand in the open front to read a shelf or the table. */
export const RECORDS_FRONT = { x: RECORDS_HOUSE.x + RECORDS_HOUSE.hx, z: RECORDS_HOUSE.z } as const;
/** Closer than the library's reach: the house is small, so each spot is claimed from a short way off. */
export const SHELF_RANGE = 1.5;
export const SHELF_LEAVE_RANGE = 2.2;
export const TABLE_RANGE = 1.3;
export const TABLE_LEAVE_RANGE = 2.0;

const BAY_DEPTH_CENTRE = 0.55 * BAY_SCALE;
const HOUSE_WEST = RECORDS_HOUSE.x - RECORDS_HOUSE.hx;
const HOUSE_NORTH = RECORDS_HOUSE.z - RECORDS_HOUSE.hz;
const HOUSE_SOUTH = RECORDS_HOUSE.z + RECORDS_HOUSE.hz;

/** The seven bays, in the order of SHELF_ORDER: two north, three west (top to bottom), two south. */
export const LAND_SHELF_SLOTS: readonly ShelfSlot[] = [
  { id: SHELF_ORDER[0], x: -10, z: HOUSE_NORTH + BAY_DEPTH_CENTRE, yaw: 0 },
  { id: SHELF_ORDER[1], x: -7.3, z: HOUSE_NORTH + BAY_DEPTH_CENTRE, yaw: 0 },
  { id: SHELF_ORDER[2], x: HOUSE_WEST + BAY_DEPTH_CENTRE, z: -6, yaw: Math.PI / 2 },
  { id: SHELF_ORDER[3], x: HOUSE_WEST + BAY_DEPTH_CENTRE, z: -3, yaw: Math.PI / 2 },
  { id: SHELF_ORDER[4], x: HOUSE_WEST + BAY_DEPTH_CENTRE, z: 0, yaw: Math.PI / 2 },
  { id: SHELF_ORDER[5], x: -10, z: HOUSE_SOUTH - BAY_DEPTH_CENTRE, yaw: Math.PI },
  { id: SHELF_ORDER[6], x: -7.3, z: HOUSE_SOUTH - BAY_DEPTH_CENTRE, yaw: Math.PI },
];

/** The reading table in the open middle of the house; you stand on its south side to open the latest report. */
export const LAND_TABLE = { x: -7.9, z: -3.4, hx: 1.15, hz: 0.6 } as const;
export const LAND_TABLE_SPOT = { x: -7.9, z: -2.4 } as const;
export function nearLandTable(pos: { x: number; z: number }, range: number = TABLE_RANGE): boolean {
  return Math.hypot(LAND_TABLE_SPOT.x - pos.x, LAND_TABLE_SPOT.z - pos.z) <= range;
}

/** The price post by the exit, on the east side of the gate. */
export const PRICE_POST = { x: 5.5, z: 12.6 } as const;
export const PRICE_RANGE = 2.6;
export const PRICE_LEAVE_RANGE = 3.6;

/** What a lantern shows. Fixed by the check's state, never by the verdict: lit = clear, mist = fog, bare = not judged. */
export type LanternLook = "lit" | "mist" | "bare";

const LANTERN_OF_STATE: Record<SurveyState, LanternLook> = { clear: "lit", fog: "mist", not_judged: "bare" };

export interface Lantern {
  check: SurveyCheckId;
  label: string;
  look: LanternLook;
  /** The plain line from the survey: why it is clear, in fog, or not judged. */
  reason: string;
  x: number;
  z: number;
}

/** The four lanterns of a survey. A missing survey (nothing read yet) shows four hooded lanterns, never lit ones. */
export function lanternsFor(fog: TowerFog | null): Lantern[] {
  return LANTERN_SPOTS.map((spot, i) => {
    const check = fog?.checks.find((c) => c.id === spot.check) ?? null;
    return {
      check: spot.check,
      label: SURVEY_CHECKS[i].label,
      look: check ? LANTERN_OF_STATE[check.state] : "mist",
      reason: check?.reason ?? "This has not been surveyed yet, so it stays unknown.",
      x: spot.x,
      z: spot.z,
    };
  });
}

/**
 * How each look is drawn. Shape and mark carry the meaning, never colour alone (colour-blind safe), and no two looks
 * share both: lit = an open flame in a glass cage with a tick; mist = a hooded lamp with a "?"; bare = a bare post with
 * a dash. Fixed here so a test can pin it (the same idea as `patchSignature` on the flat Map).
 */
export const LANTERN_LOOKS: Record<LanternLook, { shape: "flame" | "hood" | "post"; mark: string }> = {
  lit: { shape: "flame", mark: "\u2713" },
  mist: { shape: "hood", mark: "?" },
  bare: { shape: "post", mark: "\u2013" },
};

/** The lantern you stand at, or null. A lantern already in reach stays in reach a little further out, so the edge does not flicker. */
export function nearestLantern(
  p: { x: number; z: number },
  lanterns: readonly { check: SurveyCheckId; x: number; z: number }[],
  current: SurveyCheckId | null,
): SurveyCheckId | null {
  let best: SurveyCheckId | null = null;
  let bestD = Infinity;
  for (const l of lanterns) {
    const d = Math.hypot(l.x - p.x, l.z - p.z);
    const reach = l.check === current ? LANTERN_LEAVE_RANGE : LANTERN_RANGE;
    if (d <= reach && d < bestD) {
      best = l.check;
      bestD = d;
    }
  }
  return best;
}

/** "2 of 4 lanterns lit", or "Not surveyed yet" when nothing was read. */
export function lanternSummary(lanterns: readonly Lantern[]): string {
  const judged = lanterns.filter((l) => l.look !== "bare").length;
  if (judged === 0) return "Not surveyed yet";
  const lit = lanterns.filter((l) => l.look === "lit").length;
  return `${lit} of ${judged} lanterns lit`;
}

export type WorkplaceCondition = "sound" | "worn" | "cracked" | "unknown";

/**
 * How the workplace looks. Only the wall tier says how sound it is; a wall that has not been surveyed is
 * "unknown" and draws as a pale outline in mist, never as a healthy-looking building.
 */
export function workplaceCondition(wall: GameTower["wall"] | null, fog: boolean): WorkplaceCondition {
  if (fog || !wall || wall === "unsurveyed" || wall === "not_applicable") return "unknown";
  if (wall === "basalt" || wall === "granite") return "sound";
  if (wall === "brick") return "worn";
  return "cracked";
}

export type MoatLook = "wide" | "narrow" | "none" | "mist";

/** The stream round the land: wide, narrow, none, or mist when the moat tier is not surveyed. */
export function moatLook(moat: GameTower["moat"] | null): MoatLook {
  if (moat === "wide" || moat === "narrow" || moat === "none") return moat;
  return "mist";
}

/** The gate stone: the name, the weight and the value, in plain words. Unknown stays unknown. */
export interface GateStone {
  title: string;
  /** "12.4% of the realm", or "Weight not known". */
  weight: string;
  /** "NOK 84 200", or "Value not known". */
  value: string;
  /** A named gap ("Not surveyed yet") shown under the name when the whole tower is fog. */
  note: string | null;
}

function formatNok(raw: string | null): string | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `NOK ${n < 0 ? "-" : ""}${digits}`;
}

export function gateStoneFor(t: Pick<GameTower, "name" | "weight_pct" | "value_nok">, surveyed: boolean): GateStone {
  const w = t.weight_pct === null ? NaN : Number(t.weight_pct);
  return {
    title: t.name,
    weight: Number.isFinite(w) ? `${w.toFixed(1)}% of the realm` : "Weight not known",
    value: formatNok(t.value_nok) ?? "Value not known",
    note: surveyed ? null : "Not surveyed yet",
  };
}

export type GaugeLook = FortressLand;
export type ScrollLook = "whole" | "cracked" | "broken" | "fog";
export type BannerLook = "sheltered" | "exposed" | "breach_risk" | "fog";

const SCROLL_OF_THESIS: Record<FortressThesis, ScrollLook> = {
  intact: "whole",
  review: "cracked",
  breached: "broken",
  not_analyzed: "fog",
  not_applicable: "fog",
};

const BANNER_OF_EXPOSURE: Record<FortressSiegeExposure, BannerLook> = {
  sheltered: "sheltered",
  exposed: "exposed",
  breach_risk: "breach_risk",
  unsurveyed: "fog",
};

/** The price post: a plank gauge (margin of safety), a sealed scroll (thesis) and a small banner (siege exposure). */
export interface PricePost {
  gauge: GaugeLook;
  scroll: ScrollLook;
  banner: BannerLook;
  /** The land's own reason line, so the gauge always says why. */
  gaugeReason: string;
}

export function pricePostFor(t: Pick<GameTower, "land" | "land_reason" | "thesis" | "siege_exposure">): PricePost {
  return {
    gauge: t.land,
    scroll: SCROLL_OF_THESIS[t.thesis] ?? "fog",
    banner: BANNER_OF_EXPOSURE[t.siege_exposure] ?? "fog",
    gaugeReason: t.land_reason,
  };
}

/** The spots every land has, by name, for tests and for the scene to loop over. */
export const LAND_SPOT_NAMES = ["gateStone", "lanterns", "workplace", "records", "pricePost"] as const;

export const LAND_SPOTS = {
  gateStone: GATE_STONE,
  lanterns: LANTERN_SPOTS,
  workplace: WORKPLACE,
  records: RECORDS_FRONT,
  pricePost: PRICE_POST,
} as const;

/** True when `p` is on the ground of a land of radius `r` (a disc round the origin). */
export function insideLand(p: { x: number; z: number }, r: number): boolean {
  return Math.hypot(p.x, p.z) <= r;
}
