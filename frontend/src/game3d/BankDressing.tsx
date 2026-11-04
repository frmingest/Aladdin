import StaticBatch from "./StaticBatch";
import { INK, PAL } from "./Inked";
import HoldingPiece from "./HoldingPiece";
import { DESK_LEG_SCALE, DESK_SHELF_Y, DESK_SHELF_Z, DESK_LEG_X, DESK_SHELF_SCALE, DESK_THINGS, DESK_TOP, PILES, WALL_RING, WALL_SCALE, bankPlan, deskAt, wallAt, wallNode } from "./bankDressing";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { WithFallback } from "./KeepModels";

const DEG = Math.PI / 180;
const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

function Piece(props: { node: string; scale: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  return <HoldingPiece theme="bank" {...props} />;
}

/**
 * The bank vault (A2): a gold chest, coin stacks and a writing desk inside a ring of six barred walls that wear the
 * condition ladder (see bankDressing.ts). The treasure and the desk are the same for every holding and every rung. Still, always.
 */
function Vault({ condition }: { condition: LandCondition }) {
  const p = bankPlan(condition);
  const desk = deskAt();
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      {p.footing > 0 && (
        <mesh position={[0, p.footing / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[WALL_RING - 0.3, WALL_RING - 0.25, p.footing, 24]} />
          <meshStandardMaterial color={PAL.slate} flatShading />
        </mesh>
      )}
      {PILES.map((x) => {
        const pos = at(x.angle, x.r);
        return <Piece key={x.node} node={x.node} scale={x.scale} position={[pos[0], p.footing, pos[2]]} rotation={[0, -x.angle, 0]} />;
      })}
      <group position={[desk.x, p.footing, desk.z]} rotation={[0, desk.rotY, 0]}>
        {[-DESK_LEG_X, DESK_LEG_X].map((x) => (
          <Piece key={x} node="column" scale={DESK_LEG_SCALE} position={[x, 0, 0]} />
        ))}
        <Piece node="shelf_large" scale={DESK_SHELF_SCALE} position={[0, DESK_SHELF_Y, DESK_SHELF_Z]} />
        {DESK_THINGS.map((t) => (
          <Piece key={t.node} node={t.node} scale={t.scale} position={[t.x, DESK_TOP + t.lift, t.z]} rotation={[t.rotX ?? 0, t.rotY ?? 0, 0]} />
        ))}
      </group>
      {p.columns.map((c) => {
        if (c.state === "gone") return null;
        const w = wallAt(c.angle);
        const node = wallNode(c.slot);
        return c.state === "standing" ? (
          <group key={c.slot} position={[w.x, p.footing, w.z]} rotation={[0, w.rotY, 0]}>
            <Piece node={node} scale={WALL_SCALE} position={[0, 0, 0]} rotation={[c.lean * DEG, 0, 0]} />
          </group>
        ) : (
          <group key={c.slot} position={[w.x, 0.3, w.z]} rotation={[0, w.rotY + 0.3, 0]}>
            <Piece node={node} scale={WALL_SCALE} position={[0, 0, 0]} rotation={[Math.PI / 2.2, 0, 0]} />
          </group>
        );
      })}
      {p.props.map((pr, i) => {
        const pos = at(pr.angle, WALL_RING - 0.4);
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
        const w = wallAt(m.angle);
        return (
          <mesh key={`patch${i}`} position={[w.x, p.footing + 0.6, w.z]} rotation={[0, w.rotY, 0]}>
            <boxGeometry args={[0.4, 0.06, 0.1]} />
            <meshStandardMaterial color={PAL.timberLight} flatShading />
          </mesh>
        );
      })}
      {p.cracks.map((m, i) => {
        const w = wallAt(m.angle);
        return (
          <mesh key={`crack${i}`} position={[w.x, p.footing + 0.6, w.z]} rotation={[0, w.rotY + (i % 2 ? 0.5 : -0.5), 0]}>
            <boxGeometry args={[0.45, 0.04, 0.05]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the file loads or if it fails, so a land is never empty. */
export default function BankDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Vault condition={condition} />} fallback={<LandBlock condition={condition} />} />
    </group>
  );
}
