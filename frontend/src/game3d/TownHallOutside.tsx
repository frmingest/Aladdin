import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import { BuildingMesh, BuildingsBoundary, DoorMark } from "./Town";
import { TOWN_FILES } from "./townPieces";
import { TOWN_HALL_OUTSIDE } from "./townHallOutside";

function Hall() {
  const gltf = useGLTF(TOWN_FILES.buildings);
  return <BuildingMesh b={TOWN_HALL_OUTSIDE} source={gltf.scene} />;
}

/**
 * The Town Hall on the meadow beside the gate road (2026-11-10): the same market-hall model, door mat and name board as
 * every Town building, with its collider. If the buildings file fails to load the hall (and its collider) is left out;
 * the mat and the name board stay, so the door can still be found and used.
 */
export default function TownHallOutside({ active }: { active: boolean }) {
  return (
    <>
      <DoorMark b={TOWN_HALL_OUTSIDE} active={active} />
      <BuildingsBoundary>
        <Suspense fallback={null}>
          <Hall />
        </Suspense>
      </BuildingsBoundary>
    </>
  );
}
