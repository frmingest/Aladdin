import { useGLTF } from "@react-three/drei";
import StaticBatch from "./StaticBatch";
import NodeClone from "./NodeClone";
import RingWear from "./RingWear";
import { PAL } from "./Inked";
import { HERBS, HERB_LINE, PIECES, SHOP, STOCK_RING, apothecaryPlan, faceCentre, stockAt, stockNode } from "./apothecaryDressing";
import { HOLDING_URL } from "./holdingPieces";
import { TOWN_FILES } from "./townPieces";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { WithFallback } from "./KeepModels";

const DEG = Math.PI / 180;
const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

/** Four herb bundles on a string across the shop front: small cones hanging point-down. Code-built, fixed, no fact. */
function Herbs() {
  const z = SHOP.r;
  return (
    <group position={[0, 0, -z]}>
      <mesh position={[0, HERB_LINE.y, HERB_LINE.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 1.2, 6]} />
        <meshStandardMaterial color={PAL.timberDark} flatShading />
      </mesh>
      {HERBS.map((h) => (
        <mesh key={h.x} position={[h.x, HERB_LINE.y - 0.1, HERB_LINE.z]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[0.07, 0.2, 7]} />
          <meshStandardMaterial color={h.colour} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The apothecary (A7): a shop with herbs on a string, a potion table, a candle shelf and jars, inside a ring of six small casks
 * and boxes that wear the condition ladder (see apothecaryDressing.ts). The shop is the same for every holding and every rung.
 */
function Shop({ condition }: { condition: LandCondition }) {
  const holding = useGLTF(HOLDING_URL("apothecary")).scene;
  const town = useGLTF(TOWN_FILES.buildings).scene;
  const p = apothecaryPlan(condition);
  const shop = at(SHOP.angle, SHOP.r);
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      <RingWear plan={p} ring={STOCK_RING} pieceTop={0.5} />
      <group position={[shop[0], p.footing, shop[2]]}>
        <NodeClone source={town} name="market" scale={SHOP.scale} />
      </group>
      <group position={[0, p.footing, 0]}>
        <Herbs />
        {PIECES.map((x) => {
          const pos = at(x.angle, x.r);
          return <NodeClone key={x.node} source={holding} name={x.node} scale={x.scale} position={[pos[0], x.lift ?? 0, pos[2]]} rotation={[0, x.face ? faceCentre(x.angle) : -x.angle, 0]} />;
        })}
      </group>
      {p.columns.map((c) => {
        if (c.state === "gone") return null;
        const w = stockAt(c.angle);
        const s = stockNode(c.slot);
        return c.state === "standing" ? (
          <group key={c.slot} position={[w.x, p.footing, w.z]} rotation={[0, w.rotY, 0]}>
            <NodeClone source={holding} name={s.node} scale={s.scale} rotation={[c.lean * DEG, 0, 0]} />
          </group>
        ) : (
          <group key={c.slot} position={[w.x, 0.3, w.z]} rotation={[0, w.rotY + 0.3, 0]}>
            <NodeClone source={holding} name={s.node} scale={s.scale} rotation={[Math.PI / 2.2, 0, 0]} />
          </group>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the files load or if either fails, so a land is never empty. */
export default function ApothecaryDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Shop condition={condition} />} fallback={<LandBlock condition={condition} />} />
    </group>
  );
}
