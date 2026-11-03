import LandBlock from "./LandBlock";
import MineDressing from "./MineDressing";
import StreamBand from "./StreamBand";
import { TowerBody } from "./TowerMesh";
import { WORKPLACE } from "./holdingLand";
import { centreChoice } from "./landCentre";
import type { LandCentreSlot } from "./landCentre";

/**
 * The land's centre slot (S26 PR 1). It takes { theme, condition, stream } and decides what stands in the middle:
 * S25's own tower while a theme has no dressing, the pale ghost or the plain neutral for every theme (drawn here, once),
 * and a dressing for the five rungs (none built yet, so the placeholder block stands in). The stream band is drawn for
 * everything except the tower, which already carries its own moat.
 */
/** One line per built theme: the dressing that stands in the centre for the five rungs. Other themes fall back to the block. */
function dressingFor(slot: LandCentreSlot, at: [number, number, number]) {
  if (slot.theme === "mine" || slot.theme === "quarry")
    return (
      <group position={at}>
        <MineDressing theme={slot.theme} condition={slot.condition} />
      </group>
    );
  return null;
}

export default function LandCentre({ slot }: { slot: LandCentreSlot }) {
  const choice = centreChoice(slot);
  if (choice === "tower") return <TowerBody t={slot.tower} door={false} />;
  const at: [number, number, number] = [WORKPLACE.x, 0, WORKPLACE.z];
  const dressing = choice === "dressing" ? dressingFor(slot, at) : null;
  return (
    <>
      {dressing ?? <LandBlock condition={slot.condition} position={at} />}
      <StreamBand stream={slot.stream} position={at} />
    </>
  );
}
