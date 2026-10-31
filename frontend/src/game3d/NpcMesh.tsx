import { useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import Avatar from "./Avatar";
import { OracleFigure, PartnerFigure } from "./Figures";
import { shortestAngle } from "./movement";
import { yawToward } from "./npcs";
import type { Npc } from "./npcs";

const TURN_RATE = 6;

/**
 * A person in the courtyard, a solid figure turned toward the middle. You walk round them.
 * The real model (models3d.ts) shows when it has loaded; the shape figure shows while it loads
 * and if it ever fails. When you are close enough to talk, they turn to face you, then turn back.
 */
export default function NpcMesh({
  npc,
  active,
  playerPos,
}: {
  npc: Npc;
  active: boolean;
  playerPos?: MutableRefObject<{ x: number; z: number }>;
}) {
  const turn = useRef<Group>(null);

  useFrame((_, delta) => {
    const g = turn.current;
    if (!g) return;
    // The body already faces npc.facing; this extra turn is relative to that.
    const target = active && playerPos ? yawToward(npc, playerPos.current) - npc.facing : 0;
    g.rotation.y += shortestAngle(g.rotation.y, target) * Math.min(1, TURN_RATE * Math.min(delta, 0.05));
  });

  const shape = (
    <group scale={npc.height / 1.9}>{npc.art === "oracle" ? <OracleFigure /> : <PartnerFigure />}</group>
  );

  return (
    <RigidBody type="fixed" colliders={false} position={[npc.x, 0, npc.z]} rotation={[0, npc.facing, 0]}>
      <CylinderCollider args={[0.9, 0.5]} position={[0, 0.9, 0]} />
      <group ref={turn}>
        <Avatar id={npc.art} height={npc.height} fallback={shape} />
      </group>
      <Html position={[0, npc.height + 0.5, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-xs text-white">
          {npc.name}
          {active ? " · press E" : ""}
        </div>
      </Html>
    </RigidBody>
  );
}
