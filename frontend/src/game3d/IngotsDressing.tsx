import StaticBatch from "./StaticBatch";
import { INK, PAL } from "./Inked";
import HoldingPiece from "./HoldingPiece";
import { BARRIER_RING, BARRIER_SCALE, PILES, barrierAt, ingotsPlan } from "./ingotsDressing";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { WithFallback } from "./KeepModels";

const DEG = Math.PI / 180;
const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

function Piece(props: { node: string; scale: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  return <HoldingPiece theme="ingots" {...props} />;
}

/**
 * The bullion vault (S27 PR 1): a gold chest and fixed piles inside a ring of six low barred barriers that wear the
 * condition ladder (see ingotsDressing.ts). The treasure is the same for every holding and every rung. Still, always.
 */
function Vault({ condition }: { condition: LandCondition }) {
  const p = ingotsPlan(condition);
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      {p.footing > 0 && (
        <mesh position={[0, p.footing / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[BARRIER_RING - 0.3, BARRIER_RING - 0.25, p.footing, 24]} />
          <meshStandardMaterial color={PAL.slate} flatShading />
        </mesh>
      )}
      {PILES.map((x, i) => {
        const pos = at(x.angle, x.r);
        return <Piece key={`${x.node}${i}`} node={x.node} scale={x.scale} position={[pos[0], p.footing + (x.y ?? 0), pos[2]]} rotation={[0, x.rotation ?? -x.angle, 0]} />;
      })}
      {p.columns.map((c) => {
        if (c.state === "gone") return null;
        const b = barrierAt(c.angle);
        return c.state === "standing" ? (
          <group key={c.slot} position={[b.x, p.footing, b.z]} rotation={[0, b.rotY, 0]}>
            <Piece node="barrier_column" scale={BARRIER_SCALE} position={[0, 0, 0]} rotation={[c.lean * DEG, 0, 0]} />
          </group>
        ) : (
          <group key={c.slot} position={[b.x, 0.12, b.z]} rotation={[0, b.rotY + 0.3, 0]}>
            <Piece node="barrier_column" scale={BARRIER_SCALE} position={[0, 0, 0]} rotation={[Math.PI / 2.2, 0, 0]} />
          </group>
        );
      })}
      {p.props.map((pr, i) => {
        const pos = at(pr.angle, BARRIER_RING - 0.4);
        return (
          <mesh key={`prop${i}`} position={[pos[0], pr.broken ? 0.3 : 0.55, pos[2]]} rotation={[0, 0, pr.broken ? 0.9 : 0.4]} castShadow>
            <boxGeometry args={[0.12, pr.broken ? 0.6 : 1.1, 0.12]} />
            <meshStandardMaterial color={PAL.timberDark} flatShading />
          </mesh>
        );
      })}
      {Array.from({ length: p.looseBoards }, (_, i) => {
        const pos = at(0.6 + i * 1.7, 1.5);
        return (
          <mesh key={`board${i}`} position={[pos[0], p.footing + 0.4, pos[2]]} rotation={[0.5 + i * 0.2, i, 0.3]}>
            <boxGeometry args={[0.1, 0.6, 0.22]} />
            <meshStandardMaterial color={PAL.timber} flatShading />
          </mesh>
        );
      })}
      {p.patches.map((m, i) => {
        const b = barrierAt(m.angle);
        return (
          <mesh key={`patch${i}`} position={[b.x, p.footing + 0.5, b.z]} rotation={[0, b.rotY, 0]}>
            <boxGeometry args={[0.4, 0.06, 0.1]} />
            <meshStandardMaterial color={PAL.timberLight} flatShading />
          </mesh>
        );
      })}
      {p.cracks.map((m, i) => {
        const b = barrierAt(m.angle);
        return (
          <mesh key={`crack${i}`} position={[b.x, p.footing + 0.5, b.z]} rotation={[0, b.rotY + (i % 2 ? 0.5 : -0.5), 0]}>
            <boxGeometry args={[0.45, 0.04, 0.05]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the file loads or if it fails, so a land is never empty. */
export default function IngotsDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Vault condition={condition} />} fallback={<LandBlock condition={condition} />} />
    </group>
  );
}
