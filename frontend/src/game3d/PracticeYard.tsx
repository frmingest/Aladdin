import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import type { Group } from "three";
import { BoothMesh } from "./Booths";
import { BOOTHS } from "./boothPlan";
import type { Booth } from "./boothPlan";
import { HedgeRing } from "./HoldingLand";
import { PAL, Part } from "./Inked";
import { prefersReducedMotion } from "./motionPref";
import NpcMesh from "./NpcMesh";
import PricePost from "./PricePost";
import { LAND_COLOURS } from "./holdingLandLogic";
import type { PricePost as PricePostData } from "./holdingLandLogic";
import type { GuideMark } from "./guideQuests";
import QuestMarks from "./QuestMarks";
import StaticBatch from "./StaticBatch";
import { TowerBody } from "./TowerMesh";
import WorldSign from "./WorldSign";
import {
  COUNTER_AT,
  COUNTER_MARK,
  COUNTER_YAW,
  YARD_ADVISORS,
  YARD_GATE,
  YARD_PAD,
  YARD_RADIUS,
  YARD_STONE,
  practiceTowerView,
} from "./practiceYardLogic";
import type { PracticeLook } from "./practiceYardLogic";
import { STARTER_WORDS } from "./starterWordsV1";
import { TOWER_FOG_COLOR, TOWER_PAD_TOP } from "./towerLook";

const GRASS = LAND_COLOURS.grass;
const PADDOCK = LAND_COLOURS.paddock;
const PATH = LAND_COLOURS.path;
const NO_MARKS: readonly GuideMark[] = [];
const COUNTER_MARKS: readonly GuideMark[] = [COUNTER_MARK];
const RISE_SECONDS = 1;
/** The practice plate's board: east of the path, between the gate and the price post. */
const PLATE_AT = { x: 2.8, z: 9.2 } as const;

/** Nobody has looked at the price yet: the gauge is mist with a "?", like an unpriced real tower. */
const FOG_POST: PricePostData = { gauge: "fog", scroll: "fog", banner: "fog", gaugeReason: "" };

/** Sal's counter in the yard: the courtyard's own stand, moved here, with the same sign. */
const PRACTICE_COUNTER: Booth = { ...BOOTHS[0], x: COUNTER_AT.x, z: COUNTER_AT.z, yaw: COUNTER_YAW };

const TOWER_VIEW = practiceTowerView();

/**
 * The tower rising from the pad (beat 2). The physics body cannot grow, so a column with the tower's own colour, sides and
 * radii grows for one second while the real tower is already mounted but hidden (its batch and collider are built during the
 * rise, not on the frame it ends); then the column goes and the tower shows. Reduced motion: no rise, it simply stands. The
 * caller keys this by `riseKey`, so a new rise always starts from the bottom.
 */
function RisingTower({ rise }: { rise: boolean }) {
  const view = TOWER_VIEW;
  const [up, setUp] = useState(() => !rise || prefersReducedMotion());
  const g = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (up || !g.current) return;
    t.current = Math.min(1, t.current + Math.min(dt, 0.05) / RISE_SECONDS);
    // Eased, so it slows as it reaches the top.
    g.current.scale.y = Math.max(0.001, 1 - (1 - t.current) ** 3);
    if (t.current >= 1) setUp(true);
  });
  return (
    <>
      <group visible={up}>
        <TowerBody t={view} door={false} />
      </group>
      {!up && (
        <group ref={g} position={[view.spot.x, TOWER_PAD_TOP, view.spot.z]} scale={[1, 0.001, 1]}>
          <mesh position={[0, view.height / 2, 0]}>
            <cylinderGeometry args={[view.radius, view.radius + 0.25, view.height, 14]} />
            <meshStandardMaterial color={TOWER_FOG_COLOR} flatShading />
          </mesh>
        </group>
      )}
    </>
  );
}

/**
 * The practice yard (starter level, #493): a land's hedge ring and gate, one empty stone pad, Sal's counter and the two
 * advisors by the gate. Everything here is made up and labelled practice; nothing reads the fortress or the server. The
 * tower is the only thing that changes, and it starts in fog: walls not surveyed, moat as mist, the price gauge a "?".
 */
export default function PracticeYard({ look, pos }: { look: PracticeLook; pos: MutableRefObject<{ x: number; z: number }> }) {
  return (
    <group>
      <StaticBatch>
        {/* Ground: deep on purpose, so one long frame cannot let the hero fall through a thin slab. */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
        </RigidBody>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[160, 48]} />
          <meshStandardMaterial color={GRASS} flatShading />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <circleGeometry args={[YARD_RADIUS, 48]} />
          <meshStandardMaterial color={PADDOCK} flatShading />
        </mesh>
        <HedgeRing radius={YARD_RADIUS} />
        {/* The path from the gate to the pad. */}
        <mesh position={[0, 0.04, (YARD_GATE.z + YARD_PAD.z + YARD_PAD.r) / 2]} receiveShadow>
          <boxGeometry args={[3, 0.06, YARD_GATE.z - YARD_PAD.z - YARD_PAD.r]} />
          <meshStandardMaterial color={PATH} flatShading />
        </mesh>
        {/* The gate: two low posts, as on a land, so the follow camera sees over them. E at the gap leads back out. */}
        {([-1, 1] as const).map((s) => (
          <Part key={s} color={PAL.timber} position={[s * 1.5, 0.8, YARD_GATE.z]} grow={1.1}>
            <boxGeometry args={[0.35, 1.6, 0.35]} />
          </Part>
        ))}
        {([-1, 1] as const).map((s) => (
          <Part key={`plate${s}`} color={PAL.timberDark} position={[PLATE_AT.x + s * 1.1, 0.6, PLATE_AT.z - 0.05]} grow={1.1}>
            <boxGeometry args={[0.14, 1.2, 0.14]} />
          </Part>
        ))}
        {/* The empty stone pad the tower rises from. */}
        <Part color={PAL.slate} position={[YARD_PAD.x, 0.08, YARD_PAD.z]} grow={1.04}>
          <cylinderGeometry args={[YARD_PAD.r, YARD_PAD.r + 0.2, 0.16, 24]} />
        </Part>
        {/* The gate stone: blank until the shop is picked, then its name and your share of it. */}
        <RigidBody type="fixed" colliders={false} position={[YARD_STONE.x, 0, YARD_STONE.z]}>
          <CuboidCollider args={[0.8, 0.7, 0.35]} position={[0, 0.7, 0]} />
          <Part color={PAL.slate} position={[0, 0.7, 0]} grow={1.06}>
            <boxGeometry args={[1.6, 1.4, 0.7]} />
          </Part>
        </RigidBody>
      </StaticBatch>
      {/* The practice plate on its own low board beside the path, facing you as you come in (over the gate it hid the yard). */}
      <WorldSign spec={{ kind: "plank", lines: [STARTER_WORDS.tag] }} position={[PLATE_AT.x, 1.5, PLATE_AT.z]} width={2.6} />
      {look.standing && (
        <WorldSign
          spec={{ kind: "stone", lines: [...STARTER_WORDS.gateStone] }}
          position={[YARD_STONE.x, 0.78, YARD_STONE.z + 0.4]}
          width={1.5}
          both={false}
        />
      )}

      {look.standing && <RisingTower key={look.riseKey ?? "standing"} rise={look.riseKey !== null} />}
      <BoothMesh booth={PRACTICE_COUNTER} />
      {YARD_ADVISORS.map((n) => (
        <NpcMesh key={n.id} npc={n} active={false} playerPos={pos} />
      ))}
      <PricePost post={FOG_POST} pos={pos} gaugeOnly />
      <QuestMarks marks={look.counterWaiting ? COUNTER_MARKS : NO_MARKS} />
    </group>
  );
}
