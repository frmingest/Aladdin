/**
 * The land's centre slot (S26 PR 1). Pure, no three.js and no React.
 *
 * The slot takes { theme, condition, stream }. The theme comes from the sector only (the same call as the flat Map), the
 * condition from the wall tier only, the stream from the moat tier only. A theme with no dressing built yet keeps S25's
 * plain tower, so every PR leaves the game working. The ghost and neutral states are drawn once, here, for every theme,
 * so a dressing only ever draws the five rungs.
 */
import { holdingTheme3d } from "../lib/sectors";
import type { Theme3dId } from "../lib/sectors";
import type { GameTower } from "../lib/types";
import { landCondition } from "./landCondition";
import type { LandCondition } from "./landCondition";
import { isFishFarm } from "./farmDressing";
import { landStream } from "./landStream";
import type { LandStream } from "./landStream";
import type { TowerView } from "./stateToWorld";

export interface LandCentreSlot {
  theme: Theme3dId;
  condition: LandCondition;
  stream: LandStream;
  /** The holding's own tower (S25), kept for themes without a dressing yet. */
  tower: TowerView;
  /** A fish or aquaculture holding: the farm dressing shows tanks (scenery only). */
  fish?: boolean;
}

/** Which themes have a dressing built. PR 2 to PR 5 flip these one at a time; until then the plain tower stands. */
export const DRESSING_BUILT: Record<Theme3dId, boolean> = {
  mine: true,
  quarry: true,
  ingots: false,
  farm: true,
  stall: false,
  bank: false,
  factory: false,
  windmill: true,
  watermill: true,
  fountain: false,
  plain: false,
};

export type CentreChoice = "tower" | "ghost" | "neutral" | "dressing";

/** What the slot draws. Ghost and neutral are chosen before any dressing, so no dressing has to draw them. */
export function centreChoice(slot: Pick<LandCentreSlot, "theme" | "condition">, built: Record<Theme3dId, boolean> = DRESSING_BUILT): CentreChoice {
  if (slot.theme === "plain" || !built[slot.theme]) return "tower";
  if (slot.condition.state === "ghost") return "ghost";
  if (slot.condition.state === "neutral") return "neutral";
  return "dressing";
}

/** The theme of a holding: the one call the page uses, and the readout below prints. */
export function themeOf(t: Pick<GameTower, "sector" | "holding_id" | "structure">): Theme3dId {
  return holdingTheme3d(t.sector, t.holding_id, t.structure);
}

export function centreSlotFor(t: Pick<GameTower, "sector" | "holding_id" | "structure" | "wall" | "moat"> & { name?: string }, tower: TowerView): LandCentreSlot {
  return { theme: themeOf(t), condition: landCondition(t.wall), stream: landStream(t.moat), tower, fish: isFishFarm(t) };
}

export interface ThemeRow {
  holdingId: string;
  name: string;
  sector: string | null;
  theme: Theme3dId;
  /** True when a dressing for that theme is built, so the land's centre changes. */
  changes: boolean;
}

/** The theme of every holding, through the same call the page uses. */
export function themeReadout(
  towers: readonly Pick<GameTower, "sector" | "holding_id" | "structure" | "name">[],
  built: Record<Theme3dId, boolean> = DRESSING_BUILT,
): ThemeRow[] {
  return towers.map((t) => {
    const theme = themeOf(t);
    return { holdingId: t.holding_id, name: t.name, sector: t.sector, theme, changes: theme !== "plain" && built[theme] };
  });
}

/** The readout as a plain table, for a test log and the PR text. */
export function themeReadoutTable(rows: readonly ThemeRow[]): string {
  const head = "| Holding | Sector | Theme |\n|---|---|---|";
  return [head, ...rows.map((r) => `| ${r.name} | ${r.sector ?? "(none)"} | ${r.theme} |`)].join("\n");
}
