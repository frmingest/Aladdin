import { Component, Suspense, useMemo } from "react";
import type { ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import type { Object3D } from "three";
import { INK, PAL, Part } from "./Inked";
import { MILL_FILE_URL, millPlan } from "./millDressing";
import type { MillPiece, MillTheme } from "./millDressing";
import { WORKPLACE } from "./holdingLand";
import type { LandCentreSlot } from "./landCentre";

/** If a mill file fails to load, the land keeps its footing and stone but loses the mill (never the whole scene). */
class MillBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("3D mill dressing failed to load, leaving it out:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** One piece from a packed file, set down with its middle on (x, z) and its foot (or top) on y, then scaled. */
function Piece({ p, source }: { p: MillPiece; source: Object3D }) {
  const object = useMemo(() => {
    // Look among the file's top-level nodes only: the scene itself is named like the building ("windmill"), and the loader
    // renames the real node to "windmill_1", so a lookup by name through the whole tree would return the entire file.
    const node = source.children.find((c) => c.name === p.node) ?? source.children.find((c) => c.name === `${p.node}_1`);
    if (!node) return null;
    const copy = node.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const box = new Box3().setFromObject(copy);
    const c = box.getCenter(new Vector3());
    copy.position.set(copy.position.x - c.x, copy.position.y - (p.anchor === "top" ? box.max.y : box.min.y), copy.position.z - c.z);
    return copy;
  }, [source, p.node, p.anchor]);
  if (!object) return null;
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.yaw, (-p.lean * Math.PI) / 180]} scale={p.scale}>
      <primitive object={object} />
    </group>
  );
}

function Mill({ theme, slot }: { theme: MillTheme; slot: LandCentreSlot }) {
  const windmill = useGLTF(MILL_FILE_URL["holding-windmill"]);
  const watermill = useGLTF(MILL_FILE_URL["holding-watermill"]);
  const plan = useMemo(() => millPlan(theme, slot.condition), [theme, slot.condition]);
  const lean = (plan.buildingLean * Math.PI) / 180;
  const sources = { "holding-windmill": windmill.scene, "holding-watermill": watermill.scene };
  const building = plan.pieces[0]!;
  const rest = plan.pieces.slice(1);
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      {/* The footing is the proud part: full on Sound, half on Solid, none on the rest and on the neutral (the same rule as the plain block). */}
      {plan.code.footing > 0 && (
        <Part color={PAL.slate} position={[0, 0.06 * plan.code.footing + 0.03, building.z]} grow={1.05}>
          <cylinderGeometry args={[1.9, 2.0, 0.12 * plan.code.footing + 0.06, 24]} />
        </Part>
      )}
      <group position={[0, 0, building.z]} rotation={[0, 0, -lean]}>
        <Piece p={{ ...building, z: 0 }} source={sources[building.file]} />
        {/* Patches: plain lighter squares on the front. */}
        {Array.from({ length: plan.code.patches }, (_, i) => (
          <mesh key={i} position={[0.45 - i * 0.9, 1.1, 0.75]}>
            <boxGeometry args={[0.5, 0.4, 0.04]} />
            <meshStandardMaterial color={PAL.timberLight} flatShading />
          </mesh>
        ))}
        {/* The crack: three thin dark bars across the front. */}
        {plan.code.crack &&
          [0, 1, 2].map((i) => (
            <mesh key={i} position={[-0.3 + i * 0.35, 1.2 + (i % 2) * 0.6, 0.78]} rotation={[0, 0, i % 2 ? 0.7 : -0.7]}>
              <boxGeometry args={[0.09, 0.8, 0.04]} />
              <meshBasicMaterial color={INK} />
            </mesh>
          ))}
      </group>
      {rest.map((p, i) => (
        <Piece key={i} p={p} source={sources[p.file]} />
      ))}
    </group>
  );
}

/**
 * The windmill or watermill dressing (S26 PR 2). Condition comes from `slot.condition` alone (the ladder); the stream band
 * is drawn by the centre slot from `slot.stream`. The windmill stands still. Nothing here reads the sector beyond choosing
 * which of the two mills to draw.
 */
export default function MillDressing({ slot }: { slot: LandCentreSlot }) {
  const theme: MillTheme = slot.theme === "watermill" ? "watermill" : "windmill";
  return (
    <MillBoundary>
      <Suspense fallback={null}>
        <Mill theme={theme} slot={slot} />
      </Suspense>
    </MillBoundary>
  );
}
