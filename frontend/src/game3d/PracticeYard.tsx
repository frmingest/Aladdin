import { useMemo, useRef, useState } from "react";
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
import { yawToward } from "./npcs";
import PricePost from "./PricePost";
import { LAND_COLOURS } from "./holdingLandLogic";
import type { PricePost as PricePostData } from "./holdingLandLogic";
import type { GuideMark } from "./guideQuests";
import QuestMarks from "./QuestMarks";
import StaticBatch from "./StaticBatch";
import { TowerBody } from "./TowerMesh";
import WorldSign from "./WorldSign";
import { MOAT_LABEL, WALL_LABEL } from "../lib/fortress";
import {
  COUNTER_AT,
  COUNTER_MARK,
  COUNTER_YAW,
  FACT_CARD_STEP,
  FACT_CARD_ROWS,
  FACT_CARD_W,
  LECTERN_AT,
  LECTERN_YAW,
  PLANK_AT,
  PLANK_YAW,
  TOWER_PLATE_AT,
  YARD_ADVISORS,
  YARD_GATE,
  YARD_PAD,
  YARD_RADIUS,
  YARD_SPAWN,
  YARD_STONE,
  practiceTowerView,
} from "./practiceYardLogic";
import type { PracticeLook, YardMoat, YardWall } from "./practiceYardLogic";
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

/** The tower's word plate faces the arrival spot, like the practice plate. */
const PLATE_YAW = yawToward(TOWER_PLATE_AT, YARD_SPAWN);

/**
 * The four fact cards on a notice board (beat 3, #494): money left over in each of three years, and what it owes. Two rows of
 * two. They stand once the tower does and never change in this build; beat 6 will point at them.
 */
function FactPlank() {
  const half = FACT_CARD_STEP / 2;
  const top = FACT_CARD_ROWS[0] + 0.4;
  const postX = FACT_CARD_STEP + 0.12;
  return (
    <group position={[PLANK_AT.x, 0, PLANK_AT.z]} rotation={[0, PLANK_YAW, 0]}>
      <StaticBatch>
        {/* Only the posts are solid: you walk under the board. */}
        <RigidBody type="fixed" colliders={false}>
          {([-1, 1] as const).map((s) => (
            <CuboidCollider key={s} args={[0.1, top / 2, 0.1]} position={[s * postX, top / 2, -0.08]} />
          ))}
        </RigidBody>
        {/* The backing board and its two posts. */}
        <Part color={PAL.timber} position={[0, (FACT_CARD_ROWS[0] + FACT_CARD_ROWS[1]) / 2, -0.08]} grow={1.04}>
          <boxGeometry args={[2 * FACT_CARD_STEP + 0.1, FACT_CARD_ROWS[0] - FACT_CARD_ROWS[1] + 0.75, 0.1]} />
        </Part>
        {([-1, 1] as const).map((s) => (
          <Part key={s} color={PAL.timberDark} position={[s * postX, top / 2, -0.08]} grow={1.1}>
            <boxGeometry args={[0.16, top, 0.16]} />
          </Part>
        ))}
      </StaticBatch>
      {STARTER_WORDS.facts.map((f, i) => (
        <WorldSign
          key={f[0]}
          spec={{ kind: "plank", lines: [...f] }}
          position={[(i % 2 === 0 ? -1 : 1) * half, FACT_CARD_ROWS[Math.floor(i / 2)], 0]}
          width={FACT_CARD_W}
          // Front face only: the backing board covers the back, and a mirrored back plane would sit on its face.
          both={false}
        />
      ))}
    </group>
  );
}

/** The reading lectern by the gate (#494): a post, a slanted top and the Book lying open on it. E here opens the Book. */
function Lectern() {
  return (
    <group position={[LECTERN_AT.x, 0, LECTERN_AT.z]} rotation={[0, LECTERN_YAW, 0]}>
      <StaticBatch>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.4, 0.6, 0.3]} position={[0, 0.6, 0]} />
        </RigidBody>
        <Part color={PAL.timberDark} position={[0, 0.55, 0]} grow={1.08}>
          <boxGeometry args={[0.3, 1.1, 0.3]} />
        </Part>
        <Part color={PAL.timber} position={[0, 1.15, 0]} rotation={[-0.45, 0, 0]} grow={1.06}>
          <boxGeometry args={[0.9, 0.1, 0.65]} />
        </Part>
        {/* The Book, lying open: one cream block for its pages. */}
        <Part color={PAL.cream} position={[0, 1.23, 0.02]} rotation={[-0.45, 0, 0]} grow={1.04}>
          <boxGeometry args={[0.76, 0.06, 0.5]} />
        </Part>
      </StaticBatch>
      <WorldSign spec={{ kind: "plank", lines: [STARTER_WORDS.book.title] }} position={[0, 1.85, 0]} width={1.5} />
    </group>
  );
}

/** Nobody has looked at the price yet: the gauge is mist with a "?", like an unpriced real tower. */
const FOG_POST: PricePostData = { gauge: "fog", scroll: "fog", banner: "fog", gaugeReason: "" };

/** Sal's counter in the yard: the courtyard's own stand, moved here, with the same sign. */
const PRACTICE_COUNTER: Booth = { ...BOOTHS[0], x: COUNTER_AT.x, z: COUNTER_AT.z, yaw: COUNTER_YAW };

/**
 * The tower rising from the pad (beat 2). The physics body cannot grow, so a column with the tower's own colour, sides and
 * radii grows for one second while the real tower is already mounted but hidden (its batch and collider are built during the
 * rise, not on the frame it ends); then the column goes and the tower shows. Reduced motion: no rise, it simply stands. The
 * caller keys this by `riseKey`, so a new rise always starts from the bottom.
 */
function RisingTower({ rise, wall, moat }: { rise: boolean; wall: YardWall; moat: YardMoat }) {
  // The walls and the moat change in place when a check is answered (#494); the tower does not rise again.
  const view = useMemo(() => practiceTowerView(wall, moat), [wall, moat]);
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

      {look.standing && <RisingTower key={look.riseKey ?? "standing"} rise={look.riseKey !== null} wall={look.wall} moat={look.moat} />}
      {look.standing && (
        // The tower's walls and moat in words, as a real tower's panel says them: "Walls not surveyed" until you have looked.
        <WorldSign
          spec={{ kind: "stone", lines: [WALL_LABEL[look.wall], MOAT_LABEL[look.moat]], fog: look.wall === "unsurveyed" && look.moat === "unsurveyed" }}
          position={[TOWER_PLATE_AT.x, 0.75, TOWER_PLATE_AT.z]}
          width={1.9}
          yaw={PLATE_YAW}
        />
      )}
      {look.factCards && <FactPlank />}
      <Lectern />
      <BoothMesh booth={PRACTICE_COUNTER} />
      {YARD_ADVISORS.map((n) => (
        <NpcMesh key={n.id} npc={n} active={false} playerPos={pos} />
      ))}
      <PricePost post={FOG_POST} pos={pos} gaugeOnly />
      <QuestMarks marks={look.counterWaiting ? COUNTER_MARKS : NO_MARKS} />
    </group>
  );
}
