/**
 * stateToWorld: the one pure function that turns the Fortress state
 * (`GET /game/state`) into what the 3D courtyard draws (game3d, week 2).
 *
 * Rules (docs/game/game3d-prototype-2026-10-30.md):
 *  - The backend stays the single source of truth; nothing here decides a fact.
 *    It only maps stored values (size, wall, moat, freshness, thesis) to shapes.
 *  - Unknown stays fog: an unsurveyed wall or size never turns into a nice-looking tower.
 *  - A weak holding must never look strong. Colour alone carries no verdict:
 *    wall strength is also shown by the crown (solid vs broken), cracks and the moat.
 *  - No lighting, no flattering: the look is fixed by these tables, not by the scene.
 *  - No buy/sell wording anywhere.
 */
import type {
  FortressFreshness,
  FortressMoat,
  FortressSize,
  FortressStructure,
  FortressThesis,
  FortressWall,
  GameState,
  GameTower,
} from "../lib/types";
import { sortTowers } from "../lib/fortress";
import { towerSpots, type Spot } from "./layout";

/** How the walls read at a glance. "unknown" is fog, never a middle grade. */
export type Strength = "strong" | "fair" | "weak" | "unknown";

/** Fixed look per wall material. `integrity` orders them: higher is sturdier. */
export const WALL_LOOK: Record<FortressWall, { color: string; integrity: number | null; crenels: number; cracks: number }> = {
  basalt: { color: "#4a4f57", integrity: 1, crenels: 8, cracks: 0 },
  granite: { color: "#8d8a85", integrity: 0.8, crenels: 8, cracks: 0 },
  brick: { color: "#a35f4a", integrity: 0.6, crenels: 6, cracks: 1 },
  timber: { color: "#8a6a43", integrity: 0.35, crenels: 4, cracks: 2 },
  rotted: { color: "#5f6a4f", integrity: 0.1, crenels: 2, cracks: 4 },
  unsurveyed: { color: "#cfd6dc", integrity: null, crenels: 0, cracks: 0 },
  not_applicable: { color: "#b9b2a6", integrity: null, crenels: 0, cracks: 0 },
};

/** Tower height (world units) by size class. Unknown size is a low stub, drawn in fog. */
export const SIZE_HEIGHT: Record<FortressSize, number> = {
  great: 15,
  medium: 11,
  small: 8,
  tiny: 5.5,
  unknown: 4,
};

export const SIZE_RADIUS: Record<FortressSize, number> = {
  great: 2.1,
  medium: 1.8,
  small: 1.5,
  tiny: 1.2,
  unknown: 1.3,
};

/** Moat ring width by tier. Not surveyed is fog, drawn as mist (see `moatFog`). */
export const MOAT_WIDTH: Record<FortressMoat, number> = {
  wide: 2.2,
  narrow: 1,
  none: 0,
  unsurveyed: 0,
  not_applicable: 0,
};

export type Flag = "intact" | "review" | "breached" | "none";

export interface TowerView {
  /** Which pad (0 = west end of the arc). */
  slot: number;
  spot: Spot;
  holdingId: string;
  name: string;
  ticker: string;
  shape: FortressStructure;
  height: number;
  radius: number;
  wallColor: string;
  strength: Strength;
  /** Battlement teeth on the crown: fewer means a more broken crown. */
  crenels: number;
  /** Crack marks on the wall: more means weaker. */
  cracks: number;
  moatWidth: number;
  /** Moat tier not surveyed: draw mist, not water. */
  moatFog: boolean;
  /** Whole tower unknown (wall or size not surveyed): draw it as a pale ghost. */
  fog: boolean;
  /** A named gap from the Standing rules ("no tagged filing"): an honest label, the tower stays fog. */
  gap?: string | null;
  /** Analysis age on the wall: ivy when ageing, overgrown when stale. */
  freshness: FortressFreshness;
  flag: Flag;
  /** Plain-view facts for this tower, straight from the stored state. */
  facts: {
    size: FortressSize;
    wall: FortressWall;
    moat: FortressMoat;
    thesis: FortressThesis;
    weightPct: string | null;
    wallReason: string;
  };
}

export interface WorldModel {
  demo: boolean;
  asOf: string | null;
  towers: TowerView[];
  /** Holdings that did not fit on the pads. They are still in the plain list. */
  hiddenCount: number;
  /** All holdings in drawing order, for the plain list (same order as the pads, then the rest). */
  plain: TowerView[];
}

export function strengthOf(wall: FortressWall): Strength {
  const i = WALL_LOOK[wall].integrity;
  if (i === null) return "unknown";
  if (i >= 0.75) return "strong";
  if (i >= 0.5) return "fair";
  return "weak";
}

function flagOf(thesis: FortressThesis): Flag {
  if (thesis === "intact" || thesis === "review" || thesis === "breached") return thesis;
  return "none";
}

function viewOf(t: GameTower, slot: number, spot: Spot): TowerView {
  const look = WALL_LOOK[t.wall];
  const fog = t.wall === "unsurveyed" || t.size_class === "unknown";
  return {
    slot,
    spot,
    holdingId: t.holding_id,
    name: t.name,
    ticker: t.ticker,
    shape: t.structure,
    height: SIZE_HEIGHT[t.size_class],
    radius: SIZE_RADIUS[t.size_class],
    wallColor: look.color,
    strength: strengthOf(t.wall),
    crenels: look.crenels,
    cracks: look.cracks,
    moatWidth: MOAT_WIDTH[t.moat],
    moatFog: t.moat === "unsurveyed",
    fog,
    freshness: t.freshness,
    flag: flagOf(t.thesis),
    facts: {
      size: t.size_class,
      wall: t.wall,
      moat: t.moat,
      thesis: t.thesis,
      weightPct: t.weight_pct,
      wallReason: t.wall_reason,
    },
  };
}

/**
 * The courtyard has `spots.length` pads. The biggest holdings take them
 * (same order as the flat Fortress); the rest are counted, not drawn, and stay
 * in the plain list. With no state yet, the result is an empty courtyard.
 */
export function stateToWorld(state: GameState | null, spots: Spot[] = towerSpots()): WorldModel {
  if (!state) return { demo: false, asOf: null, towers: [], hiddenCount: 0, plain: [] };
  const ordered = sortTowers(state.towers);
  const plain = ordered.map((t, i) => viewOf(t, i, spots[i] ?? { x: 0, z: 0 }));
  const towers = plain.slice(0, spots.length);
  return {
    demo: state.demo,
    asOf: state.as_of,
    towers,
    hiddenCount: Math.max(0, plain.length - towers.length),
    plain,
  };
}
