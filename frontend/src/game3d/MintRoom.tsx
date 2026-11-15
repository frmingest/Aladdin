import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { Group } from "three";
import { PAL, Part } from "./Inked";
import { Banner, Sheet } from "./PlateSheet";
import { makeTexture, useDispose } from "./plateTexture";
import {
  BOOK_SPOT,
  MINT,
  MINT_DOOR,
  PLATE_CAPACITY,
  PRESS_SPOT,
  SPAN_SPOT,
  bookPlate,
  leverBaseCollider,
  leverLayout,
  leverReadout,
  leverTilt,
  moodOf,
  plateSlot,
  wallHeading,
  wallPlates,
} from "./mintRoom";
import type { PlateText } from "./mintRoom";
import { MINT_WORDS } from "./mintWordsV1";
import { PLATE_PX, drawMintPlate } from "./mintPlateArt";
import { useNear } from "./nearStore";
import { prefersReducedMotion } from "./motionPref";
import type { MintView } from "./useMint";
import { PLATE } from "./weatherTowerRoom";

const STONE = PAL.stone;
const FLOOR = PAL.floor;
const BRASS = PAL.brass;
const LENGTH_Z = MINT.maxZ - MINT.minZ;
const MID_Z = (MINT.maxZ + MINT.minZ) / 2;
const WIDTH_X = MINT.maxX - MINT.minX;

/** One result plate on the wall: the holding's name, its direction by mark and word, and a NOK range only if the backend allowed one. */
function ResultPlate({ p, stale, position, yaw }: { p: PlateText; stale: boolean; position: [number, number, number]; yaw: number }) {
  // The texture is drawn once per result; the "Old answer" tab is a small board in front, so a lever pull never redraws every plate.
  const texture = useMemo(() => makeTexture(PLATE_PX, (ctx) => drawMintPlate(ctx, p, false)), [p]);
  useDispose(texture);
  const height = (PLATE.width * PLATE_PX.h) / PLATE_PX.w;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <Sheet texture={texture} width={PLATE.width} height={height} />
      {stale && <Banner position={[0, -height / 2 - 0.2, 0.03]} yaw={0} width={1.6} big={MINT_WORDS.stale} small={null} />}
    </group>
  );
}

interface LeverProps {
  x: number;
  tilt: number;
  lit: boolean;
}

/** One brass lever on the north wall. Its arm leans to its notch (it jumps there when the system asks for less motion). */
function Lever({ x, tilt, lit }: LeverProps) {
  const arm = useRef<Group>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  useFrame((_, dt) => {
    const g = arm.current;
    if (!g) return;
    const goal = tilt;
    const cur = g.rotation.z;
    // The arm rotates about z (toward east or west along the wall): the same pull always leans the same way.
    g.rotation.z = reduced || Math.abs(goal - cur) < 0.002 ? goal : cur + (goal - cur) * Math.min(1, dt * 10);
  });
  return (
    <group position={[x, 0, MINT.minZ + 0.4]}>
      <Part color={PAL.iron} position={[0, 0.45, 0]} grow={1.08}>
        <boxGeometry args={[0.9, 0.9, 0.5]} />
      </Part>
      <group ref={arm} position={[0, 1.0, 0.05]}>
        <Part color={lit ? BRASS : PAL.timberLight} position={[0, 0.8, 0]} grow={1.1}>
          <boxGeometry args={[0.14, 1.6, 0.14]} />
        </Part>
        <Part color={PAL.cream} position={[0, 1.7, 0]} grow={1.15}>
          <sphereGeometry args={[0.22, 10, 8]} />
        </Part>
      </group>
    </group>
  );
}

interface Props {
  mint: MintView;
}

/**
 * The inside of the Royal Mint (issue #413): a lever wall (north), a coin press (middle), a span post (west of it), a ledger lectern,
 * the result wall (east) with one plate per holding, and the whole-book plate and the mood needle on the west wall. Furniture and
 * plates only: every word and figure comes from the backend's answer through `mintRoom.ts`; a plate prints a NOK range only when
 * the backend allowed it. Walls are drawn from inside only so the follow camera can sit outside them. The press turns while a
 * stamp is on its way (not at all when the system asks for less motion).
 */
export default function MintRoom({ mint }: Props) {
  const { plans, more: leversMore } = useMemo(() => leverLayout(mint.levers), [mint.levers]);
  const { plates, more } = useMemo(() => wallPlates(mint.result), [mint.result]);
  const book = useMemo(() => (mint.result ? bookPlate(mint.result) : null), [mint.result]);
  const stale = mint.wall === "stale";
  const heading = wallHeading(mint.wall);
  const mood = moodOf(mint.result, mint.wall);
  const nearLever = useNear("mintLever");
  const nearPress = useNear("mintPress");
  const wheel = useRef<Group>(null);
  const needle = useRef<Group>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const loading = mint.wall === "loading";
  const needleGoal = mood === "restless" ? 0.7 : -0.7;
  useFrame((_, dt) => {
    if (wheel.current && loading && !reduced) wheel.current.rotation.z += dt * 6;
    const n = needle.current;
    if (n) n.rotation.z = reduced || Math.abs(needleGoal - n.rotation.z) < 0.002 ? needleGoal : n.rotation.z + (needleGoal - n.rotation.z) * Math.min(1, dt * 6);
  });
  const doorGap = MINT_DOOR.width / 2;
  const sideLen = (WIDTH_X - MINT_DOOR.width) / 2;
  const wallPlateY = 3.3;
  const slots = Array.from({ length: Math.min(plates.length, PLATE_CAPACITY) }, (_, i) => plateSlot(i));
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WIDTH_X / 2 + 1, 0.5, LENGTH_Z / 2 + 1]} position={[0, -0.5, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, MINT.height / 2, 0.5]} position={[0, MINT.height / 2, MINT.minZ - 0.5]} />
        <CuboidCollider args={[0.5, MINT.height / 2, LENGTH_Z / 2 + 1]} position={[MINT.minX - 0.5, MINT.height / 2, MID_Z]} />
        <CuboidCollider args={[0.5, MINT.height / 2, LENGTH_Z / 2 + 1]} position={[MINT.maxX + 0.5, MINT.height / 2, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, MINT.height / 2, 0.5]} position={[0, MINT.height / 2, MINT.maxZ + 0.5]} />
        {/* Each lever's iron base is solid: you walk round it, not through it. */}
        {plans.map((p) => {
          const c = leverBaseCollider(p.x);
          return <CuboidCollider key={p.key} args={c.half} position={c.position} />;
        })}
        {/* The press stands in the middle: you walk round it. */}
        <CuboidCollider args={[0.9, 0.9, 0.7]} position={[PRESS_SPOT.x, 0.9, PRESS_SPOT.z - 1.0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, MID_Z]} receiveShadow>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color={FLOOR} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, MINT.height, MID_Z]}>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color={PAL.slateDark} flatShading />
      </mesh>
      <mesh position={[0, MINT.height / 2, MINT.minZ]} receiveShadow>
        <planeGeometry args={[WIDTH_X, MINT.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[MINT.minX, MINT.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, MINT.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[MINT.maxX, MINT.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, MINT.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} rotation={[0, Math.PI, 0]} position={[s * (doorGap + sideLen / 2), MINT.height / 2, MINT.maxZ]} receiveShadow>
          <planeGeometry args={[sideLen, MINT.height]} />
          <meshStandardMaterial color={STONE} flatShading />
        </mesh>
      ))}
      <mesh rotation={[0, Math.PI, 0]} position={[0, (MINT.height + 3.4) / 2, MINT.maxZ]}>
        <planeGeometry args={[MINT_DOOR.width, MINT.height - 3.4]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * (MINT_DOOR.width / 4), 1.7, MINT.maxZ - 0.12]} grow={1.04}>
          <boxGeometry args={[MINT_DOOR.width / 2 - 0.05, 3.4, 0.2]} />
        </Part>
      ))}
      <Part color={PAL.iron} position={[0, 1.6, MINT.maxZ - 0.3]} grow={1.2}>
        <torusGeometry args={[0.18, 0.04, 6, 14]} />
      </Part>

      {/* The lever wall: one lever for each lever the ledger lists, a name board over each. */}
      {plans.map((p) => {
        const lever = mint.levers.find((l) => l.key === p.key);
        if (!lever) return null;
        const index = mint.leverState[p.key] ?? -1;
        return (
          <group key={p.key}>
            <Lever x={p.x} tilt={leverTilt(lever, index)} lit={nearLever === p.key} />
            <Banner position={[p.x, 4.2, MINT.minZ + 0.06]} yaw={0} width={2.6} big={p.name} small={leverReadout(lever, index)} />
          </group>
        );
      })}
      {leversMore > 0 && <Banner position={[0, 0.5, MINT.minZ + 0.06]} yaw={0} width={3.4} big={MINT_WORDS.more(leversMore)} small={null} />}
      <Banner position={[0, 5.7, MINT.minZ + 0.06]} yaw={0} width={9} big={mint.result?.banner ?? MINT_WORDS.banner} small={null} />

      {/* The coin press: base, plate and a flywheel that turns while a stamp is on its way. */}
      <group position={[PRESS_SPOT.x, 0, PRESS_SPOT.z - 1.0]}>
        <Part color={PAL.iron} position={[0, 0.5, 0]} grow={1.06}>
          <boxGeometry args={[1.6, 1.0, 1.2]} />
        </Part>
        <Part color={nearPress ? BRASS : PAL.timberLight} position={[0, 1.15, 0]} grow={1.1}>
          <boxGeometry args={[1.1, 0.3, 0.8]} />
        </Part>
        <group ref={wheel} position={[0, 1.9, 0]}>
          <Part color={BRASS} grow={1.1}>
            <torusGeometry args={[0.55, 0.08, 6, 18]} />
          </Part>
          <Part color={BRASS} grow={1.1}>
            <boxGeometry args={[1.1, 0.08, 0.08]} />
          </Part>
          <Part color={BRASS} grow={1.1}>
            <boxGeometry args={[0.08, 1.1, 0.08]} />
          </Part>
        </group>
      </group>
      <Banner position={[PRESS_SPOT.x, 3.3, PRESS_SPOT.z - 1.0]} yaw={0} width={2.2} big={MINT_WORDS.stamp} small={mint.wall === "loading" ? MINT_WORDS.pressBusy : null} />

      {/* The span post: 1 year or 3 years. */}
      <Part color={PAL.timberDark} position={[SPAN_SPOT.x, 0.9, SPAN_SPOT.z - 0.6]} grow={1.1}>
        <boxGeometry args={[0.24, 1.8, 0.24]} />
      </Part>
      <Banner position={[SPAN_SPOT.x, 2.3, SPAN_SPOT.z - 0.6]} yaw={0} width={2.6} big={MINT_WORDS.spanPlate(mint.horizon)} small={null} />

      {/* The ledger lectern: the same results as plain words. */}
      <Part color={PAL.timber} position={[BOOK_SPOT.x, 0.55, BOOK_SPOT.z + 0.6]} grow={1.08}>
        <boxGeometry args={[1.0, 1.1, 0.7]} />
      </Part>
      <Banner position={[BOOK_SPOT.x, 1.6, BOOK_SPOT.z + 0.6]} yaw={Math.PI} width={1.8} big={MINT_WORDS.ledger} small={null} />

      {/* The result wall (east): one plate per holding, biggest swing first (the backend's own order). */}
      {plates.map((p, i) => {
        const s = slots[i];
        return <ResultPlate key={p.key} p={p} stale={stale} position={[s.x, s.y, s.z]} yaw={s.yaw} />;
      })}
      {heading && <Banner position={[MINT.maxX - 0.08, 5.7, 0]} yaw={-Math.PI / 2} width={6.4} big={heading} small={null} />}
      {more > 0 && <Banner position={[MINT.maxX - 0.08, 0.6, 0]} yaw={-Math.PI / 2} width={4.4} big={MINT_WORDS.more(more)} small={null} />}

      {/* The west wall: the whole book, and the Mint's mood (it leans restless when the backend flags a wild pull). */}
      {book && <ResultPlate p={book} stale={stale} position={[MINT.minX + 0.08, wallPlateY, 0]} yaw={Math.PI / 2} />}
      <group position={[MINT.minX + 0.1, 5.0, -5]} rotation={[0, Math.PI / 2, 0]}>
        <Banner position={[0, 0.9, 0]} yaw={0} width={2.8} big={MINT_WORDS.temperament} small={mood === "restless" ? MINT_WORDS.temperamentRestless : MINT_WORDS.temperamentCalm} />
        <Part color={PAL.iron} position={[0, 0, 0]} grow={1.1}>
          <cylinderGeometry args={[0.12, 0.12, 0.1, 10]} />
        </Part>
        <group ref={needle} position={[0, 0, 0.06]}>
          <Part color={BRASS} position={[0, 0.4, 0]} grow={1.15}>
            <boxGeometry args={[0.07, 0.8, 0.05]} />
          </Part>
        </group>
      </group>
      {mint.result?.wild && <Banner position={[MINT.minX + 0.08, 1.2, 4]} yaw={Math.PI / 2} width={5} big={MINT_WORDS.wildShort} small={null} />}
      {mint.ledgerFailed && <Banner position={[0, 3.3, MINT.minZ + 0.06]} yaw={0} width={5} big={MINT_WORDS.ledgerFailed} small={null} />}
    </group>
  );
}
