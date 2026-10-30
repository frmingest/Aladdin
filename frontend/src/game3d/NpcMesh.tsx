import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import Sprite from "./Billboard";
import type { Npc } from "./npcs";

/** A person in the courtyard, drawn as a picture that turns to face you. Solid, so you walk round them. */
export default function NpcMesh({ npc, active }: { npc: Npc; active: boolean }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[npc.x, 0, npc.z]}>
      <CylinderCollider args={[0.9, 0.5]} position={[0, 0.9, 0]} />
      <Sprite art={npc.art} height={npc.height} />
      <Html position={[0, npc.height + 0.5, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-xs text-white">
          {npc.name}
          {active ? " · press E" : ""}
        </div>
      </Html>
    </RigidBody>
  );
}
