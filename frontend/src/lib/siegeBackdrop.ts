import { FALL_STAGES } from "./siege";
import type { FallStage } from "./siege";
import { getObjectArt } from "./stitchArt";
import type { ObjectArt } from "./stitchArt";

/** The packed picture id for a stage: backdrop-siege-towers-calm, -storm, -siege, -ruin. */
export const towersBackdropId = (stage: FallStage): string => `backdrop-siege-towers-${stage}`;

/** The picture for a stage, or the nearest stage that has one (a missing picture never leaves a hole); null when none is packed. */
export function towersBackdropFor(stage: FallStage): { stage: FallStage; art: ObjectArt } | null {
  const at = FALL_STAGES.indexOf(stage);
  const order = [...FALL_STAGES].sort((a, b) => Math.abs(FALL_STAGES.indexOf(a) - at) - Math.abs(FALL_STAGES.indexOf(b) - at) || FALL_STAGES.indexOf(a) - FALL_STAGES.indexOf(b));
  for (const s of order) {
    const art = getObjectArt(towersBackdropId(s));
    if (art) return { stage: s, art };
  }
  return null;
}

/** Whether any of the four pictures is packed (the strip then lets the scenery show through). */
export const hasTowersBackdrop = (): boolean => FALL_STAGES.some((s) => getObjectArt(towersBackdropId(s)) !== null);
