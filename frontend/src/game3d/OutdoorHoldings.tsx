import { CylinderCollider, RigidBody } from "@react-three/rapier";
import LandCentre from "./LandCentre";
import StaticBatch from "./StaticBatch";
import { WithFallback } from "./KeepModels";
import TowerMesh, { OutdoorDoor } from "./TowerMesh";
import { WORKPLACE } from "./holdingLand";
import { centreChoice } from "./landCentre";
import { landCondition } from "./landCondition";
import { landStream } from "./landStream";
import type { LandCentreSlot } from "./landCentre";
import type { TowerView } from "./stateToWorld";

const PLINTH = 3.4;
const PLINTH_COLOR = "#c9c1b3";
/** The solid core of a dressed building, as a share of its footprint: the door post stays outside it. */
const CORE_SHARE = 0.7;

/** What stands in the building's place: its theme, the wear from the wall tier and the stream from the moat tier only. */
export function slotOf(t: TowerView): LandCentreSlot | null {
  if (!t.plot) return null;
  return { theme: t.plot.theme, condition: landCondition(t.facts.wall), stream: landStream(t.facts.moat), tower: t, fish: t.plot.fish };
}

/** A tower with no building art yet (tech, real estate, anything the sector table does not know): the old tower on a small plinth, door on the lane side. */
function PlainOutside({ t }: { t: TowerView }) {
  return (
    <>
      <StaticBatch>
        <RigidBody type="fixed" colliders={false} position={[t.spot.x, 0.25, t.spot.z]}>
          <CylinderCollider args={[0.25, PLINTH / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[PLINTH, 0.5, PLINTH]} />
            <meshStandardMaterial color={PLINTH_COLOR} flatShading />
          </mesh>
        </RigidBody>
      </StaticBatch>
      <TowerMesh t={t} />
    </>
  );
}

/** One holding standing on its spot inside the wall: its own building from the land (moved from the land's middle to its plot) and a door post. */
function Building({ t, slot }: { t: TowerView; slot: LandCentreSlot }) {
  const plot = t.plot!;
  const model = (
    <group position={[t.spot.x - WORKPLACE.x, 0, t.spot.z - WORKPLACE.z]}>
      <LandCentre slot={slot} />
    </group>
  );
  return (
    <>
      <WithFallback model={model} fallback={<PlainOutside t={t} />} />
      <RigidBody type="fixed" colliders={false} position={[t.spot.x, 1.5, t.spot.z]}>
        <CylinderCollider args={[1.5, plot.footprint * CORE_SHARE]} />
      </RigidBody>
      <OutdoorDoor t={t} />
    </>
  );
}

/**
 * The holdings inside the wall, spread evenly round it (S31; moved in 2026-11-11). Where each stands comes from the plan (weight order only; the theme sets only the width); what it looks
 * like comes from its theme, its wall tier and its moat tier, exactly as in its own land. A theme with no building yet
 * keeps the plain tower.
 */
export default function OutdoorHoldings({ towers }: { towers: readonly TowerView[] }) {
  return (
    <>
      {towers.map((t) => {
        const slot = slotOf(t);
        if (!slot || centreChoice(slot) === "tower") return <PlainOutside key={t.holdingId} t={t} />;
        return <Building key={t.holdingId} t={t} slot={slot} />;
      })}
    </>
  );
}
