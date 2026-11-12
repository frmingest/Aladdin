import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import { api } from "../lib/api";
import { useCachedQuery } from "../lib/queryCache";
import type { MacroIndicators } from "../lib/types";
import { PAL, Part } from "./Inked";
import {
  DIALS_LEAVE_RANGE,
  DIALS_RANGE,
  PLATE,
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
import { BANNER_PX, PLATE_PX, POST_PX, drawBanner, drawPlate, drawPost } from "./weatherPlateArt";
import { WEATHER_WORDS } from "./weatherTowerWordsV2";

const STONE = "#b9b2a4";
const FLOOR = "#5d5a66";
const BRASS = "#c79a3a";
const LENGTH_Z = TOWER.maxZ - TOWER.minZ;
const MID_Z = (TOWER.maxZ + TOWER.minZ) / 2;
const WIDTH_X = TOWER.maxX - TOWER.minX;

/** A texture drawn once on a 2D canvas: crisp text and lines, no DOM label, no per-frame work. */
function makeTexture(size: { w: number; h: number }, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

/** Throws a texture away when it is replaced or the mesh goes. */
function useDispose(texture: CanvasTexture) {
  useEffect(() => () => texture.dispose(), [texture]);
}

/** One flat picture on a wall or post: unlit, so the words read the same wherever you stand. */
function Sheet({ texture, width, height }: { texture: CanvasTexture; width: number; height: number }) {
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

/**
 * One plate: the series' name and number always in big type, its last 24 months as a line, and a low-to-high bar with a
 * dot for where today sits in that range. Replaces the clock face (issue #402). State is told by shape and word: no
 * reading = dashed rim and "No reading"; stale = a slate tab that says "stale". The plate you stand beside gets a gold
 * rim. Nothing here says good or bad.
 */
function Plate({ d, lit }: { d: DialPlan; lit: boolean }) {
  const texture = useMemo(() => makeTexture(PLATE_PX, (ctx) => drawPlate(ctx, d, lit)), [d, lit]);
  useDispose(texture);
  return (
    <group position={[d.x, d.y, d.z]} rotation={[0, d.yaw, 0]}>
      <group position={[0, 0, 0.05]}>
        <Sheet texture={texture} width={PLATE.width} height={PLATE.height} />
      </group>
    </group>
  );
}

/** A wide wall banner (a heading or a key). */
function Banner({ position, yaw, width, big, small }: { position: [number, number, number]; yaw: number; width: number; big: string; small: string | null }) {
  const texture = useMemo(() => makeTexture(BANNER_PX, (ctx) => drawBanner(ctx, big, small)), [big, small]);
  useDispose(texture);
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <Sheet texture={texture} width={width} height={(width * BANNER_PX.h) / BANNER_PX.w} />
    </group>
  );
}

/** One post on the curve rail: its height is the yield itself on a fixed scale; a stale reading wears a grey cap and a "stale" word. */
function Post({ p }: { p: RailPost }) {
  const { tenor, text, stale } = p;
  const texture = useMemo(() => makeTexture(POST_PX, (ctx) => drawPost(ctx, tenor, text, stale)), [tenor, text, stale]);
  useDispose(texture);
  return (
    <group position={[p.x, 0, RAIL.z]}>
      <Part color={PAL.timber} position={[0, p.height / 2, 0]} grow={1.08}>
        <boxGeometry args={[0.34, p.height, 0.34]} />
      </Part>
      <Part color={p.stale ? PAL.slateDark : BRASS} position={[0, p.height + 0.1, 0]} grow={1.1}>
        <sphereGeometry args={[0.2, 10, 8]} />
      </Part>
      <group position={[0, p.height + 0.62, 0.05]}>
        <Sheet texture={texture} width={1.1} height={(1.1 * POST_PX.h) / POST_PX.w} />
      </group>
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
 * The inside of the Weather Tower: one wall plate for each stored macro series (name, number, 24-month line, low-to-high dot), Norway west, the United States east, the
 * computed gaps north, and a rail of posts down the middle for Norway's own curve. Read through the same call as the flat
 * Macro page (`getMacroIndicators`, same cache key as the Town Hall board); a failed read leaves the walls bare with the
 * plain plate, never a guess. Walls are drawn from inside only so the follow camera can sit outside them. The room is
 * furniture: every plate and post is decided by code from the stored numbers.
 */
export default function WeatherTowerRoom({ pos, onDials, onDoor }: Props) {
  const macro = useCachedQuery<MacroIndicators>("macro-indicators", () => api.getMacroIndicators());
  const data = macro.data ?? null;
  const layout = useMemo(() => towerLayout(data), [data]);
  const posts = useMemo(() => curvePosts(data), [data]);
  const plate = towerPlate(towerFacts(data));
  const [readoutKey, setReadoutKey] = useState<string | null>(null);
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
      <Banner position={[0, 0.42, RAIL.z + 0.9]} yaw={0} width={4.2} big={WEATHER_WORDS.railKey} small={null} />

      {layout.dials.map((d) => (
        <Plate key={d.key} d={d} lit={d.key === readoutKey} />
      ))}

      <Banner position={[0, 6.45, TOWER.minZ + 0.1]} yaw={0} width={6} big={plate[0]} small={plate.length > 1 ? plate.slice(1).join(" · ") : null} />
      <Banner position={[0, 0.42, TOWER.minZ + 0.1]} yaw={0} width={5} big={WEATHER_WORDS.dotKey} small={null} />
      <Banner position={[TOWER.minX + 0.1, 6.45, MID_Z]} yaw={Math.PI / 2} width={3.6} big={WEATHER_WORDS.west} small={null} />
      <Banner position={[TOWER.maxX - 0.1, 6.45, MID_Z]} yaw={-Math.PI / 2} width={3.6} big={WEATHER_WORDS.east} small={null} />

      <TowerWatch pos={pos} dials={layout.dials} onDials={onDials} onDoor={onDoor} onReadout={setReadoutKey} />
    </group>
  );
}

