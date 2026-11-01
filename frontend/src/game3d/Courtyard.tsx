import { useMemo } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import TowerMesh from "./TowerMesh";
import { ModelClone, WithFallback } from "./KeepModels";
import { CORNER_TOWER_MODEL, CORNER_TOWER_SCALE, KEEP_MODEL, KEEP_MODEL_SCALE, KEEP_URL, cornerTowerFootprint, keepModelFootprint } from "./keepModels";
import type { WorldModel } from "./stateToWorld";
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
 * Each holding in `world` stands on one of the eight pads as a tower.
 */
export default function Courtyard({ world }: { world: WorldModel }) {
  const walls = useMemo(() => wallSegments(), []);
  const corners = useMemo(() => cornerTowers(), []);
  const spots = useMemo(() => towerSpots(), []);
  const tower = useMemo(() => cornerTowerFootprint(), []);
  const keepModel = useMemo(() => keepModelFootprint(), []);

  return (
    <group>
      {/* Ground: a wide meadow and a cobbled courtyard on top. */}
      <RigidBody type="fixed" colliders={false}>
        {/* Deep on purpose: one long frame (a model loading) must not let the hero fall through a thin slab. */}
        <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[160, 48]} />
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

      {/* Corner towers: KayKit model, plain shapes if the file does not load. */}
      {corners.map((t, i) => (
        <WithFallback
          key={i}
          fallback={<PlainCornerTower x={t.x} z={t.z} />}
          model={
            <RigidBody type="fixed" colliders={false} position={[t.x, 0, t.z]} rotation={[0, Math.atan2(-t.x, -t.z), 0]}>
              <CylinderCollider args={[tower.height / 2, tower.radius]} position={[0, tower.height / 2, 0]} />
              <ModelClone url={KEEP_URL} node={CORNER_TOWER_MODEL.node} scale={CORNER_TOWER_SCALE} />
            </RigidBody>
          }
        />
      ))}

      {/* The keep, at the north end: KayKit castle, the plain box if the file does not load. */}
      <WithFallback
        fallback={<PlainKeep />}
        model={
          <RigidBody type="fixed" colliders={false} position={[0, 0, keepModel.centerZ]}>
            <CuboidCollider args={[keepModel.width / 2, keepModel.height / 2, keepModel.depth / 2]} position={[0, keepModel.height / 2, 0]} />
            <ModelClone url={KEEP_URL} node={KEEP_MODEL.node} scale={KEEP_MODEL_SCALE} />
          </RigidBody>
        }
      />

      {/* Eight pads. A holding raises a tower on its pad; empty pads stay bare. */}
      {spots.map((s, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[s.x, 0.25, s.z]}>
          <CuboidCollider args={[SPOT_SIZE / 2, 0.25, SPOT_SIZE / 2]} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[SPOT_SIZE, 0.5, SPOT_SIZE]} />
            <meshStandardMaterial color={COLORS.spot} flatShading />
          </mesh>
        </RigidBody>
      ))}

      {world.towers.map((t) => (
        <TowerMesh key={t.holdingId} t={t} />
      ))}
    </group>
  );
}

/** The old plain-shape corner tower: the fallback when keep.glb does not load. */
function PlainCornerTower({ x, z }: { x: number; z: number }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[x, CORNER_TOWER_HEIGHT / 2, z]}>
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
  );
}

/** The old plain-shape keep: the fallback when keep.glb does not load. */
function PlainKeep() {
  return (
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
  );
}
