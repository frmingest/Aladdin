import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import type { Npc } from "./npcs";

/** A stand-in figure from plain shapes (a real model comes later). Solid, so you walk round it. */
export default function NpcMesh({ npc, active }: { npc: Npc; active: boolean }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[npc.x, 0, npc.z]} rotation={[0, npc.facing, 0]}>
      <CylinderCollider args={[0.9, 0.5]} position={[0, 0.9, 0]} />
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.5, 1.4, 8]} />
        <meshStandardMaterial color={npc.robe} flatShading />
      </mesh>
      <mesh position={[0, 1.5, 0.28]} castShadow>
        <boxGeometry args={[0.7, 0.14, 0.12]} />
        <meshStandardMaterial color={npc.trim} flatShading />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.26, 10, 8]} />
        <meshStandardMaterial color="#e0b88f" flatShading />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <coneGeometry args={[0.34, 0.5, 8]} />
        <meshStandardMaterial color={npc.trim} flatShading />
      </mesh>
      <Html position={[0, 3, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-xs text-white">
          {npc.name}
          {active ? " · press E" : ""}
        </div>
      </Html>
    </RigidBody>
  );
}
