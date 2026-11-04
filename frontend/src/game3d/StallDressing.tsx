import StaticBatch from "./StaticBatch";
import { PAL, Part } from "./Inked";
import HoldingPiece from "./HoldingPiece";
import RingWear from "./RingWear";
import { AWNING, COUNTER, COUNTER_THINGS, PENNANTS, PENNANT_SCALE, PIECES, POLE_HEIGHT, POLE_X, STOCK_RING, stallPlan, stockAt, stockNode } from "./stallDressing";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { WithFallback } from "./KeepModels";

const DEG = Math.PI / 180;
const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

function Piece(props: { node: string; scale: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  return <HoldingPiece theme="stall" {...props} />;
}

/**
 * The market stall (A3): a counter under a cloth awning, goods on top and around it, inside a ring of six stock pieces that
 * wear the condition ladder (see stallDressing.ts). The goods are the same for every holding and every rung.
 */
function Stall({ condition }: { condition: LandCondition }) {
  const p = stallPlan(condition);
  const f = p.footing;
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      <RingWear plan={p} ring={STOCK_RING} pieceTop={0.4} />
      <group position={[0, f, 0]}>
        <Part color={PAL.timber} position={[0, COUNTER.height / 2, 0]} grow={1.05}>
          <boxGeometry args={[COUNTER.halfLength * 2, COUNTER.height, COUNTER.halfDepth * 2]} />
        </Part>
        <Part color={PAL.timberLight} position={[0, COUNTER.height + 0.025, 0]} grow={1.05}>
          <boxGeometry args={[COUNTER.halfLength * 2 + 0.1, 0.05, COUNTER.halfDepth * 2 + 0.1]} />
        </Part>
        {[-POLE_X, POLE_X].map((x) => (
          <Part key={x} color={PAL.timberDark} position={[x, POLE_HEIGHT / 2, -COUNTER.halfDepth]} grow={1.2}>
            <boxGeometry args={[0.07, POLE_HEIGHT, 0.07]} />
          </Part>
        ))}
        <Part color={PAL.cream} position={[0, AWNING.y + 0.05, -0.12]} rotation={[AWNING.tilt, 0, 0]} grow={1.04}>
          <boxGeometry args={[AWNING.halfLength * 2, 0.05, AWNING.halfDepth * 2]} />
        </Part>
        <Part color={PAL.teal} position={[0, AWNING.y + 0.09, -0.12]} rotation={[AWNING.tilt, 0, 0]} grow={1.04}>
          <boxGeometry args={[0.5, 0.05, AWNING.halfDepth * 2 + 0.02]} />
        </Part>
        {PENNANTS.map((x) => (
          <Piece key={x.node} node={x.node} scale={PENNANT_SCALE} position={[x.x, POLE_HEIGHT, -COUNTER.halfDepth]} />
        ))}
        {COUNTER_THINGS.map((t) => (
          <Piece key={t.node} node={t.node} scale={t.scale} position={[t.x, COUNTER.height + 0.05, t.z]} />
        ))}
      </group>
      {PIECES.map((x, i) => {
        const pos = at(x.angle, x.r);
        return <Piece key={`${x.node}${i}`} node={x.node} scale={x.scale} position={[pos[0], f + (x.y ?? 0), pos[2]]} rotation={[0, -x.angle, 0]} />;
      })}
      {p.columns.map((c) => {
        if (c.state === "gone") return null;
        const w = stockAt(c.angle);
        const s = stockNode(c.slot);
        return c.state === "standing" ? (
          <group key={c.slot} position={[w.x, f, w.z]} rotation={[0, w.rotY, 0]}>
            <Piece node={s.node} scale={s.scale} position={[0, 0, 0]} rotation={[c.lean * DEG, 0, 0]} />
          </group>
        ) : (
          <group key={c.slot} position={[w.x, 0.2, w.z]} rotation={[0, w.rotY + 0.3, 0]}>
            <Piece node={s.node} scale={s.scale} position={[0, 0, 0]} rotation={[Math.PI / 2.2, 0, 0]} />
          </group>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the file loads or if it fails, so a land is never empty. */
export default function StallDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Stall condition={condition} />} fallback={<LandBlock condition={condition} />} />
    </group>
  );
}
