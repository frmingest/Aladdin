import { Component, Suspense, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import type { Object3D } from "three";
import { PAL, Part } from "./Inked";
import { TOWN_FILES } from "./townPieces";
import { BUILDINGS, DOOR_LEAVE_RANGE, DOOR_RANGE, EXIT_LEAVE_RANGE, EXIT_RANGE, TOWN_EXIT, TOWN_RADIUS, WELL, doorSpot, nearTownExit, nearestBuilding } from "./townPlan";
import type { Building, BuildingId } from "./townPlan";

/** The same flat palette as the courtyard, so nothing in the Town is flattered by its colour. */
const COLORS = { grass: "#7a9e5c", cobble: "#a89f91" } as const;

/** If the buildings file fails to load, the buildings (and their colliders) are left out; the ground, signs and road back stay. */
class BuildingsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D town buildings failed to load, leaving them out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Model({ source, name, scale }: { source: Object3D; name: string; scale: number }) {
  const object = useMemo(() => {
    const node = source.getObjectByName(name);
    if (!node) return null;
    const copy = node.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [source, name]);
  return object ? <primitive object={object} scale={scale} /> : null;
}

function BuildingMesh({ b, source }: { b: Building; source: Object3D }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
      <CuboidCollider args={[b.hx, 2, b.hz]} position={[0, 2, 0]} />
      <Model source={source} name={b.model} scale={5.5} />
    </RigidBody>
  );
}

function Buildings() {
  const gltf = useGLTF(TOWN_FILES.buildings);
  return (
    <>
      {BUILDINGS.map((b) => (
        <BuildingMesh key={b.id} b={b} source={gltf.scene} />
      ))}
      <RigidBody type="fixed" colliders={false} position={[WELL.x, 0, WELL.z]}>
        <CylinderCollider args={[1, WELL.r * 0.8]} position={[0, 1, 0]} />
        <Model source={gltf.scene} name="well" scale={WELL.scale} />
      </RigidBody>
    </>
  );
}

/** A name over a door and a doormat on the ground, so you know where to stand. Code-built; it carries no fact. */
function DoorMark({ b, active }: { b: Building; active: boolean }) {
  const s = doorSpot(b);
  return (
    <group position={[s.x, 0, s.z]}>
      <Part color={active ? PAL.teal : PAL.cream} position={[0, 0.09, 0]} rotation={[0, b.yaw, 0]} grow={1.05}>
        <boxGeometry args={[2.6, 0.08, 1.4]} />
      </Part>
      <Html position={[0, 2.2, 0]} center distanceFactor={14} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="g3d-nameplate" aria-hidden="true">{b.label}</div>
      </Html>
    </group>
  );
}

/** The post at the north end of the road: a pennant and a board pointing back to the courtyard. Shape only. */
function ExitPost() {
  return (
    <group position={[TOWN_EXIT.x + 4.5, 0, TOWN_EXIT.z]}>
      <Part color={PAL.timberDark} position={[0, 1.75, 0]} grow={1.12}>
        <boxGeometry args={[0.24, 3.5, 0.24]} />
      </Part>
      <Part color={PAL.timberLight} position={[-0.7, 2.6, 0.15]} grow={1.1}>
        <boxGeometry args={[1.4, 0.34, 0.08]} />
      </Part>
      <Part color={PAL.teal} position={[0, 3.7, 0]} grow={1.15}>
        <boxGeometry args={[0.7, 0.3, 0.05]} />
      </Part>
    </group>
  );
}

/** Tells the page which door the hero is at, and when the road back is in reach. Only on change. */
function TownWatch({
  pos,
  onNearBuilding,
  onNearExit,
}: {
  pos: MutableRefObject<{ x: number; z: number }>;
  onNearBuilding: (id: BuildingId | null) => void;
  onNearExit: (near: boolean) => void;
}) {
  const lastB = useRef<BuildingId | null>(null);
  const lastE = useRef(false);
  useFrame(() => {
    const b = nearestBuilding(pos.current, BUILDINGS, lastB.current ? DOOR_LEAVE_RANGE : DOOR_RANGE);
    if (b !== lastB.current) {
      lastB.current = b;
      onNearBuilding(b);
    }
    const e = nearTownExit(pos.current, lastE.current ? EXIT_LEAVE_RANGE : EXIT_RANGE);
    if (e !== lastE.current) {
      lastE.current = e;
      onNearExit(e);
    }
  });
  return null;
}

interface Props {
  pos: MutableRefObject<{ x: number; z: number }>;
  near: BuildingId | null;
  onNearBuilding: (id: BuildingId | null) => void;
  onNearExit: (near: boolean) => void;
}

/**
 * The Town beyond the gate: a meadow, a cobbled plaza, a road back, and four buildings that are doors to the
 * flat pages that are not stores. Ground, signs and the road back are code-built, so a failed model load leaves
 * a bare but working Town. Lighting stays flat and the same everywhere.
 */
export default function Town({ pos, near, onNearBuilding, onNearExit }: Props) {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {/* Deep on purpose: one long frame (a model loading) must not let the hero fall through a thin slab. */}
        <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color={COLORS.grass} flatShading />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[TOWN_RADIUS * 0.4, TOWN_RADIUS * 0.4, 0.06, 40]} />
        <meshStandardMaterial color={COLORS.cobble} flatShading />
      </mesh>
      {/* The road from the plaza north to the way back. */}
      <mesh position={[0, 0.04, (TOWN_EXIT.z - 4) / 2]} receiveShadow>
        <boxGeometry args={[6, 0.06, Math.abs(TOWN_EXIT.z) + 4]} />
        <meshStandardMaterial color={COLORS.cobble} flatShading />
      </mesh>
      <ExitPost />
      {BUILDINGS.map((b) => (
        <DoorMark key={b.id} b={b} active={near === b.id} />
      ))}
      <BuildingsBoundary>
        <Suspense fallback={null}>
          <Buildings />
        </Suspense>
      </BuildingsBoundary>
      <TownWatch pos={pos} onNearBuilding={onNearBuilding} onNearExit={onNearExit} />
    </group>
  );
}
