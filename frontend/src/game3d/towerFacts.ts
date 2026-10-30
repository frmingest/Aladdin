import { MOAT_LABEL, SIZE_LABEL, THESIS_LABEL, WALL_LABEL } from "../lib/fortress";
import type { TowerView } from "./stateToWorld";

/** One tower's facts in words, straight from the stored state (the Plain view of the 3D scene). */
export function towerFacts(t: TowerView): string {
  const f = t.facts;
  return [WALL_LABEL[f.wall], MOAT_LABEL[f.moat], SIZE_LABEL[f.size], THESIS_LABEL[f.thesis]].join(" · ");
}
