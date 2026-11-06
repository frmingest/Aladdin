import StaticBatch from "./StaticBatch";
import HoldingPiece from "./HoldingPiece";
import RingWear from "./RingWear";
import { PIECES, STOCK_RING, factoryPlan, stockAt, stockNode } from "./factoryDressing";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { Sparks } from "./Embers";
import { FORGE_FIRE_HEIGHT } from "./fxPlan";
import { WithFallback } from "./KeepModels";

const DEG = Math.PI / 180;
const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

function Piece(props: { node: string; scale: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  return <HoldingPiece theme="factory" {...props} />;
}

/**
 * The workshop (A3): a forge, anvil, cog, scrap, bars, tarped pallet, barrel and a hammer inside a ring of six stockpile
 * pieces that wear the condition ladder (see factoryDressing.ts). The workshop is the same for every holding and every rung.
 */
function Workshop({ condition }: { condition: LandCondition }) {
  const p = factoryPlan(condition);
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      <RingWear plan={p} ring={STOCK_RING} pieceTop={0.5} />
      {PIECES.map((x) => {
        const pos = at(x.angle, x.r);
        return (
          <Piece
            key={x.node}
            node={x.node}
            scale={x.scale}
            position={[pos[0], p.footing + (x.lift ?? 0), pos[2]]}
            rotation={[x.rotX ?? 0, x.rotY ?? -x.angle, 0]}
          />
        );
      })}
      {p.columns.map((c) => {
        if (c.state === "gone") return null;
        const w = stockAt(c.angle);
        const s = stockNode(c.slot);
        return c.state === "standing" ? (
          <group key={c.slot} position={[w.x, p.footing, w.z]} rotation={[0, w.rotY, 0]}>
            <Piece node={s.node} scale={s.scale} position={[0, 0, 0]} rotation={[c.lean * DEG, 0, 0]} />
          </group>
        ) : (
          <group key={c.slot} position={[w.x, 0.3, w.z]} rotation={[0, w.rotY + 0.3, 0]}>
            <Piece node={s.node} scale={s.scale} position={[0, 0, 0]} rotation={[Math.PI / 2.2, 0, 0]} />
          </group>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the file loads or if it fails, so a land is never empty. */
export default function FactoryDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Workshop condition={condition} />} fallback={<LandBlock condition={condition} />} />
      <Sparks position={[0, factoryPlan(condition).footing + FORGE_FIRE_HEIGHT, 0]} />
    </group>
  );
}
