import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";
import StaticBatch from "./StaticBatch";
import { INK, PAL } from "./Inked";
import { HOLDING_URL } from "./holdingPieces";
import { COLUMN_RING, COLUMN_SCALE, FOUNTAIN_SCALE, WELL_ANGLE, WELL_SCALE, fountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { WithFallback } from "./KeepModels";

const NATURE = "/models/town-nature.glb";
const DEG = Math.PI / 180;
const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

/** One clone of a named node, placed. The pieces are still and carry no fact, so they ride the static batch. */
function Piece({ url, node, scale, position, rotation = [0, 0, 0] }: { url: string; node: string; scale: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const gltf = useGLTF(url);
  const object = useMemo<Object3D | null>(() => {
    const found = gltf.scene.getObjectByName(node);
    if (!found) return null;
    const copy = found.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [gltf, node]);
  if (!object) return null;
  return <primitive object={object} scale={scale} position={position} rotation={rotation} />;
}

/**
 * The fountain square (S26 PR 4): Kenney's round fountain, a well, and a ring of columns that wear the condition ladder
 * (see fountainDressing.ts). Still, always: nothing moves, so reduced motion changes nothing. The stream band round it is
 * drawn by the slot from the moat tier; the fountain's own water is scenery and carries no fact.
 */
function Square({ condition }: { condition: LandCondition }) {
  const p = fountainPlan(condition);
  const HOLD = HOLDING_URL("fountain");
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      {p.footing > 0 && (
        <mesh position={[0, p.footing / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.55, 1.6, p.footing, 24]} />
          <meshStandardMaterial color={PAL.slate} flatShading />
        </mesh>
      )}
      <Piece url={NATURE} node="fountain_round_detail" scale={FOUNTAIN_SCALE} position={[0, p.footing, 0]} />
      <Piece url="/models/market.glb" node="well" scale={WELL_SCALE} position={at(WELL_ANGLE, COLUMN_RING + 0.25)} rotation={[0, -WELL_ANGLE, 0]} />
      {p.columns.map((c) =>
        c.state === "standing" ? (
          <Piece key={c.slot} url={HOLD} node="column" scale={COLUMN_SCALE} position={at(c.angle, COLUMN_RING)} rotation={[0, 0, -c.lean * DEG]} />
        ) : c.state === "fallen" ? (
          <Piece key={c.slot} url={HOLD} node="column" scale={COLUMN_SCALE} position={[at(c.angle, COLUMN_RING + 0.1)[0], 0.32, at(c.angle, COLUMN_RING + 0.1)[2]]} rotation={[Math.PI / 2, 0, c.angle + 0.5]} />
        ) : null,
      )}
      {p.props.map((pr, i) => {
        const pos = at(pr.angle, COLUMN_RING - 0.35);
        return (
          <mesh key={`prop${i}`} position={[pos[0], pr.broken ? 0.3 : 0.6, pos[2]]} rotation={[0, 0, pr.broken ? 0.9 : 0.4]} castShadow>
            <boxGeometry args={[0.12, pr.broken ? 0.6 : 1.2, 0.12]} />
            <meshStandardMaterial color={PAL.timberDark} flatShading />
          </mesh>
        );
      })}
      {Array.from({ length: p.looseBoards }, (_, i) => {
        const pos = at(0.6 + i * 1.7, 1.3);
        return (
          <mesh key={`board${i}`} position={[pos[0], p.footing + 0.5, pos[2]]} rotation={[0.5 + i * 0.2, i, 0.3]}>
            <boxGeometry args={[0.1, 0.6, 0.22]} />
            <meshStandardMaterial color={PAL.timber} flatShading />
          </mesh>
        );
      })}
      {p.patches.map((m, i) => {
        const pos = at(m.angle, 1.18);
        return (
          <mesh key={`patch${i}`} position={[pos[0], p.footing + 0.4, pos[2]]} rotation={[0, -m.angle, 0]}>
            <boxGeometry args={[0.18, 0.05, 0.4]} />
            <meshStandardMaterial color={PAL.timberLight} flatShading />
          </mesh>
        );
      })}
      {p.cracks.map((m, i) => {
        const pos = at(m.angle, 1.2);
        return (
          <mesh key={`crack${i}`} position={[pos[0], p.footing + 0.41, pos[2]]} rotation={[0, -m.angle + (i % 2 ? 0.5 : -0.5), 0]}>
            <boxGeometry args={[0.05, 0.04, 0.45]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the files load or if they fail, so a land is never empty. */
export default function FountainDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Square condition={condition} />} fallback={<LandBlock condition={condition} />} />
    </group>
  );
}
