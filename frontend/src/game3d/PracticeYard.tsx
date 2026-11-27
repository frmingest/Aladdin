import { useEffect, useMemo, useRef, useState } from "react";
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
import { PRICE_WORDS } from "./pricePostWordsV2";
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
  SCALE_AT,
  SCALE_TIP,
  STORM_GROUND,
  TOWER_PLATE_AT,
  YARD_ADVISORS,
  YARD_GATE,
  YARD_PAD,
  YARD_RADIUS,
  YARD_SPAWN,
  YARD_POST_AT,
  YARD_STONE,
  doorFace,
  practiceTowerView,
} from "./practiceYardLogic";
import type { PracticeLook, YardMoat, YardWall } from "./practiceYardLogic";
import { WORLD_TOKENS } from "./gameTokens";
import { PIP } from "./practiceCompanyV1";
import { STARTER_WORDS } from "./starterWordsV3";
import Confetti from "./Confetti";
import { TOWER_FOG_COLOR, TOWER_PAD_TOP } from "./towerLook";

const GRASS = LAND_COLOURS.grass;
const PADDOCK = LAND_COLOURS.paddock;
const PATH = LAND_COLOURS.path;
const NO_MARKS: readonly GuideMark[] = [];
const COUNTER_MARKS: readonly GuideMark[] = [COUNTER_MARK];
const RISE_SECONDS = 1;
const SHAKE_SECONDS = 0.5;
const PIP_PRICE = PIP.price;
/** The practice plate's board: east of the path, between the gate and the price post. */
const PLATE_AT = { x: 2.8, z: 9.2 } as const;

/** The tower's word plate faces the arrival spot, like the practice plate. */
const PLATE_YAW = yawToward(TOWER_PLATE_AT, YARD_SPAWN);

/**
 * The four fact cards on a notice board (beat 3, #494): money left over in each of three years, and what it owes. Two rows of
 * two. They stand once the tower does and never change in this build; beat 6 will point at them.
 */
function FactPlank({ pointAt, owes }: { pointAt: number | null; owes: number }) {
  // Beat 6b (#496): the Owes card flips to what Pip's owes after the second storm.
  const facts = owes === PIP.owes ? STARTER_WORDS.facts : STARTER_WORDS.factsSecond;
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
      {facts.map((f, i) => (
        <WorldSign
          key={f[0]}
          spec={{ kind: "plank", lines: [...f] }}
          position={[(i % 2 === 0 ? -1 : 1) * half, FACT_CARD_ROWS[Math.floor(i / 2)], 0]}
          width={FACT_CARD_W}
          // Front face only: the backing board covers the back, and a mirrored back plane would sit on its face.
          both={false}
        />
      ))}
      {/*
        Beat 6's "Look here" (#495): a wrong storm pick puts a thick dark frame round the card it got wrong about, and a tag
        under it with an arrow. Shape and words, never a glow alone, and nothing pulses (so reduced motion needs nothing).
      */}
      {pointAt !== null && (
        <group position={[(pointAt % 2 === 0 ? -1 : 1) * half, FACT_CARD_ROWS[Math.floor(pointAt / 2)], -0.02]}>
          {/* Brass, so the frame shows on the dark board (a dark frame vanished there; game-designer review). */}
          <Part color={PAL.brass} position={[0, 0, 0]} grow={1}>
            <boxGeometry args={[FACT_CARD_W + 0.22, FACT_CARD_W * 0.42 + 0.22, 0.04]} />
          </Part>
          <WorldSign spec={{ kind: "plank", lines: [`↑ ${STARTER_WORDS.checks.storm.lookHere}`] }} position={[0, -0.62, 0.04]} width={1.05} both={false} />
        </group>
      )}
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

/** Pale mist over a fact nobody has weighed yet (the price post's own mist). */
const MIST = WORLD_TOKENS.mist;

/**
 * Beat 5's balance scale (#495), the one new motif: worth in the left pan (weights), the price in the right (coins). One fact,
 * worth against price. Level and in mist until the price is weighed; then it tips toward worth, the heavier side. It stays
 * tipped through the storm: worth did not change, and fewer coins (4.9 against 7) only tip it further, so it never moves back.
 * The tip eases over about half a second; under reduced motion it is simply tipped.
 */
function PriceScale({ look, price, worth }: { look: "fog" | "tipped"; price: number; worth: "calm" | "second" }) {
  const worthSign = worth === "second" ? STARTER_WORDS.scale2 : STARTER_WORDS.scale;
  const target = look === "tipped" ? SCALE_TIP : 0;
  const beam = useRef<Group>(null);
  const pans = useRef<(Group | null)[]>([]);
  const tilt = useRef(prefersReducedMotion() ? target : 0);
  useFrame((_, dt) => {
    // Settled: nothing to write until the target changes.
    if (Math.abs(target - tilt.current) < 1e-3 && beam.current?.rotation.z === tilt.current) return;
    if (prefersReducedMotion() || Math.abs(target - tilt.current) < 1e-3) tilt.current = target;
    else tilt.current += (target - tilt.current) * Math.min(1, Math.min(dt, 0.05) * 6);
    if (beam.current) beam.current.rotation.z = tilt.current;
    // The pans hang straight down whatever the beam does.
    for (const p of pans.current) if (p) p.rotation.z = -tilt.current;
  });
  const coins = price < PIP_PRICE ? 2 : 3;
  const yaw = useMemo(() => yawToward(SCALE_AT, YARD_SPAWN), []);
  return (
    <group position={[SCALE_AT.x, 0, SCALE_AT.z]} rotation={[0, yaw, 0]}>
      {/* The parts that never move are batched; the beam and its pans move, so they stay out of the batch. */}
      <StaticBatch>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.55, 0.8, 0.35]} position={[0, 0.8, 0]} />
        </RigidBody>
        <Part color={PAL.slate} position={[0, 0.08, 0]} grow={1.05}>
          <boxGeometry args={[1.0, 0.16, 0.6]} />
        </Part>
        <Part color={PAL.timberDark} position={[0, 0.85, 0]} grow={1.1}>
          <boxGeometry args={[0.14, 1.5, 0.14]} />
        </Part>
      </StaticBatch>
      <group ref={beam} position={[0, 1.6, 0]}>
        <Part color={PAL.timber} grow={1.08}>
          <boxGeometry args={[1.7, 0.1, 0.1]} />
        </Part>
        {([-1, 1] as const).map((side, i) => (
          <group
            key={side}
            position={[side * 0.78, 0, 0]}
            ref={(g) => {
              pans.current[i] = g;
            }}
          >
            <Part color={PAL.iron} position={[0, -0.3, 0]} grow={1.3}>
              <boxGeometry args={[0.03, 0.6, 0.03]} />
            </Part>
            <Part color={PAL.brass} position={[0, -0.62, 0]} grow={1.08}>
              <cylinderGeometry args={[0.4, 0.34, 0.06, 16]} />
            </Part>
            {side === -1
              ? // Worth: two square weights side by side and one on top.
                [
                  [-0.13, -0.47],
                  [0.13, -0.47],
                  [0, -0.27],
                ].map(([x, y]) => (
                  <Part key={`${x}${y}`} color={PAL.slateDark} position={[x, y, 0]} grow={1.08}>
                    <boxGeometry args={[0.22, 0.2, 0.22]} />
                  </Part>
                ))
              : // The price: a short stack of coins, one fewer once the storm has cut the price.
                Array.from({ length: coins }, (_, c) => (
                  <Part key={c} color={PAL.sand} position={[0, -0.55 + c * 0.06, 0]} grow={1.1}>
                    <cylinderGeometry args={[0.16, 0.16, 0.05, 12]} />
                  </Part>
                ))}
          </group>
        ))}
      </group>
      {look === "fog" && (
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[1.15, 12, 10]} />
          <meshStandardMaterial color={MIST} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      {/* The two pans in words, always on show: the card asks about these very numbers. */}
      <WorldSign spec={{ kind: "plank", lines: [worthSign.worth, worthSign.low] }} position={[-0.78, 3.05, 0]} width={1.6} />
      <WorldSign
        key={price}
        spec={{ kind: "plank", lines: [price < PIP_PRICE ? STARTER_WORDS.scale.priceAfter : STARTER_WORDS.scale.price] }}
        // Low, under its pan and in front of the base: above the pan it covered the walls-and-moat plate or the board's Year 3
        // card from the arrival view (game-designer and playtest reviews); down here nothing stands between it and the camera.
        position={[0.78, 0.55, 0.42]}
        width={price < PIP_PRICE ? 1.6 : 1.15}
      />
    </group>
  );
}

/** The tower face toward the door view: the sheet just off the wall, the banner a hair further out. */
const SHEET_AT = doorFace(2.05);
const BANNER_AT = doorFace(2.1);
/** Beat 8's burst goes up over the practice tower, not the courtyard fountain. */
const CHEER_AT = { x: YARD_PAD.x, y: 6, z: YARD_PAD.z } as const;

/**
 * Beat 7 (#496): the why on a sheet pinned to the tower's door side, facing the gate, at eye height. Two lines: the reason, and
 * what would prove it wrong. A pin of iron at the top; nothing moves.
 */
function PinnedSheet({ lines }: { lines: readonly [string, string] }) {
  return (
    <group position={[SHEET_AT.x, 1.75, SHEET_AT.z]} rotation={[0, SHEET_AT.yaw, 0]}>
      <WorldSign spec={{ kind: "plank", lines: [...lines] }} position={[0, 0, 0.05]} width={2.3} both={false} />
      <Part ink={false} color={PAL.iron} position={[0, 0.34, 0.1]} grow={1.2}>
        <sphereGeometry args={[0.06, 8, 6]} />
      </Part>
    </group>
  );
}

/**
 * Beat 8 (#496): a long cream banner down the tower wall with a lemon on it, above the pinned sheet. A hanging banner, not the
 * flag, so it never reads as the why. It carries no words; the page's live region says it once. Palette colours only.
 */
function LemonBanner() {
  return (
    <group position={[BANNER_AT.x, 4.6, BANNER_AT.z]} rotation={[0, BANNER_AT.yaw, 0]}>
      <Part ink={false} color={PAL.brass} position={[0, 1.85, 0]} grow={1.06}>
        <boxGeometry args={[1.3, 0.12, 0.12]} />
      </Part>
      <Part ink={false} color={PAL.cream} position={[0, 0, 0]} grow={1.03}>
        <boxGeometry args={[1.1, 3.6, 0.04]} />
      </Part>
      {/* The lemon: an oval of sand yellow with a moss leaf, low on the banner so the HUD's goal strip never covers it. */}
      <Part ink={false} color={PAL.sand} position={[0, -0.45, 0.06]} scale={[1, 0.75, 0.4]} grow={1.08}>
        <sphereGeometry args={[0.38, 14, 10]} />
      </Part>
      <Part ink={false} color={PAL.moss} position={[0.22, -0.1, 0.08]} rotation={[0, 0, -0.6]} grow={1.1}>
        <boxGeometry args={[0.24, 0.1, 0.03]} />
      </Part>
      {/* The swallow-tail end: two brass points. */}
      {([-1, 1] as const).map((side) => (
        <Part key={side} ink={false} color={PAL.brass} position={[side * 0.3, -1.9, 0]} rotation={[0, 0, side * 0.5]} grow={1.08}>
          <boxGeometry args={[0.3, 0.3, 0.05]} />
        </Part>
      ))}
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
function RisingTower({ rise, wall, moat, flag, shakeKey }: { rise: boolean; wall: YardWall; moat: YardMoat; flag: "none" | "intact"; shakeKey: number | null }) {
  // The walls and the moat change in place when a check is answered (#494); the tower does not rise again.
  const view = useMemo(() => practiceTowerView(wall, moat, flag), [wall, moat, flag]);
  const [up, setUp] = useState(() => !rise || prefersReducedMotion());
  const g = useRef<Group>(null);
  const t = useRef(0);
  // Beat 6 (#495): when the storm hits in this visit the tower shakes once, for half a second, a few centimetres. Never under
  // reduced motion (the page shows a "Prices fell" plate instead). The walls and the moat stay exactly as they were. Only the
  // picture shakes: the tower's fixed collider keeps the place it was made at, on purpose (7 cm for half a second).
  const shaker = useRef<Group>(null);
  const shakeLeft = useRef(0);
  useEffect(() => {
    if (shakeKey !== null && !prefersReducedMotion()) shakeLeft.current = SHAKE_SECONDS;
  }, [shakeKey]);
  useFrame((_, dt) => {
    if (shaker.current) {
      if (shakeLeft.current > 0) {
        shakeLeft.current = Math.max(0, shakeLeft.current - Math.min(dt, 0.05));
        const k = shakeLeft.current / SHAKE_SECONDS;
        shaker.current.position.x = Math.sin(shakeLeft.current * 60) * 0.07 * k;
      } else if (shaker.current.position.x !== 0) {
        shaker.current.position.x = 0;
      }
    }
    if (up || !g.current) return;
    t.current = Math.min(1, t.current + Math.min(dt, 0.05) / RISE_SECONDS);
    // Eased, so it slows as it reaches the top.
    g.current.scale.y = Math.max(0.001, 1 - (1 - t.current) ** 3);
    if (t.current >= 1) setUp(true);
  });
  return (
    <>
      <group visible={up} ref={shaker}>
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
      {/*
        The ground: outside the static batch, because the storm (#495) changes its colour while you watch, and a merged batch
        keeps the colour it was built with. Two meshes, so two draw calls at most.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color={look.stormy ? STORM_GROUND.grass : GRASS} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[YARD_RADIUS, 48]} />
        <meshStandardMaterial color={look.stormy ? STORM_GROUND.paddock : PADDOCK} flatShading />
      </mesh>
      <StaticBatch>
        {/* Ground: deep on purpose, so one long frame cannot let the hero fall through a thin slab. */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
        </RigidBody>
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

      {look.standing && <RisingTower key={look.riseKey ?? "standing"} rise={look.riseKey !== null} wall={look.wall} moat={look.moat} flag={look.flag} shakeKey={look.shakeKey} />}
      {look.standing && (
        // The tower's walls and moat in words, as a real tower's panel says them: "Walls not surveyed" until you have looked.
        <WorldSign
          spec={{ kind: "stone", lines: [WALL_LABEL[look.wall], MOAT_LABEL[look.moat]], fog: look.wall === "unsurveyed" && look.moat === "unsurveyed" }}
          position={[TOWER_PLATE_AT.x, 0.75, TOWER_PLATE_AT.z]}
          width={1.9}
          yaw={PLATE_YAW}
        />
      )}
      {/* Beat 7 (#496): the why, pinned on the tower door; beat 8: the lemon banner down the wall, once. */}
      {look.standing && look.sheet && <PinnedSheet lines={look.sheet} />}
      {look.standing && look.banner && <LemonBanner />}
      <Confetti burstKey={look.cheerKey} origin={CHEER_AT} />
      {look.factCards && <FactPlank pointAt={look.pointAt} owes={look.owes} />}
      {/* Beat 5's scale stands with the tower: before the pick there is no price to weigh. */}
      {look.standing && <PriceScale look={look.scale} price={look.price} worth={look.worth} />}
      <Lectern />
      <BoothMesh booth={PRACTICE_COUNTER} />
      {YARD_ADVISORS.map((n) => (
        <NpcMesh key={n.id} npc={n} active={false} playerPos={pos} />
      ))}
      {/*
        The yard's price post (#495): the gauge alone, in view of the arrival, with its words always on show. Mist and "? Weigh
        it" until the price is weighed (a price is on the scale, so the real "Not priced yet" would be untrue here), then the
        real gauge and its own word for Pip's zone.
      */}
      <PricePost
        post={look.gauge === "fog" ? FOG_POST : { ...FOG_POST, gauge: look.gauge }}
        pos={pos}
        gaugeOnly
        at={YARD_POST_AT}
        label={[PRICE_WORDS.title, look.gauge === "fog" ? `? ${STARTER_WORDS.scale.gaugeFog}` : PRICE_WORDS.gauge[look.gauge]]}
      />
      <QuestMarks marks={look.counterWaiting ? COUNTER_MARKS : NO_MARKS} />
    </group>
  );
}
