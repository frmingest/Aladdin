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
import { TOWER_SPOT_COUNT, towerSpots, type Spot } from "./layout";
import { MOAT_WIDTH, SIZE_HEIGHT, SIZE_RADIUS, WALL_LOOK } from "./towerLook";
import { assignPlots, type OutdoorZone, type Plot } from "./outdoorPlan";
import { doorPoint } from "./countryside";
import { isFishFarm } from "./farmDressing";
import { holdingTheme3d, type Theme3dId } from "../lib/sectors";

export { MOAT_WIDTH, SIZE_HEIGHT, SIZE_RADIUS, WALL_LOOK };

/** How the walls read at a glance. "unknown" is fog, never a middle grade. */
export type Strength = "strong" | "fair" | "weak" | "unknown";





export type Flag = "intact" | "review" | "breached" | "none";

/**
 * Where a holding stands on the meadow outside the wall (S31 PR 3). Set by `stateToWorld` unless the caller hands it
 * its own spots. It comes from the plan (theme and weight order only), never from a verdict, a wall or a moat.
 */
export interface OutdoorPlot {
  zone: OutdoorZone;
  index: number;
  theme: Theme3dId;
  fish: boolean;
  /** How wide the building stands: the door is reached from this, not from the middle. */
  footprint: number;
  /** The end of the lane that serves this plot, where the door stands. */
  door: Spot;
  /** Yaw (0 = facing +z) from the middle of the plot toward the door. */
  doorYaw: number;
}

export function outdoorPlotOf(p: Plot): OutdoorPlot {
  const door = doorPoint(p.zone, p.index);
  return {
    zone: p.zone,
    index: p.index,
    theme: p.theme,
    fish: p.fish,
    footprint: p.footprint,
    door,
    doorYaw: Math.atan2(door.x - p.spot.x, door.z - p.spot.z),
  };
}

export interface TowerView {
  /** Which pad (0 = west end of the arc), or which plot in weight order when the holding stands outside. */
  slot: number;
  spot: Spot;
  /** Set when the holding stands on the meadow outside the wall. Absent for the old horseshoe pads. */
  plot?: OutdoorPlot;
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
 * The meadow has room for `TOWER_SPOT_COUNT` holdings. The biggest take it (same order as the flat Fortress); the rest
 * are counted, not drawn, and stay in the plain list. By default each stands on its outdoor plot (S31); a caller that
 * hands in `spots` gets the old pad positions instead. With no state yet, the result is an empty world.
 */
export function stateToWorld(state: GameState | null, spots?: Spot[]): WorldModel {
  if (!state) return { demo: false, asOf: null, towers: [], hiddenCount: 0, plain: [] };
  const ordered = sortTowers(state.towers);
  const limit = spots ? spots.length : TOWER_SPOT_COUNT;
  const plots = spots
    ? null
    : assignPlots(
        ordered.slice(0, limit).map((t) => ({
          holdingId: t.holding_id,
          theme: holdingTheme3d(t.sector, t.holding_id, t.structure),
          fish: isFishFarm(t),
        })),
      );
  const plain = ordered.map((t, i) => {
    const plot = plots?.find((p) => p.holdingId === t.holding_id);
    if (plot) return { ...viewOf(t, i, plot.spot), plot: outdoorPlotOf(plot) };
    return viewOf(t, i, (spots ?? towerSpots())[i] ?? { x: 0, z: 0 });
  });
  const towers = plain.slice(0, limit);
  return {
    demo: state.demo,
    asOf: state.as_of,
    towers,
    hiddenCount: Math.max(0, plain.length - towers.length),
    plain,
  };
}
