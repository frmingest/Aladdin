import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import type { Object3D } from "three";
import { SCENERY, SCENERY_URL } from "./sceneryPieces";
import type { SceneryPiece } from "./sceneryPieces";

/** If the scenery file fails to load, draw nothing at all (colliders included): the courtyard stays as it was. */
class SceneryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D scenery failed to load, leaving it out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Piece({ piece, source }: { piece: SceneryPiece; source: Object3D }) {
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
    <RigidBody type="fixed" colliders={false} position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
      {piece.solid > 0 && <CylinderCollider args={[1, piece.solid]} position={[0, 1 - piece.y, 0]} />}
      <primitive object={object} scale={piece.scale} />
    </RigidBody>
  );
}

function Pieces() {
  const gltf = useGLTF(SCENERY_URL);
  return (
    <>
      {SCENERY.map((p) => (
        <Piece key={p.id} piece={p} source={gltf.scene} />
      ))}
    </>
  );
}

/** Torches, banners and clutter. Decoration only; no piece reads or shows any data. */
export default function Scenery() {
  return (
    <SceneryBoundary>
      <Suspense fallback={null}>
        <Pieces />
      </Suspense>
    </SceneryBoundary>
  );
}
