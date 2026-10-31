import type { StandingGap } from "../lib/types";
import type { TowerView, WorldModel } from "./stateToWorld";

/**
 * Put the Standing's named gaps on the towers they belong to (matched by ticker). A gap is only
 * a label ("no tagged filing"): the tower stays fog and nothing about its look changes.
 * Towers without a gap keep the very same object, and a world with no gaps is returned as is.
 */
export function withGaps(world: WorldModel, gaps: readonly StandingGap[]): WorldModel {
  if (gaps.length === 0) return world;
  const byTicker = new Map(gaps.map((g) => [g.ticker, g.label]));
  const mark = (t: TowerView): TowerView => {
    const label = byTicker.get(t.ticker);
    return label ? { ...t, gap: label } : t;
  };
  const plain = world.plain.map(mark);
  const bySlot = new Map(plain.map((t) => [t.holdingId, t]));
  return { ...world, plain, towers: world.towers.map((t) => bySlot.get(t.holdingId) ?? t) };
}
