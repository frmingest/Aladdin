import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import Avatar from "./Avatar";
import { OracleFigure, PartnerFigure } from "./Figures";
import type { Npc } from "./npcs";

/** A person in the courtyard, a solid figure turned toward the middle. You walk round them. */
export default function NpcMesh({ npc, active }: { npc: Npc; active: boolean }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[npc.x, 0, npc.z]} rotation={[0, npc.facing, 0]}>
      <CylinderCollider args={[0.9, 0.5]} position={[0, 0.9, 0]} />
      <Avatar
        id={npc.art}
        height={npc.height}
        fallback={<group scale={npc.height / 1.9}>{npc.art === "oracle" ? <OracleFigure /> : <PartnerFigure />}</group>}
      />
      <Html position={[0, npc.height + 0.5, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-xs text-white">
          {npc.name}
          {active ? " · press E" : ""}
        </div>
      </Html>
    </RigidBody>
  );
}
