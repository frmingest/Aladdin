import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import type { Object3D } from "three";
import { MARKET, MARKET_URL } from "./marketPieces";
import type { MarketPiece } from "./marketPieces";

/** If the market file fails to load, draw nothing (colliders included): the corner is open ground again. */
class MarketBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D marketplace failed to load, leaving it out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Piece({ piece, source }: { piece: MarketPiece; source: Object3D }) {
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
  const s = piece.solid;
  return (
    <RigidBody type="fixed" colliders={false} position={[piece.x, 0, piece.z]} rotation={[0, piece.yaw, 0]}>
      {s.kind === "circle" ? (
        <CylinderCollider args={[1, s.r]} position={[0, 1, 0]} />
      ) : (
        <CuboidCollider args={[s.hx, 1, s.hz]} position={[0, 1, 0]} />
      )}
      <primitive object={object} scale={piece.scale} />
    </RigidBody>
  );
}

function Pieces() {
  const gltf = useGLTF(MARKET_URL);
  return (
    <>
      {MARKET.map((p) => (
        <Piece key={p.id} piece={p} source={gltf.scene} />
      ))}
    </>
  );
}

/** The marketplace corner. Decoration only; no piece reads or shows any data. */
export default function Market() {
  return (
    <MarketBoundary>
      <Suspense fallback={null}>
        <Pieces />
      </Suspense>
    </MarketBoundary>
  );
}
