import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { Object3D } from "three";
import { PAL, Part } from "./Inked";
import { TOWN_OUTLINE_WORLD, addOutlines } from "./outline";
import { Smoke } from "./Embers";
import { CHIMNEYS } from "./fxPlan";
import { TOWN_FILES } from "./townPieces";
import { BUILDINGS, DOOR_LEAVE_RANGE, DOOR_RANGE, doorSpot, nearestBuilding } from "./townPlan";
import type { Building, BuildingId } from "./townPlan";
import WorldSign from "./WorldSign";

/** If the buildings file fails to load, the buildings (and their colliders) are left out; the door mats and name boards stay. */
export class BuildingsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D village buildings failed to load, leaving them out:", error);
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
  // The same ink line the people and code-built shapes have, so a building is not the odd one out (polish pass, outlines).
  useEffect(() => (object ? addOutlines(object, TOWN_OUTLINE_WORLD / scale) : undefined), [object, scale]);
  return object ? <primitive object={object} scale={scale} /> : null;
}

export function BuildingMesh({ b, source }: { b: Building; source: Object3D }) {
  return (
    <RigidBody type="fixed" colliders={false} position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
      <CuboidCollider args={[b.hx, 2, b.hz]} position={[0, 2, 0]} />
      <Model source={source} name={b.model} scale={5.5} />
      {CHIMNEYS.filter((c) => c.model === b.model).map((c) => (
        <Smoke key={c.model} position={[c.x * 5.5, c.y * 5.5, c.z * 5.5]} />
      ))}
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
    </>
  );
}

/** A name over a door and a doormat on the ground, so you know where to stand. Code-built; it carries no fact. */
export function DoorMark({ b, active }: { b: Building; active: boolean }) {
  const s = doorSpot(b);
  return (
    <group position={[s.x, 0, s.z]}>
      <Part color={active ? PAL.teal : PAL.cream} position={[0, 0.09, 0]} rotation={[0, b.yaw, 0]} grow={1.05}>
        <boxGeometry args={[2.6, 0.08, 1.4]} />
      </Part>
      {/* The name hangs on a two-post sign over the mat, so it stands on something. */}
      <group rotation={[0, b.yaw, 0]}>
        {([-1.6, 1.6] as const).map((x) => (
          <Part key={x} color={PAL.timberDark} position={[x, 1.3, 0]} grow={1.12}>
            <boxGeometry args={[0.16, 2.6, 0.16]} />
          </Part>
        ))}
        <WorldSign spec={{ kind: "plank", lines: [b.label] }} position={[0, 2.25, 0]} width={2.8} />
      </group>
    </group>
  );
}

/** Tells the page which door the hero is at. Only on change. */
function VillageWatch({ pos, onNearBuilding }: { pos: MutableRefObject<{ x: number; z: number }>; onNearBuilding: (id: BuildingId | null) => void }) {
  const last = useRef<BuildingId | null>(null);
  useFrame(() => {
    const b = nearestBuilding(pos.current, BUILDINGS, last.current ? DOOR_LEAVE_RANGE : DOOR_RANGE);
    if (b !== last.current) {
      last.current = b;
      onNearBuilding(b);
    }
  });
  return null;
}

interface Props {
  pos: MutableRefObject<{ x: number; z: number }>;
  near: BuildingId | null;
  onNearBuilding: (id: BuildingId | null) => void;
}

/**
 * The Town on the meadow, just outside the gate (2026-11-10): six buildings in two rows either side of the gate road, each a
 * door (a mat on the ground and a name board) to the flat pages that are not stores, or to a room of its own. The ground and the
 * road are the courtyard's, so there is nothing to carry here but the buildings and their doors. If the models fail to load
 * the mats and boards stay, so every door can still be found and used.
 */
export default function Village({ pos, near, onNearBuilding }: Props) {
  return (
    <group>
      {BUILDINGS.map((b) => (
        <DoorMark key={b.id} b={b} active={near === b.id} />
      ))}
      <BuildingsBoundary>
        <Suspense fallback={null}>
          <Buildings />
        </Suspense>
      </BuildingsBoundary>
      <VillageWatch pos={pos} onNearBuilding={onNearBuilding} />
    </group>
  );
}
