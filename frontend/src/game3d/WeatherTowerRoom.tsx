import { useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { api } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import type { MacroIndicators } from "../lib/types";
import { INK, PAL, Part } from "./Inked";
import {
  DIALS_LEAVE_RANGE,
  DIALS_RANGE,
  DIAL_RADIUS,
  RAIL,
  READOUT_LEAVE_RANGE,
  READOUT_RANGE,
  TOWER,
  TOWER_DOOR,
  TOWER_DOOR_LEAVE_RANGE,
  TOWER_DOOR_RANGE,
  curvePosts,
  nearDials,
  nearTowerDoor,
  nearestDial,
  towerFacts,
  towerLayout,
  towerPlate,
} from "./weatherTowerRoom";
import type { DialPlan, RailPost } from "./weatherTowerRoom";
import { WEATHER_WORDS } from "./weatherTowerWordsV1";
import WorldLabel from "./WorldLabel";

const STONE = "#b9b2a4";
const FLOOR = "#5d5a66";
const BRASS = "#c79a3a";
const FACE = "#eee4d3";
const FACE_EMPTY = "#a3a6c0";
const LENGTH_Z = TOWER.maxZ - TOWER.minZ;
const MID_Z = (TOWER.maxZ + TOWER.minZ) / 2;
const WIDTH_X = TOWER.maxX - TOWER.minX;

/**
 * One dial: a brass-rimmed face, a needle that shows where the value sits in its own 24-month range, and a paper trace
 * of those 24 months under it. State is told by shape: no reading = a grey face with no needle; stale = a hood over the
 * top half. Colour never carries it alone, and nothing here says good or bad.
 */
function Dial({ d }: { d: DialPlan }) {
  const turn: [number, number, number] = [Math.PI / 2, 0, 0];
  return (
    <group position={[d.x, d.y, d.z]} rotation={[0, d.yaw, 0]}>
      <Part color={BRASS} rotation={turn} grow={1.05}>
        <cylinderGeometry args={[DIAL_RADIUS + 0.1, DIAL_RADIUS + 0.1, 0.12, 20]} />
      </Part>
      <mesh position={[0, 0, 0.07]} rotation={turn}>
        <cylinderGeometry args={[DIAL_RADIUS, DIAL_RADIUS, 0.02, 20]} />
        <meshBasicMaterial color={d.state === "empty" ? FACE_EMPTY : FACE} />
      </mesh>
      {d.needle !== null && (
        <group position={[0, 0, 0.1]} rotation={[0, 0, d.needle]}>
          <mesh position={[0, DIAL_RADIUS * 0.38, 0]}>
            <boxGeometry args={[0.07, DIAL_RADIUS * 0.76, 0.03]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        </group>
      )}
      <mesh position={[0, 0, 0.12]} rotation={turn}>
        <cylinderGeometry args={[0.09, 0.09, 0.04, 10]} />
        <meshBasicMaterial color={BRASS} />
      </mesh>
      {d.state === "stale" && (
        <mesh position={[0, 0, 0.14]} rotation={turn}>
          <cylinderGeometry args={[DIAL_RADIUS * 0.98, DIAL_RADIUS * 0.98, 0.02, 20, 1, false, -Math.PI / 2, Math.PI]} />
          <meshBasicMaterial color={PAL.slateDark} />
        </mesh>
      )}
      {d.trace.length >= 2 && (
        <group position={[0, -DIAL_RADIUS - 0.62, 0.05]}>
          <mesh>
            <planeGeometry args={[1.7, 0.62]} />
            <meshBasicMaterial color={FACE} />
          </mesh>
          <Line points={d.trace.map(([x, y]) => [x, y - 0.25, 0.01] as [number, number, number])} color={INK} lineWidth={1.5} />
        </group>
      )}
    </group>
  );
}

/** One post on the curve rail: its height is the yield itself on a fixed scale; a stale reading wears a grey cap. */
function Post({ p }: { p: RailPost }) {
  return (
    <group position={[p.x, 0, RAIL.z]}>
      <Part color={PAL.timber} position={[0, p.height / 2, 0]} grow={1.08}>
        <boxGeometry args={[0.34, p.height, 0.34]} />
      </Part>
      <Part color={p.stale ? PAL.slateDark : BRASS} position={[0, p.height + 0.1, 0]} grow={1.1}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </Part>
      <WorldLabel position={[0, p.height + 0.7, 0]} distanceFactor={8}>
        <div className="text-xs font-semibold">{p.tenor}</div>
        <div className="text-xs opacity-80">
          {p.text}
          {p.stale ? ` (${WEATHER_WORDS.stale})` : ""}
        </div>
      </WorldLabel>
    </group>
  );
}

interface WatchProps {
  pos: MutableRefObject<{ x: number; z: number }>;
  dials: readonly DialPlan[];
  onDials: (near: boolean) => void;
  onDoor: (near: boolean) => void;
  onReadout: (key: string | null) => void;
}

/** Tells the page whether you stand at the dials and at the door, and the readout which dial you stand beside. Only on change. */
function TowerWatch({ pos, dials, onDials, onDoor, onReadout }: WatchProps) {
  const lastDials = useRef(false);
  const lastDoor = useRef(false);
  const lastKey = useRef<string | null>(null);
  useFrame(() => {
    const a = nearDials(pos.current, lastDials.current ? DIALS_LEAVE_RANGE : DIALS_RANGE);
    if (a !== lastDials.current) {
      lastDials.current = a;
      onDials(a);
    }
    const d = nearTowerDoor(pos.current, lastDoor.current ? TOWER_DOOR_LEAVE_RANGE : TOWER_DOOR_RANGE);
    if (d !== lastDoor.current) {
      lastDoor.current = d;
      onDoor(d);
    }
    const held = lastKey.current === null ? null : dials.find((x) => x.key === lastKey.current) ?? null;
    const range = held ? READOUT_LEAVE_RANGE : READOUT_RANGE;
    const near = nearestDial(pos.current, dials, range);
    const key = near ? near.key : null;
    if (key !== lastKey.current) {
      lastKey.current = key;
      onReadout(key);
    }
  });
  return null;
}

interface Props {
  pos: MutableRefObject<{ x: number; z: number }>;
  onDials: (near: boolean) => void;
  onDoor: (near: boolean) => void;
}

/**
 * The inside of the Weather Tower: one dial for each stored macro series, Norway west, the United States east, the
 * computed gaps north, and a rail of posts down the middle for Norway's own curve. Read through the same call as the flat
 * Macro page (`getMacroIndicators`, same cache key as the Town Hall board); a failed read leaves the walls bare with the
 * plain plate, never a guess. Walls are drawn from inside only so the follow camera can sit outside them. The room is
 * furniture: every needle, trace and post is decided by code from the stored numbers.
 */
export default function WeatherTowerRoom({ pos, onDials, onDoor }: Props) {
  const macro = useCachedQuery<MacroIndicators>("macro-indicators", () => api.getMacroIndicators());
  const data = macro.data ?? null;
  const layout = useMemo(() => towerLayout(data), [data]);
  const posts = useMemo(() => curvePosts(data), [data]);
  const plate = towerPlate(towerFacts(data));
  const [readoutKey, setReadoutKey] = useState<string | null>(null);
  const readout = readoutKey ? layout.dials.find((d) => d.key === readoutKey) ?? null : null;
  const doorGap = TOWER_DOOR.width / 2;
  const sideLen = (WIDTH_X - TOWER_DOOR.width) / 2;
  const railW = RAIL.maxX - RAIL.minX + 1.4;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[WIDTH_X / 2 + 1, 0.5, LENGTH_Z / 2 + 1]} position={[0, -0.5, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, TOWER.height / 2, 0.5]} position={[0, TOWER.height / 2, TOWER.minZ - 0.5]} />
        <CuboidCollider args={[0.5, TOWER.height / 2, LENGTH_Z / 2 + 1]} position={[TOWER.minX - 0.5, TOWER.height / 2, MID_Z]} />
        <CuboidCollider args={[0.5, TOWER.height / 2, LENGTH_Z / 2 + 1]} position={[TOWER.maxX + 0.5, TOWER.height / 2, MID_Z]} />
        <CuboidCollider args={[WIDTH_X / 2 + 1, TOWER.height / 2, 0.5]} position={[0, TOWER.height / 2, TOWER.maxZ + 0.5]} />
        <CuboidCollider args={[railW / 2, 0.6, 0.3]} position={[0, 0.6, RAIL.z]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, MID_Z]} receiveShadow>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color={FLOOR} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, TOWER.height, MID_Z]}>
        <planeGeometry args={[WIDTH_X, LENGTH_Z]} />
        <meshStandardMaterial color="#6b6e8a" flatShading />
      </mesh>
      <mesh position={[0, TOWER.height / 2, TOWER.minZ]} receiveShadow>
        <planeGeometry args={[WIDTH_X, TOWER.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[TOWER.minX, TOWER.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, TOWER.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[TOWER.maxX, TOWER.height / 2, MID_Z]} receiveShadow>
        <planeGeometry args={[LENGTH_Z, TOWER.height]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} rotation={[0, Math.PI, 0]} position={[s * (doorGap + sideLen / 2), TOWER.height / 2, TOWER.maxZ]} receiveShadow>
          <planeGeometry args={[sideLen, TOWER.height]} />
          <meshStandardMaterial color={STONE} flatShading />
        </mesh>
      ))}
      <mesh rotation={[0, Math.PI, 0]} position={[0, (TOWER.height + 3.4) / 2, TOWER.maxZ]}>
        <planeGeometry args={[TOWER_DOOR.width, TOWER.height - 3.4]} />
        <meshStandardMaterial color={STONE} flatShading />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <Part key={s} color={PAL.timber} position={[s * (TOWER_DOOR.width / 4), 1.7, TOWER.maxZ - 0.12]} grow={1.04}>
          <boxGeometry args={[TOWER_DOOR.width / 2 - 0.05, 3.4, 0.2]} />
        </Part>
      ))}
      <Part color={PAL.iron} position={[0, 1.6, TOWER.maxZ - 0.3]} grow={1.2}>
        <torusGeometry args={[0.18, 0.04, 6, 14]} />
      </Part>

      {/* The rail: a low timber beam the curve posts stand on. Furniture; the posts carry the numbers. */}
      <Part color={PAL.timberDark} position={[0, 0.2, RAIL.z]} grow={1.03}>
        <boxGeometry args={[railW, 0.4, 0.6]} />
      </Part>
      {posts.map((p) => (
        <Post key={p.key} p={p} />
      ))}
      <WorldLabel position={[0, 0.9, RAIL.z + 0.7]} distanceFactor={8}>
        <div className="text-xs opacity-80">{WEATHER_WORDS.railKey}</div>
      </WorldLabel>

      {layout.dials.map((d) => (
        <Dial key={d.key} d={d} />
      ))}

      <WorldLabel position={[0, 6.4, TOWER.minZ + 0.5]} distanceFactor={9} wrap maxWidth={300} reveal="always">
        {plate.map((line, i) => (
          <div key={line} className={i === 0 ? "text-sm font-semibold" : "text-xs opacity-80"}>
            {line}
          </div>
        ))}
        <div className="text-xs opacity-80">{WEATHER_WORDS.needleKey}</div>
      </WorldLabel>
      {readout && (
        <WorldLabel position={[readout.x, readout.y + DIAL_RADIUS + 0.55, readout.z]} distanceFactor={7} wrap maxWidth={240} now reveal="always">
          {readout.readout.map((line, i) => (
            <div key={line} className={i === 0 ? "text-sm font-semibold" : "text-xs opacity-80"}>
              {line}
            </div>
          ))}
        </WorldLabel>
      )}
      <WorldLabel position={[TOWER.minX + 0.4, 6.4, MID_Z]} distanceFactor={9} reveal="always">
        <div className="text-xs font-semibold">{WEATHER_WORDS.west}</div>
      </WorldLabel>
      <WorldLabel position={[TOWER.maxX - 0.4, 6.4, MID_Z]} distanceFactor={9} reveal="always">
        <div className="text-xs font-semibold">{WEATHER_WORDS.east}</div>
      </WorldLabel>

      <TowerWatch pos={pos} dials={layout.dials} onDials={onDials} onDoor={onDoor} onReadout={setReadoutKey} />
    </group>
  );
}

