import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";
import { INK, PAL, Part } from "./Inked";
import LandBlock from "./LandBlock";
import { HOLDING_URL } from "./holdingPieces";
import { mineDressing } from "./mineDressing";
import type { MineTheme, Piece } from "./mineDressing";
import type { LandCondition } from "./landCondition";
import { TOWN_FILES } from "./townPieces";

/** If a model file fails to load, the plain placeholder block stands in (it wears the same ladder), so the land never breaks. */
class DressingBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D land dressing failed to load, using the plain block:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Model({ source, piece }: { source: Object3D; piece: Piece }) {
  const object = useMemo(() => {
    const node = source.getObjectByName(piece.node);
    if (!node) return null;
    const copy = node.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [source, piece.node]);
  if (!object) return null;
  return (
    <group position={[piece.x, piece.y ?? 0, piece.z]} rotation={[0, piece.yaw ?? 0, piece.lean ?? 0]}>
      <primitive object={object} scale={piece.scale} />
    </group>
  );
}

/** Timber props leaning on the structure; broken ones are short and cracked off. Code-built, so shape (not colour) says the wall tier. */
function Props({ props }: { props: { x: number; z: number; broken: boolean }[] }) {
  return (
    <>
      {props.map((p, i) => (
        <mesh key={i} position={[p.x, p.broken ? 0.4 : 0.8, p.z]} rotation={[0, 0, (p.x > 0 ? 1 : -1) * (p.broken ? 0.9 : 0.5)]}>
          <boxGeometry args={[0.16, p.broken ? 0.8 : 1.6, 0.16]} />
          <meshStandardMaterial color={PAL.timberDark} flatShading />
        </mesh>
      ))}
    </>
  );
}

function Dressing({ theme, condition }: { theme: MineTheme; condition: LandCondition }) {
  const plan = useMemo(() => mineDressing(theme, condition), [theme, condition]);
  const own = useGLTF(HOLDING_URL(theme));
  const builder = useGLTF(TOWN_FILES.buildings);
  const frontZ = theme === "mine" ? 1.35 : 0.2;
  return (
    <group>
      {plan.pieces.map((p, i) => (
        <Model key={`${p.node}-${i}`} source={p.file === "own" ? own.scene : builder.scene} piece={p} />
      ))}
      {/* The stone footing: the proud part. Full on Sound, half on Solid, none below. */}
      {plan.trim > 0 && (
        <Part color={PAL.slate} position={[0, 0.06 + 0.06 * plan.trim, theme === "mine" ? 2.4 : 2.2]} grow={1.06}>
          <boxGeometry args={[2.4, 0.12 + 0.12 * plan.trim, 0.5]} />
        </Part>
      )}
      {/* The quarry's cut face: three stepped blocks at the back. */}
      {plan.cutFace && (
        <>
          <Part color={PAL.slateDark} position={[0, 0.35, -1.6]} grow={1.04}>
            <boxGeometry args={[2.6, 0.7, 0.7]} />
          </Part>
          <Part color={PAL.slate} position={[-0.4, 0.95, -1.75]} grow={1.04}>
            <boxGeometry args={[1.8, 0.4, 0.5]} />
          </Part>
          <Part color={PAL.slateDark} position={[-0.7, 1.35, -1.85]} grow={1.04}>
            <boxGeometry args={[1.0, 0.4, 0.35]} />
          </Part>
        </>
      )}
      <Props props={plan.props} />
      {Array.from({ length: plan.patches }, (_, i) => (
        <mesh key={i} position={[0.8 - i * 1.0, theme === "mine" ? 1.0 : 0.7, frontZ + (theme === "mine" ? 0.5 : -2.3)]}>
          <boxGeometry args={[0.5, 0.4, 0.05]} />
          <meshStandardMaterial color={PAL.timberLight} flatShading />
        </mesh>
      ))}
      {plan.crack &&
        [0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.3 + i * 0.35, (theme === "mine" ? 0.8 : 0.3) + (i % 2) * 0.35, theme === "mine" ? 1.55 : -1.22]} rotation={[0, 0, i % 2 ? 0.7 : -0.7]}>
            <boxGeometry args={[0.09, 0.8, 0.04]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
    </group>
  );
}

/**
 * The gold mine and quarry dressings for the land's centre (S26 PR 5). The theme comes from the sector, the condition
 * from the wall tier only (`landCondition`). Everything is still, so reduced motion changes nothing. If a file fails to
 * load the plain block stands in, wearing the same condition.
 */
export default function MineDressing({ theme, condition }: { theme: MineTheme; condition: LandCondition }) {
  const plain = <LandBlock condition={condition} />;
  return (
    <DressingBoundary fallback={plain}>
      <Suspense fallback={plain}>
        <Dressing theme={theme} condition={condition} />
      </Suspense>
    </DressingBoundary>
  );
}
