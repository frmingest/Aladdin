import { Component, Suspense, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Object3D } from "three";
import { INK, PAL, Part } from "./Inked";
import { PENNANT_COLOUR, STALL_SOLID, plateWords } from "./streetPlan";
import type { PennantShape, Stall } from "./streetPlan";
import { TOWN_FILES, TOWN_SCALE } from "./townPieces";

/** If the town market file fails to load, draw nothing (colliders included): the ground is open again. */
class StreetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D Market Street failed to load, leaving it out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Flags on the pole: [width, height, offset up the pole]. The shape says the tone, colour only helps. */
const FLAGS: Record<PennantShape, readonly (readonly [number, number, number])[]> = {
  double: [[0.9, 0.32, 0], [0.9, 0.32, -0.5]],
  long: [[1.5, 0.34, 0]],
  short: [[0.7, 0.34, 0]],
  none: [],
};

/** A bare pole by the stall with the pennant on it. Code-built: this is the only part that carries a fact. */
function Pennant({ stall }: { stall: Stall }) {
  const colour = PENNANT_COLOUR[stall.tone];
  return (
    <group position={[1.5, 0, 0.9]}>
      <Part color={PAL.timberDark} position={[0, 1.9, 0]} grow={1.15}>
        <boxGeometry args={[0.12, 3.8, 0.12]} />
      </Part>
      {FLAGS[stall.pennant].map(([w, h, dy]) => (
        <Part key={dy} color={colour} position={[w / 2 + 0.06, 3.5 + dy, 0]} grow={1.12}>
          <boxGeometry args={[w, h, 0.05]} />
        </Part>
      ))}
    </group>
  );
}

const PLATE_W = 2.4;
const PLATE_H = 0.8;

/** Dark ink on cream, like the tower signboards: the name on top, the flat page's word and gap below. */
function paintPlate(name: string, line: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 128;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = PAL.cream;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = PAL.timberDark;
  g.lineWidth = 8;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 40px "Segoe UI", system-ui, sans-serif`;
  g.fillText(name, c.width / 2, 40, c.width - 28);
  g.font = `600 34px "Segoe UI", system-ui, sans-serif`;
  g.fillText(line, c.width / 2, 92, c.width - 28);
  return c;
}

/** A small plate on two stakes in front of the stall. It is words only; the flag above says the same in a shape. */
function Plate({ stall }: { stall: Stall }) {
  const tex = useMemo(() => {
    const { name, line } = plateWords(stall);
    const x = new CanvasTexture(paintPlate(name, line));
    x.colorSpace = SRGBColorSpace;
    x.anisotropy = 4;
    return x;
  }, [stall]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, 0, 1.9]}>
      {([-0.95, 0.95] as const).map((x) => (
        <Part key={x} color={PAL.timberDark} position={[x, 0.4, 0]} grow={1.15}>
          <boxGeometry args={[0.1, 0.8, 0.1]} />
        </Part>
      ))}
      <Part color={PAL.timber} position={[0, 0.95, 0]} grow={1.04}>
        <boxGeometry args={[PLATE_W + 0.2, PLATE_H + 0.2, 0.08]} />
      </Part>
      <mesh position={[0, 0.95, 0.045]}>
        <planeGeometry args={[PLATE_W, PLATE_H]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function StallPiece({ stall, source }: { stall: Stall; source: Object3D }) {
  const object = useMemo(() => {
    const node = source.getObjectByName(stall.model);
    if (!node) return null;
    const copy = node.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [source, stall.model]);
  if (!object) return null;
  return (
    <RigidBody type="fixed" colliders={false} position={[stall.x, 0, stall.z]} rotation={[0, stall.yaw, 0]}>
      <CuboidCollider args={[STALL_SOLID.hx, 1, STALL_SOLID.hz]} position={[0, 1, 0]} />
      <primitive object={object} scale={TOWN_SCALE.kenney} />
      <Pennant stall={stall} />
      <Plate stall={stall} />
    </RigidBody>
  );
}

function Stalls({ stalls }: { stalls: readonly Stall[] }) {
  const gltf = useGLTF(TOWN_FILES.market);
  return (
    <>
      {stalls.map((s) => (
        <StallPiece key={s.holdingId} stall={s} source={gltf.scene} />
      ))}
    </>
  );
}

/**
 * Market Street: one stall per watchlist company. The stall model is decoration; the pennant (shape and words
 * from the flat page's price tag) is the only part that says anything. With no watchlist nothing loads at all.
 */
export default function MarketStreet({ stalls }: { stalls: readonly Stall[] }) {
  if (stalls.length === 0) return null;
  return (
    <StreetBoundary>
      <Suspense fallback={null}>
        <Stalls stalls={stalls} />
      </Suspense>
    </StreetBoundary>
  );
}
