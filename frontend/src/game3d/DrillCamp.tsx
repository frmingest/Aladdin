import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import type { Object3D } from "three";
import { CAMP, CAMP_URL } from "./campPieces";
import type { CampPiece } from "./campPieces";

/** If the camp file fails to load, draw nothing: the drill still works, there is just no camp. */
class CampBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D drill camp failed to load, leaving it out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Piece({ piece, source }: { piece: CampPiece; source: Object3D }) {
  const object = useMemo(() => {
    const node = source.getObjectByName(piece.model);
    if (!node) return null;
    const copy = node.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [source, piece.model]);
  if (!object) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={[piece.x, 0, piece.z]} rotation={[0, piece.yaw, 0]}>
      {piece.solid > 0 && <CylinderCollider args={[1, piece.solid]} position={[0, 1, 0]} />}
      <primitive object={object} scale={piece.scale} />
    </RigidBody>
  );
}

function Pieces() {
  const gltf = useGLTF(CAMP_URL);
  return (
    <>
      {CAMP.map((p) => (
        <Piece key={p.id} piece={p} source={gltf.scene} />
      ))}
    </>
  );
}

/**
 * The drill camp. Mounted only while a drill is open, so the file is not even fetched until the
 * first drill. Nothing moves, nothing in it depends on a holding or on the fall you chose.
 */
export default function DrillCamp() {
  return (
    <CampBoundary>
      <Suspense fallback={null}>
        <Pieces />
      </Suspense>
    </CampBoundary>
  );
}
