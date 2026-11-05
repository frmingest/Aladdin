import { useGLTF } from "@react-three/drei";
import StaticBatch from "./StaticBatch";
import NodeClone from "./NodeClone";
import RingWear from "./RingWear";
import { PAL } from "./Inked";
import { BASE, FENCE_EDGE, HUT, PIECES, RACK, RACK_WEAPONS, TARGET, YARD_RING, armouryPlan, faceCentre, fenceAt, fenceNode, spotOf } from "./armouryDressing";
import { HOLDING_URL } from "./holdingPieces";
import { TOWN_FILES } from "./townPieces";
import type { LandCondition } from "./landCondition";
import { WORKPLACE } from "./holdingLand";
import LandBlock from "./LandBlock";
import { WithFallback } from "./KeepModels";

const DEG = Math.PI / 180;
const STRAW = "#d8c27c";

/** The weapon rack: two A-frame ends and a crossbar of timber, with the swords, spear and halberd standing in it. Same for every holding. */
function Rack({ holding }: { holding: Parameters<typeof NodeClone>[0]["source"] }) {
  const s = spotOf(RACK.angle, RACK.r);
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, faceCentre(RACK.angle), 0]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * RACK.halfLength, 0, 0]}>
          <mesh position={[0, RACK.height / 2, 0]} castShadow>
            <boxGeometry args={[0.06, RACK.height, 0.07]} />
            <meshStandardMaterial color={PAL.timber} flatShading />
          </mesh>
          <mesh position={[0, 0.03, 0]} castShadow>
            <boxGeometry args={[0.07, 0.06, 0.34]} />
            <meshStandardMaterial color={PAL.timberDark} flatShading />
          </mesh>
        </group>
      ))}
      <mesh position={[0, RACK.height - 0.06, 0]} castShadow>
        <boxGeometry args={[RACK.halfLength * 2 + 0.06, 0.05, 0.06]} />
        <meshStandardMaterial color={PAL.timberLight} flatShading />
      </mesh>
      {RACK_WEAPONS.map((w) => (
        <NodeClone key={w.node} source={holding} name={w.node} scale={w.scale} position={[w.x, 0.15 + (BASE[w.node] ?? 0) * w.scale, 0]} rotation={[0, 0, w.lean]} />
      ))}
    </group>
  );
}

/** The archery target: a straw disc with a cream and a teal ring on a three-legged stand. Code-built. */
function Target() {
  const s = spotOf(TARGET.angle, TARGET.r);
  const y = TARGET.centreY;
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, faceCentre(TARGET.angle), 0]}>
      <group position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[TARGET.radius, TARGET.radius, 0.12, 20]} />
          <meshStandardMaterial color={STRAW} flatShading />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <cylinderGeometry args={[TARGET.radius * 0.7, TARGET.radius * 0.7, 0.02, 20]} />
          <meshStandardMaterial color={PAL.cream} flatShading />
        </mesh>
        <mesh position={[0, 0.075, 0]}>
          <cylinderGeometry args={[TARGET.radius * 0.44, TARGET.radius * 0.44, 0.02, 20]} />
          <meshStandardMaterial color={PAL.teal} flatShading />
        </mesh>
        <mesh position={[0, 0.085, 0]}>
          <cylinderGeometry args={[TARGET.radius * 0.2, TARGET.radius * 0.2, 0.02, 14]} />
          <meshStandardMaterial color={PAL.cream} flatShading />
        </mesh>
      </group>
      {[
        [-0.2, -0.05, 0.28],
        [0.2, -0.05, 0.28],
        [0, -0.18, -0.3],
      ].map(([x, z, tilt], i) => (
        <mesh key={i} position={[x!, y / 2, z!]} rotation={[tilt! * (z! < 0 ? 1 : -1), 0, x! * -0.6]} castShadow>
          <boxGeometry args={[0.05, y + 0.1, 0.05]} />
          <meshStandardMaterial color={PAL.timber} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The armoury yard (A7): a barracks, a weapon rack, a shield and an archery target inside a ring of six rail-fence sections that
 * wear the condition ladder (see armouryDressing.ts). The yard is the same for every holding and every rung.
 */
function Yard({ condition }: { condition: LandCondition }) {
  const holding = useGLTF(HOLDING_URL("armoury")).scene;
  const town = useGLTF(TOWN_FILES.buildings).scene;
  const p = armouryPlan(condition);
  const hut = spotOf(HUT.angle, HUT.r);
  return (
    <StaticBatch rebuildKey={`${condition.name ?? condition.state}`}>
      <RingWear plan={p} ring={YARD_RING} pieceTop={0.7} />
      <NodeClone source={town} name="barracks" scale={HUT.scale} position={[hut.x, p.footing, hut.z]} />
      <group position={[0, p.footing, 0]}>
        <Rack holding={holding} />
        <Target />
        {PIECES.map((x) => {
          const pos = spotOf(x.angle, x.r);
          return <NodeClone key={x.node} source={holding} name={x.node} scale={x.scale} position={[pos.x, (BASE[x.node] ?? 0) * x.scale, pos.z]} rotation={[x.rotX ?? 0, x.rotY ?? -x.angle, 0]} />;
        })}
      </group>
      {p.columns.map((c) => {
        if (c.state === "gone") return null;
        const w = fenceAt(c.angle);
        const f = fenceNode(c.slot);
        const lean = c.state === "standing" ? c.lean * DEG : Math.PI / 2.3;
        const y = c.state === "standing" ? p.footing : 0.05;
        return (
          <group key={c.slot} position={[w.x, y, w.z]} rotation={[0, w.rotY + (c.state === "fallen" ? 0.3 : 0), 0]}>
            <group rotation={[0, 0, lean]}>
              <NodeClone source={holding} name={f.node} scale={f.scale} position={[FENCE_EDGE * f.scale, 0, 0]} />
            </group>
          </group>
        );
      })}
    </StaticBatch>
  );
}

/** The dressing, with the plain block as the fallback while the files load or if either fails, so a land is never empty. */
export default function ArmouryDressing({ condition }: { condition: LandCondition }) {
  return (
    <group position={[WORKPLACE.x, 0, WORKPLACE.z]}>
      <WithFallback model={<Yard condition={condition} />} fallback={<LandBlock condition={condition} />} />
    </group>
  );
}
