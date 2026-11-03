import FountainDressing from "./FountainDressing";
import LandBlock from "./LandBlock";
import StreamBand from "./StreamBand";
import { TowerBody } from "./TowerMesh";
import { WORKPLACE } from "./holdingLand";
import MillDressing from "./MillDressing";
import { centreChoice } from "./landCentre";
import type { LandCentreSlot } from "./landCentre";
import type { Theme3dId } from "../lib/sectors";
import type { ComponentType } from "react";

/** One line per theme: PR 2 to PR 5 each add theirs. A theme with no line here keeps the placeholder block. */
function FountainSlot({ slot }: { slot: LandCentreSlot }) {
  return <FountainDressing condition={slot.condition} />;
}

const DRESSINGS: Partial<Record<Theme3dId, ComponentType<{ slot: LandCentreSlot }>>> = {
  windmill: MillDressing,
  watermill: MillDressing,
  fountain: FountainSlot,
};

/**
 * The land's centre slot (S26 PR 1). It takes { theme, condition, stream } and decides what stands in the middle:
 * S25's own tower while a theme has no dressing, the pale ghost or the plain neutral for every theme (drawn here, once),
 * and a dressing for the five rungs (none built yet, so the placeholder block stands in). The stream band is drawn for
 * everything except the tower, which already carries its own moat.
 */
export default function LandCentre({ slot }: { slot: LandCentreSlot }) {
  const choice = centreChoice(slot);
  if (choice === "tower") return <TowerBody t={slot.tower} door={false} />;
  const at: [number, number, number] = [WORKPLACE.x, 0, WORKPLACE.z];
  const Dressing = choice === "dressing" ? DRESSINGS[slot.theme] : undefined;
  return (
    <>
      {Dressing ? <Dressing slot={slot} /> : <LandBlock condition={slot.condition} position={at} />}
      <StreamBand stream={slot.stream} position={at} />
    </>
  );
}
