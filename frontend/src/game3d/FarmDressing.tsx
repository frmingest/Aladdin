import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";
import { INK, PAL } from "./Inked";
import LandBlock from "./LandBlock";
import StaticBatch from "./StaticBatch";
import { ModelBoundary } from "./KeepModels";
import {
  FENCE_SEGMENTS,
  FIELD_AT,
  FISH_COLORS,
  FISH_PER_TANK,
  TANK_AT,
  TANK_WATER,
  fenceAt,
  farmLook,
} from "./farmDressing";
import { HOLDING_URL } from "./holdingPieces";
import type { LandCondition } from "./landCondition";
import { TOWN_FILES } from "./townPieces";

/** Hex-pack pieces are about one tile wide (1 unit); the land's centre is about 5 units across. */
/** The whole yard is drawn at this scale so its fence sits at the stream's inner bank (radius about 2.6). */
const YARD = 0.6;
const S = {
  field: 2.0,
  fence: 2.4,
  small: 2.4,
  house: 2.7,
  hedge: 1.7,
} as const;

function Piece({
  source,
  name,
  scale,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  source: Object3D;
  name: string;
  scale: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const obj = useMemo(() => {
    const n = source.getObjectByName(name);
    if (!n) return null;
    const c = n.clone(true);
    c.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return c;
  }, [source, name]);
  return obj ? (
    <primitive
      object={obj}
      scale={scale}
      position={position}
      rotation={rotation}
    />
  ) : null;
}

/** Round open tanks with silver-blue fish. Code-built scenery: the counts are fixed numbers, never a value. */
function FishTanks() {
  return (
    <>
      {TANK_AT.map(([x, z], t) => (
        <group key={t} position={[x, 0, z]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.95, 1.0, 0.6, 14, 1, true]} />
            <meshStandardMaterial color={PAL.slate} flatShading side={2} />
          </mesh>
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.9, 14]} />
            <meshStandardMaterial color={TANK_WATER} flatShading />
          </mesh>
          {Array.from({ length: FISH_PER_TANK }, (_, f) => {
            const a = (f / FISH_PER_TANK) * Math.PI * 2 + t;
            return (
              <mesh
                key={f}
                position={[Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5]}
                rotation={[0, -a, 0]}
                scale={[0.3, 0.1, 0.1]}
              >
                <sphereGeometry args={[1, 6, 4]} />
                <meshStandardMaterial
                  color={FISH_COLORS[f % FISH_COLORS.length]}
                  flatShading
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

function Farm({
  condition,
  fish,
}: {
  condition: LandCondition;
  fish: boolean;
}) {
  const farm = useGLTF(HOLDING_URL("farm")).scene;
  const buildings = useGLTF(TOWN_FILES.buildings).scene;
  const nature = useGLTF(TOWN_FILES.nature).scene;
  const l = farmLook(condition);
  const lean = (l.lean * Math.PI) / 180;
  const fieldSlots = fish ? 2 : 4; // a fish farm has tanks in the back slots
  return (
    <StaticBatch>
      <group scale={YARD}>
        {FIELD_AT.slice(0, fieldSlots).map(([x, z], i) => (
          <Piece
            key={i}
            source={farm}
            name={i < l.emptyFields ? "dirt_field" : "grain_field"}
            scale={S.field}
            position={[x, 0, z]}
          />
        ))}
        {fish && <FishTanks />}
        <group rotation={[0, 0, -lean]}>
          <Piece source={buildings} name="house" scale={S.house} />
          {l.patches > 0 &&
            Array.from({ length: l.patches }, (_, i) => (
              <mesh key={i} position={[0.6 - i * 1.0, 1.5, 2.3]}>
                <boxGeometry args={[0.5, 0.4, 0.05]} />
                <meshStandardMaterial color={PAL.timberLight} flatShading />
              </mesh>
            ))}
          {l.crack &&
            [0, 1, 2].map((i) => (
              <mesh
                key={i}
                position={[-0.5 + i * 0.5, 1.2 + (i % 2) * 0.6, 2.3]}
                rotation={[0, 0, i % 2 ? 0.7 : -0.7]}
              >
                <boxGeometry args={[0.08, 0.8, 0.04]} />
                <meshBasicMaterial color={INK} />
              </mesh>
            ))}
          {Array.from({ length: l.looseBoards }, (_, i) => (
            <mesh
              key={i}
              position={[1.4 - i * 0.7, 2.6, 2.0]}
              rotation={[0.6 + i * 0.2, 0, 0.3 * (i % 2 ? 1 : -1)]}
            >
              <boxGeometry args={[0.12, 0.7, 0.3]} />
              <meshStandardMaterial color={PAL.timber} flatShading />
            </mesh>
          ))}
        </group>
        {/* The yard fence: the gate segment stays; the rest go missing from the left as the walls get worse. */}
        {Array.from({ length: FENCE_SEGMENTS }, (_, i) => {
          if (i < l.fenceGaps) return null;
          const f = fenceAt(i);
          return (
            <Piece
              key={i}
              source={farm}
              name={i === FENCE_SEGMENTS - 1 ? "fence_wood_gate" : "fence_wood"}
              scale={S.fence}
              position={[f.x, 0, f.z]}
              rotation={[0, f.yaw, 0]}
            />
          );
        })}
        {l.hedge !== "none" &&
          [-1, 0, 1].map((i) => (
            <Piece
              key={i}
              source={nature}
              name={l.hedge === "large" ? "hedge_large" : "hedge"}
              scale={S.hedge}
              position={[i * 1.9, 0, 3.7]}
              rotation={[0, Math.PI / 2, 0]}
            />
          ))}
        {/* Props lean on the low side; broken ones are short. */}
        {Array.from({ length: l.props }, (_, i) => {
          const broken = i < l.brokenProps;
          return (
            <mesh
              key={i}
              position={[
                2.4 + (i % 2) * 0.3,
                broken ? 0.45 : 0.85,
                -0.7 + i * 0.7,
              ]}
              rotation={[0, 0, broken ? 0.9 : 0.5]}
            >
              <boxGeometry args={[0.16, broken ? 0.9 : 1.7, 0.16]} />
              <meshStandardMaterial color={PAL.timberDark} flatShading />
            </mesh>
          );
        })}
        {Array.from({ length: l.lumber }, (_, i) => (
          <Piece
            key={i}
            source={farm}
            name="lumber"
            scale={S.small}
            position={[-1.5 + i * 0.8, 0, 3.2 + (i % 2) * 0.4]}
            rotation={[0, 0.7 * i, 0]}
          />
        ))}
      </group>
    </StaticBatch>
  );
}

/**
 * The farmhouse in its yard (S26 PR 3), with salmon tanks for a fish farm. Dressing for the five rungs only: the slot draws
 * the ghost and the neutral. If a model fails to load, the plain block stands in. Keyed by the condition, so the batch is
 * rebuilt whenever the wall tier changes.
 */
export default function FarmDressing({
  condition,
  fish,
}: {
  condition: LandCondition;
  fish: boolean;
}) {
  const fallback = <LandBlock condition={condition} />;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Farm
          key={`${condition.rung}-${fish}`}
          condition={condition}
          fish={fish}
        />
      </Suspense>
    </ModelBoundary>
  );
}
