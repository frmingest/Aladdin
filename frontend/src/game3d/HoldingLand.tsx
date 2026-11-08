import { useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { DoubleSide } from "three";
import { PAL, Part } from "./Inked";
import { Bay } from "./LibraryBay";
import LanternPost from "./LanternPost";
import PricePost from "./PricePost";
import LandCentre from "./LandCentre";
import type { LandCentreSlot } from "./landCentre";
import type { PricePost as PricePostData } from "./holdingLand";
import StaticBatch from "./StaticBatch";
import {
  BAY_SCALE,
  GATE_LEAVE_RANGE,
  GATE_RANGE,
  GATE_STONE,
  LAND_GATE,
  LAND_SHELF_SLOTS,
  LAND_TABLE,
  RECORDS_HOUSE,
  SHELF_LEAVE_RANGE,
  SHELF_RANGE,
  TABLE_LEAVE_RANGE,
  TABLE_RANGE,
  nearLandTable,
  nearestLantern,
} from "./holdingLand";
import type { GateStone, Lantern } from "./holdingLand";
import type { SurveyCheckId } from "../lib/survey";
import { LAND_WORDS } from "./holdingLandWordsV1";
import { nearestShelf } from "./libraryRoom";
import type { Shelf, ShelfId } from "./libraryShelves";
import WorldLabel from "./WorldLabel";
import WorldSign from "./WorldSign";

const GRASS = "#7a9e5c";
const PADDOCK = "#8fb06b";
const PATH = "#a89f91";
const HEDGE = "#4f7a3a";
const PLASTER = "#d8c6a4";
const FLOOR = "#7a5638";
const HEDGE_SEGMENTS = 40;
const WALL_H = 3.4;
const WALL_T = 0.3;

/** The hedge round the edge of the land: one drawn tube, and a ring of solid blocks so the hero cannot walk out. */
function HedgeRing({ radius }: { radius: number }) {
  const blocks = useMemo(() => {
    const half = (Math.PI * radius) / HEDGE_SEGMENTS + 0.15;
    return Array.from({ length: HEDGE_SEGMENTS }, (_, i) => {
      const a = (i / HEDGE_SEGMENTS) * Math.PI * 2;
      return { key: i, half, x: Math.cos(a) * (radius + 0.4), z: Math.sin(a) * (radius + 0.4), rot: -a - Math.PI / 2 };
    });
  }, [radius]);
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {blocks.map((b) => (
          <CuboidCollider key={b.key} args={[b.half, 1.5, 0.4]} position={[b.x, 1.5, b.z]} rotation={[0, b.rot, 0]} />
        ))}
      </RigidBody>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[radius, radius, 1.4, 48, 1, true]} />
        <meshStandardMaterial color={HEDGE} flatShading side={DoubleSide} />
      </mesh>
    </>
  );
}

/** Tells the page which shelf you stand at, whether you stand at the gate or the table. Called only when it changes. */
function LandWatch({
  pos,
  onShelf,
  onGate,
  onTable,
  lanterns,
  onLantern,
  setActive,
}: {
  pos: MutableRefObject<{ x: number; z: number }>;
  onShelf: (id: ShelfId | null) => void;
  onGate: (near: boolean) => void;
  onTable: (near: boolean) => void;
  lanterns: readonly Lantern[];
  onLantern: (check: SurveyCheckId | null) => void;
  setActive: (id: ShelfId | null) => void;
}) {
  const lastLantern = useRef<SurveyCheckId | null>(null);
  const lastShelf = useRef<ShelfId | null>(null);
  const lastGate = useRef(false);
  const lastTable = useRef(false);
  useFrame(() => {
    const s = nearestShelf(pos.current, LAND_SHELF_SLOTS, lastShelf.current ? SHELF_LEAVE_RANGE : SHELF_RANGE);
    const id = s ? s.id : null;
    if (id !== lastShelf.current) {
      lastShelf.current = id;
      onShelf(id);
      setActive(id);
    }
    const g = Math.hypot(LAND_GATE.x - pos.current.x, LAND_GATE.z - pos.current.z) <= (lastGate.current ? GATE_LEAVE_RANGE : GATE_RANGE);
    if (g !== lastGate.current) {
      lastGate.current = g;
      onGate(g);
    }
    const l = nearestLantern(pos.current, lanterns, lastLantern.current);
    if (l !== lastLantern.current) {
      lastLantern.current = l;
      onLantern(l);
    }
    const t = nearLandTable(pos.current, lastTable.current ? TABLE_LEAVE_RANGE : TABLE_RANGE);
    if (t !== lastTable.current) {
      lastTable.current = t;
      onTable(t);
    }
  });
  return null;
}

interface Props {
  ticker: string;
  /** A named gap from the Standing ("no tagged filing"), shown honestly under the name. */
  gap?: string | null;
  /** The gate stone's facts, already worked out (`gateStoneFor`). Unknown stays unknown. */
  gate: GateStone;
  /** The ground radius for this holding's size class. Only the size of the ground follows the size class. */
  radius: number;
  shelves: Shelf[];
  pos: MutableRefObject<{ x: number; z: number }>;
  onShelf: (id: ShelfId | null) => void;
  onGate: (near: boolean) => void;
  onTable: (near: boolean) => void;
  /** The four survey lanterns (fog of war), from the survey; a survey not read yet gives four hooded lanterns. */
  lanterns: readonly Lantern[];
  onLantern: (check: SurveyCheckId | null) => void;
  /** The holding's own tower for the middle (`centreTowerFor`), and the price post's facts (`pricePostFor`). */
  centre: LandCentreSlot;
  price: PricePostData;
}

/**
 * A holding's own land (S25 PR 1, plain version). Every holding gets the same layout: a gate you arrive through, a
 * gate stone with the name, weight and value, and the records house with the seven shelves and the reading table.
 * Only the size of the ground follows the size class. Nothing here reads a verdict, and nothing is red or green.
 * The four survey lanterns stand in an arc across the land (PR 2); the holding's own tower and the price post stand in PR 3.
 */
export default function HoldingLand({ ticker, gap = null, gate, radius, shelves, pos, onShelf, onGate, onTable, lanterns, onLantern, centre, price }: Props) {
  const [active, setActive] = useState<ShelfId | null>(null);
  const [activeLantern, setActiveLantern] = useState<SurveyCheckId | null>(null);
  const byId = new Map(shelves.map((s) => [s.id, s]));
  const { x: hx0, z: hz0, hx, hz } = RECORDS_HOUSE;
  const west = hx0 - hx;
  const east = hx0 + hx;
  const north = hz0 - hz;
  const south = hz0 + hz;
  return (
    <group>
      {/* Everything still is drawn in one go (S23): the ground, hedge, gate, stone, house and table carry no changing fact. */}
      <StaticBatch>
      {/* Ground: deep on purpose, so one long frame (a model loading) cannot let the hero fall through a thin slab. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color={GRASS} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[radius, 48]} />
        <meshStandardMaterial color={PADDOCK} flatShading />
      </mesh>
      <HedgeRing radius={radius} />
      {/* The path from the gate up the middle. */}
      <mesh position={[0, 0.04, (LAND_GATE.z + 1) / 2]} receiveShadow>
        <boxGeometry args={[3, 0.06, LAND_GATE.z - 1]} />
        <meshStandardMaterial color={PATH} flatShading />
      </mesh>

      {/* The gate: two low posts, so the follow camera behind you sees over them. E at the gap leads back out. */}
      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * 1.5, 0.8, LAND_GATE.z]} grow={1.1}>
          <boxGeometry args={[0.35, 1.6, 0.35]} />
        </Part>
      ))}

      {/* The gate stone: the holding's name, its place in the realm and its value. Unknown stays unknown. */}
      <RigidBody type="fixed" colliders={false} position={[GATE_STONE.x, 0, GATE_STONE.z]}>
        <CuboidCollider args={[0.8, 0.7, 0.35]} position={[0, 0.7, 0]} />
        <Part color={PAL.slate} position={[0, 0.7, 0]} grow={1.06}>
          <boxGeometry args={[1.6, 1.4, 0.7]} />
        </Part>
        <Part color={PAL.slateDark} position={[0, 0.08, 0]} grow={1.06}>
          <boxGeometry args={[2, 0.16, 1]} />
        </Part>
      </RigidBody>
      {/* Carved on the stone's face: name, ticker, weight, value. Unknown stays the flat page's own words. */}
      <WorldSign
        spec={{ kind: "stone", lines: [gate.title, `${ticker}${gap ? ` · Gap: ${gap}` : ""}`, gate.weight, gate.value] }}
        position={[GATE_STONE.x, 0.78, GATE_STONE.z + 0.4]}
        width={1.5}
        both={false}
      />
      {gate.note && (
        <WorldLabel position={[GATE_STONE.x, 1.9, GATE_STONE.z]} distanceFactor={9}>
          <div className="whitespace-nowrap text-xs italic">{gate.note}</div>
        </WorldLabel>
      )}

      {/* The records house: three walls and a ceiling drawn from inside only (so the camera can sit outside them), open to the east. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hx + WALL_T, WALL_H / 2, WALL_T / 2]} position={[hx0, WALL_H / 2, north - WALL_T / 2]} />
        <CuboidCollider args={[hx + WALL_T, WALL_H / 2, WALL_T / 2]} position={[hx0, WALL_H / 2, south + WALL_T / 2]} />
        <CuboidCollider args={[WALL_T / 2, WALL_H / 2, hz]} position={[west - WALL_T / 2, WALL_H / 2, hz0]} />
        {/* The two front posts are solid; the gap between them is the way in. */}
        {([-1, 1] as const).map((s) => (
          <CuboidCollider key={s} args={[0.2, WALL_H / 2, 0.2]} position={[east, WALL_H / 2, hz0 + s * (hz - 0.2)]} />
        ))}
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[hx0, 0.03, hz0]} receiveShadow>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={FLOOR} flatShading />
      </mesh>
      <mesh position={[hx0, WALL_H / 2, north]} receiveShadow>
        <planeGeometry args={[hx * 2, WALL_H]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>
      <mesh rotation={[0, Math.PI, 0]} position={[hx0, WALL_H / 2, south]} receiveShadow>
        <planeGeometry args={[hx * 2, WALL_H]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[west, WALL_H / 2, hz0]} receiveShadow>
        <planeGeometry args={[hz * 2, WALL_H]} />
        <meshStandardMaterial color={PLASTER} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[hx0, WALL_H, hz0]}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color="#8d6b45" flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[east, WALL_H / 2, hz0 + s * (hz - 0.2)]} grow={1.1}>
          <boxGeometry args={[0.4, WALL_H, 0.4]} />
        </Part>
      ))}
      <Part color={PAL.timberDark} position={[east, WALL_H + 0.1, hz0]} grow={1.04}>
        <boxGeometry args={[0.4, 0.3, hz * 2 + 0.4]} />
      </Part>
      <WorldSign spec={{ kind: "plank", lines: [LAND_WORDS.houseLabel] }} position={[east, WALL_H + 0.75, hz0]} width={3} yaw={Math.PI / 2} />

      {/* A rug, the reading table and an open book: furniture, no facts. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAND_TABLE.x, 0.05, LAND_TABLE.z]} receiveShadow>
        <planeGeometry args={[4.2, 3.2]} />
        <meshStandardMaterial color={PAL.tealDark} flatShading />
      </mesh>
      <RigidBody type="fixed" colliders={false} position={[LAND_TABLE.x, 0, LAND_TABLE.z]}>
        <CuboidCollider args={[LAND_TABLE.hx, 0.5, LAND_TABLE.hz]} position={[0, 0.5, 0]} />
        <Part color={PAL.timberLight} position={[0, 1.0, 0]} grow={1.08}>
          <boxGeometry args={[LAND_TABLE.hx * 2, 0.12, LAND_TABLE.hz * 2]} />
        </Part>
        {([-1, 1] as const).flatMap((sx) =>
          ([-1, 1] as const).map((sz) => (
            <Part key={`${sx}${sz}`} color={PAL.timberDark} position={[sx * (LAND_TABLE.hx - 0.15), 0.5, sz * (LAND_TABLE.hz - 0.12)]} grow={1.25}>
              <boxGeometry args={[0.14, 1, 0.14]} />
            </Part>
          )),
        )}
        <Part color={PAL.cream} position={[0, 1.1, 0]} grow={1.15} ink={false}>
          <boxGeometry args={[0.9, 0.08, 0.6]} />
        </Part>
      </RigidBody>

      </StaticBatch>

      {/* The seven shelves round the walls, at the records house's smaller size. */}
      {LAND_SHELF_SLOTS.map((slot) => {
        const shelf = byId.get(slot.id);
        return shelf ? <Bay key={slot.id} shelf={shelf} x={slot.x} z={slot.z} yaw={slot.yaw} active={active === slot.id} scale={BAY_SCALE} /> : null;
      })}

      {/* The holding's own tower in the middle: its real wall, crown, cracks and moat, or a pale ghost when unknown. */}
      <LandCentre slot={centre} />
      <PricePost post={price} pos={pos} />

      {/* The survey lanterns carry facts, so they sit outside the batch of still pieces. */}
      {lanterns.map((l) => (
        <LanternPost key={l.check} lantern={l} active={activeLantern === l.check} />
      ))}

      <LandWatch
        pos={pos}
        onShelf={onShelf}
        onGate={onGate}
        onTable={onTable}
        lanterns={lanterns}
        onLantern={(c) => {
          setActiveLantern(c);
          onLantern(c);
        }}
        setActive={setActive}
      />
    </group>
  );
}
