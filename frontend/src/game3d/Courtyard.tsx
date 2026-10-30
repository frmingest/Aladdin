import { useMemo } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import {
  COBBLE_RADIUS,
  KEEP,
  WALL_HEIGHT,
  WALL_RADIUS,
  WALL_THICKNESS,
  cornerTowers,
  towerSpots,
  wallSegments,
} from "./layout";

/** One flat, neutral palette for every object, so nothing is flattered by its colour. */
const COLORS = {
  grass: "#7a9e5c",
  cobble: "#a89f91",
  stone: "#8d8a85",
  stoneDark: "#6f6c68",
  roof: "#7b3f3a",
  gate: "#5b4636",
  spot: "#c9c1b3",
};

const CORNER_TOWER_RADIUS = 3.2;
const CORNER_TOWER_HEIGHT = WALL_HEIGHT + 4;
const SPOT_SIZE = 3.4;

/**
 * The walled courtyard. Everything is built from plain shapes that double as
 * colliders: the same shapes are what you see and what stops you.
 * Week 2 replaces the eight pads with towers driven by the real portfolio.
 */
export default function Courtyard() {
  const walls = useMemo(() => wallSegments(), []);
  const corners = useMemo(() => cornerTowers(), []);
  const spots = useMemo(() => towerSpots(), []);

  return (
    <group>
      {/* Ground: a wide meadow and a cobbled courtyard on top. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[120, 0.5, 120]} position={[0, -0.5, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[110, 48]} />
        <meshStandardMaterial color={COLORS.grass} flatShading />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[COBBLE_RADIUS, COBBLE_RADIUS, 0.06, 48]} />
        <meshStandardMaterial color={COLORS.cobble} flatShading />
      </mesh>
      {/* Gate road leading out to the meadow. */}
      <mesh position={[0, 0.04, WALL_RADIUS + 12]} receiveShadow>
        <boxGeometry args={[6, 0.06, 26]} />
        <meshStandardMaterial color={COLORS.cobble} flatShading />
      </mesh>

      {/* Curtain wall. */}
      {walls.map((s, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[s.x, WALL_HEIGHT / 2, s.z]} rotation={[0, s.rotY, 0]}>
          <CuboidCollider args={[s.length / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[s.length, WALL_HEIGHT, WALL_THICKNESS]} />
            <meshStandardMaterial color={COLORS.stone} flatShading />
          </mesh>
        </RigidBody>
      ))}

      {/* Corner towers. */}
      {corners.map((t, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[t.x, CORNER_TOWER_HEIGHT / 2, t.z]}>
          <CylinderCollider args={[CORNER_TOWER_HEIGHT / 2, CORNER_TOWER_RADIUS]} />
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[CORNER_TOWER_RADIUS, CORNER_TOWER_RADIUS + 0.3, CORNER_TOWER_HEIGHT, 12]} />
            <meshStandardMaterial color={COLORS.stoneDark} flatShading />
          </mesh>
          <mesh position={[0, CORNER_TOWER_HEIGHT / 2 + 1.6, 0]} castShadow>
            <coneGeometry args={[CORNER_TOWER_RADIUS + 0.6, 3.2, 12]} />
            <meshStandardMaterial color={COLORS.roof} flatShading />
          </mesh>
        </RigidBody>
      ))}

      {/* The keep, at the north end. */}
      <RigidBody type="fixed" colliders={false} position={[KEEP.x, KEEP.height / 2, KEEP.z]}>
        <CuboidCollider args={[KEEP.width / 2, KEEP.height / 2, KEEP.depth / 2]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[KEEP.width, KEEP.height, KEEP.depth]} />
          <meshStandardMaterial color={COLORS.stone} flatShading />
        </mesh>
        <mesh position={[0, KEEP.height / 2 + 2, 0]} castShadow>
          <coneGeometry args={[KEEP.width * 0.62, 4, 4]} />
          <meshStandardMaterial color={COLORS.roof} flatShading />
        </mesh>
        {/* Door on the south face. */}
        <mesh position={[0, -KEEP.height / 2 + 2, KEEP.depth / 2 + 0.05]}>
          <boxGeometry args={[3, 4, 0.2]} />
          <meshStandardMaterial color={COLORS.gate} flatShading />
        </mesh>
      </RigidBody>

      {/* Eight pads, one per holding (week 2 raises real towers here). */}
      {spots.map((s, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[s.x, 0.25, s.z]}>
          <CuboidCollider args={[SPOT_SIZE / 2, 0.25, SPOT_SIZE / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[SPOT_SIZE, 0.5, SPOT_SIZE]} />
            <meshStandardMaterial color={COLORS.spot} flatShading />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
