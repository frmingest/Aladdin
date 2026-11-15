import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import Courtyard from "./Courtyard";
import type { WorldModel } from "./stateToWorld";
import PerfProbe from "./PerfProbe";
import type { PerfStats } from "./PerfProbe";
import Player from "./Player";
import type { Teleport } from "./Player";
import { useKeys } from "./useKeys";
import { useOrbit } from "./useOrbit";
import { NPCS } from "./npcs";
import type { NpcId } from "./npcs";
import NpcMesh from "./NpcMesh";
import QuestMarks from "./QuestMarks";
import type { GuideMark } from "./guideQuests";
import PropMesh from "./PropMesh";
import Scenery from "./Scenery";
import Market from "./Market";
import Booths from "./Booths";
import StandingTorches from "./StandingTorches";
import Horizon from "./Horizon";
import Countryside from "./Countryside";
import MeadowPlants from "./MeadowPlants";
import Backdrop from "./Backdrop";
import Townsfolk from "./Townsfolk";
import Workers from "./Workers";
import Confetti from "./Confetti";
import Desk from "./Desk";
import Vault from "./Vault";
import type { FortressSiegeLevel, FortressVaultLevel, NightWatchStatus } from "../lib/types";
import WatchPost from "./WatchPost";
import HourglassPost from "./HourglassPost";
import RavenBirds from "./RavenBirds";
import RealmPost from "./RealmPost";
import Weather from "./Weather";
import SkyDome from "./SkyDome";
import { weatherLook } from "./weatherPlan";
import type { RealmLevel } from "../lib/realmVerdict";
import DrillCamp from "./DrillCamp";
import DrillPost from "./DrillPost";
import SiegeField from "./SiegeField";
import { DEFAULT_TOOLS } from "./siegeFieldTools";
import type { FieldTools } from "./siegeFieldTools";
import SiegeGate from "./SiegeGate";
import MarketQuarter from "./MarketQuarter";
import QuarterArch from "./QuarterArch";
import MarkLayer from "./MarkLayer";
import { NO_MARKS } from "./marks";
import type { PlacedMarks } from "./marks";
import type { Quarter } from "./quarterPlan";
import Signpost from "./Signpost";
import { PROPS } from "./props";
import HoldingLand from "./HoldingLand";
import type { GateStone, Lantern, PricePost } from "./holdingLand";
import type { LandCentreSlot } from "./landCentre";
import Village from "./Village";
import TownHallRoom from "./TownHallRoom";
import RecordsHallRoom from "./RecordsHallRoom";
import MintRoom from "./MintRoom";
import WeatherTowerRoom from "./WeatherTowerRoom";
import { EMPTY_MINT } from "./useMint";
import type { MintView } from "./useMint";
import { facesResultWall, leverLayout, turnToResultWall } from "./mintRoom";
import { prefersReducedMotion } from "./motionPref";
import { AREAS, COURTYARD, sameArea, transitionSpot } from "./areas";
import type { AreaRef } from "./areas";
import { cameraRoomOf } from "./cameraRoom";
import { watchSpots } from "./near";
import type { SpotWorld } from "./near";
import { nearStore, useNear } from "./nearStore";
import type { Shelf } from "./libraryShelves";
import { enterableOf } from "./towerDoor";

const HALL_DARK = "#1d1712";
const noop = () => {};
const NO_LANTERNS: readonly Lantern[] = [];
const NO_LIT: ReadonlySet<string> = new Set();

/** What the world shows that the page works out from the facts. None of it is about where the hero stands. */
export interface SceneLook {
  /** Books on the writing desk's shelf: holdings with a reason and a wrong-if line. */
  books: number;
  /** The backend's vault level (decides the coin stacks on the chest), or null when it cannot be read. */
  vaultLevel: FortressVaultLevel | null;
  /** The backend's Night Watch status (decides the lantern), or null when the dispatch cannot be read. */
  watchStatus: NightWatchStatus | null;
  /** Ravens not yet marked seen: one bird each on the perch, none when there are none. */
  unseenRavens: number;
  /** The verdict on the whole fortress (worked out by summarizeRealm), or null when the fortress cannot be read. Decides the pennant. */
  realmLevel: RealmLevel | null;
  /** The backend's siege level: the weather. Decides the sky, the clouds and the weather plate. Null when it cannot be read (mist). */
  siegeLevel: FortressSiegeLevel | null;
  /** A Storm Drill is open: the camp stands. */
  drillOpen: boolean;
  /** The Guide's quest marks (over a giver's head or over the place a step leads to). */
  questMarks: readonly GuideMark[];
  /** Whose dialogue is open (the Oracle casts while he talks). */
  talking: NpcId | null;
  /** A new number starts the quest-done cheer and confetti, once. */
  cheerKey: number | null;
  /** The Standing level (0 to 4); null when it could not be read. One Standing torch burns per level. */
  standingLevel: number | null;
  /** Siege Field: the fall and yardstick the winch, stones and banners steer. */
  fieldTools: FieldTools;
  /** Market Quarter: one stall per watchlist company, laid out up the lane (quarterPlan.ts). */
  quarter: Quarter;
  /** The arch's count line: how many stalls, how many in range. Null while the watchlist is unread. */
  archCounts: { total: number; inRange: number } | null;
  /** The marks that stand in the yard (raven, smoke, bell), worked out from stored facts by marks.ts. */
  marks: PlacedMarks;
  /** Watchlist companies whose stall is lit (in your range, with a fresh price). */
  litStalls: ReadonlySet<string>;
  /** Some stall is lit: one lamp hangs under the arch. */
  archLit: boolean;
  /** Sheets pinned on the Watch Post, 0 to 3. */
  noticeSheets: number;
  /** The Royal Mint: the levers, where each is set, the span and the last stamped answer. */
  mint: MintView;
}

/** A world with nothing read yet: bare, dark and honest. */
const EMPTY_LOOK: SceneLook = {
  books: 0,
  vaultLevel: null,
  watchStatus: null,
  unseenRavens: 0,
  realmLevel: null,
  siegeLevel: null,
  drillOpen: false,
  questMarks: [],
  talking: null,
  cheerKey: null,
  standingLevel: null,
  fieldTools: DEFAULT_TOOLS("local"),
  quarter: { stalls: [], overflow: [], fogZ: null, total: 0, inRange: 0 },
  archCounts: null,
  marks: NO_MARKS,
  litStalls: NO_LIT,
  archLit: false,
  noticeSheets: 0,
  mint: EMPTY_MINT,
};

interface WorldProps {
  world: WorldModel;
  /** Which place the hero is in. Only that place is drawn. */
  area: AreaRef;
  /** The holding's land, when `area` is one. */
  room: RoomView | null;
  /** A move between places is under way (S22): the hero stands still. */
  hold: boolean;
  look: SceneLook;
  /** Siege Field: the preset falls and range the backend answered with. */
  onFieldPresets: (p: { toStorm: number | null; toSiege: number | null; min: number; max: number }) => void;
  onLockChange: (locked: boolean) => void;
}

interface Props extends Omit<WorldProps, "area" | "room" | "hold" | "look" | "onFieldPresets"> {
  area?: AreaRef;
  room?: RoomView | null;
  hold?: boolean;
  look?: SceneLook;
  onFieldPresets?: WorldProps["onFieldPresets"];
  onStats: (s: PerfStats) => void;
  /** Per-group draw-call walk for the stats overlay; off unless the overlay is open. */
  statsDetail?: boolean;
}

export interface RoomView {
  holdingId: string;
  name: string;
  ticker: string;
  gap?: string | null;
  /** The gate stone's words and numbers, from the stored row (unknown stays unknown). */
  gate: GateStone;
  /** The four survey lanterns of this holding (fog of war). */
  lanterns: Lantern[];
  /** The holding's own tower for the middle of the land, and the price post's facts. */
  centre: LandCentreSlot;
  price: PricePost;
  /** The ground radius for the holding's size class. */
  radius: number;
  shelves: Shelf[];
}

/**
 * The one watcher (#411): every frame it asks the list of things you can walk up to (`SPOTS` in near.ts) who is in
 * reach in this place, and writes what changed to the near store. The page and the world both read it from there.
 */
function SpotWatch({ pos, area, world }: { pos: MutableRefObject<{ x: number; z: number }>; area: AreaRef; world: SpotWorld }) {
  const where = area.id === "holding" ? `holding:${area.holdingId}` : area.id;
  // A new place: nothing is near until the watcher says so.
  useEffect(() => {
    nearStore.reset();
    return () => nearStore.reset();
  }, [where]);
  useFrame(() => {
    const changed = watchSpots(area.id, pos.current, nearStore.get(), world);
    if (changed) nearStore.patch(changed);
  });
  return null;
}

/** The two advisors; the one in reach turns to you. */
function Advisors({ pos, talking, cheerKey }: { pos: MutableRefObject<{ x: number; z: number }>; talking: NpcId | null; cheerKey: number | null }) {
  const near = useNear("npc");
  return (
    <>
      {NPCS.map((n) => (
        <NpcMesh key={n.id} npc={n} active={near === n.id} playerPos={pos} talking={talking === n.id} cheerKey={cheerKey} />
      ))}
    </>
  );
}

function World({ onLockChange, world, area, room, hold, look, onFieldPresets }: WorldProps) {
  const keys = useKeys();
  const pos = useRef({ x: 0, z: 0 });
  const orbit = useOrbit(onLockChange);

  // The Royal Mint: when you stamp, the camera turns to face the result wall so the plates are in view as they print.
  // It is one short turn. It only starts if you are not already facing the wall, it stops the moment you look somewhere
  // yourself (any change to the angles that we did not write), it ends if you leave the room, and it jumps when the system
  // asks for less motion.
  const stampWall = look.mint.wall;
  const inMint = area.id === "mint";
  const stampTurn = useRef<{ yaw: number; pitch: number } | null>(null);
  const prevWall = useRef(stampWall);
  useEffect(() => {
    if (inMint && stampWall === "loading" && prevWall.current !== "loading" && !facesResultWall(orbit.current)) {
      stampTurn.current = { yaw: orbit.current.yaw, pitch: orbit.current.pitch };
    }
    prevWall.current = stampWall;
  }, [stampWall, inMint, orbit]);
  useEffect(() => {
    if (!inMint) stampTurn.current = null;
  }, [inMint]);
  useFrame((_, dt) => {
    const t = stampTurn.current;
    if (!t) return;
    const o = orbit.current;
    // The player looked: the angles are no longer what the turn last wrote. Let go.
    if (o.yaw !== t.yaw || o.pitch !== t.pitch) {
      stampTurn.current = null;
      return;
    }
    const step = turnToResultWall(o, Math.min(dt, 0.05), prefersReducedMotion());
    o.yaw = step.yaw;
    o.pitch = step.pitch;
    if (step.done) stampTurn.current = null;
    else stampTurn.current = { yaw: step.yaw, pitch: step.pitch };
  });

  // One teleport for every door: in at the area's spawn, out at the spot in front of the door you came through.
  const [teleport, setTeleport] = useState<Teleport | null>(null);
  const prevArea = useRef<AreaRef>(COURTYARD);
  const count = useRef(0);
  useEffect(() => {
    if (sameArea(area, prevArea.current)) return;
    const from = prevArea.current;
    prevArea.current = area;
    const spot = transitionSpot(from, area, world.towers.map(enterableOf));
    if (spot) setTeleport({ key: ++count.current, x: spot.x, z: spot.z, yaw: spot.yaw });
  }, [area, world.towers]);

  // The parts of the list that follow the data: the towers that stand, the stalls up the lane, this land's lanterns.
  const lanterns = room?.lanterns ?? NO_LANTERNS;
  const mintLevers = useMemo(() => leverLayout(look.mint.levers).plans, [look.mint.levers]);
  const spotWorld = useMemo<SpotWorld>(() => ({ towers: world.towers, stalls: look.quarter.stalls, lanterns, mintLevers }), [world.towers, look.quarter.stalls, lanterns, mintLevers]);
  const { cheerKey } = look;

  return (
    <Physics gravity={[0, -25, 0]} timeStep="vary">
      {area.id === "records" ? (
        <group userData={{ perfGroup: "records" }}>
          <RecordsHallRoom />
        </group>
      ) : area.id === "weather" ? (
        <group userData={{ perfGroup: "weather" }}>
          <WeatherTowerRoom pos={pos} />
        </group>
      ) : area.id === "mint" ? (
        <group userData={{ perfGroup: "mint" }}>
          <MintRoom mint={look.mint} />
        </group>
      ) : area.id === "townhall" ? (
        <group userData={{ perfGroup: "hall" }}>
          <TownHallRoom />
        </group>
      ) : area.id === "siege" ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "siege" }}>
            <SiegeField tools={look.fieldTools} onPresets={onFieldPresets} />
          </group>
        </>
      ) : area.id === "quarter" ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "quarter" }}>
            <MarketQuarter quarter={look.quarter} lit={look.litStalls} />
          </group>
        </>
      ) : area.id === "holding" && room ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "holding" }}>
            <HoldingLand ticker={room.ticker} gap={room.gap} gate={room.gate} radius={room.radius} shelves={room.shelves} pos={pos} lanterns={room.lanterns} centre={room.centre} price={room.price} />
          </group>
        </>
      ) : (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "horizon" }}>
            <Horizon />
            <Countryside />
            <MeadowPlants />
          </group>
          <group userData={{ perfGroup: "courtyard" }}>
            <Courtyard world={world} />
            <Village />
            {PROPS.map((p) => (
              <PropMesh key={p.id} prop={p} />
            ))}
          </group>
          <group userData={{ perfGroup: "marks" }}>
            <Suspense fallback={null}>
              <MarkLayer placed={look.marks} />
            </Suspense>
          </group>
          <group userData={{ perfGroup: "scenery" }}>
            <Scenery />
          </group>
          <group userData={{ perfGroup: "market" }}>
            <Market />
            <Booths />
          </group>
          <group userData={{ perfGroup: "torches" }}>
            <StandingTorches level={look.standingLevel} />
          </group>
          <group userData={{ perfGroup: "desk" }}>
            <Desk books={look.books} />
          </group>
          <group userData={{ perfGroup: "vault" }}>
            <Vault level={look.vaultLevel} />
          </group>
          <group userData={{ perfGroup: "watch" }}>
            <WatchPost status={look.watchStatus} notices={look.noticeSheets} />
          </group>
          <group userData={{ perfGroup: "hourglass" }}>
            <HourglassPost />
          </group>
          <group userData={{ perfGroup: "ravens" }}>
            <RavenBirds count={look.unseenRavens} />
          </group>
          <group userData={{ perfGroup: "realm" }}>
            <RealmPost level={look.realmLevel} siege={look.siegeLevel} />
          </group>
          <group userData={{ perfGroup: "drill" }}>
            <DrillPost />
            {look.drillOpen && <DrillCamp />}
            <SiegeGate />
            <QuarterArch counts={look.archCounts} lit={look.archLit} />
          </group>
          <group userData={{ perfGroup: "signpost" }}>
            <Signpost />
          </group>
          <group userData={{ perfGroup: "weather" }}>
            <Weather level={look.siegeLevel} />
          </group>
          <group userData={{ perfGroup: "people" }}>
            <Advisors pos={pos} talking={look.talking} cheerKey={cheerKey} />
            <Townsfolk cheerKey={cheerKey} />
            <Workers />
          </group>
          <QuestMarks marks={look.questMarks} />
          <Confetti burstKey={cheerKey} />
        </>
      )}
      <SpotWatch pos={pos} area={area} world={spotWorld} />
      <group userData={{ perfGroup: "hero" }}>
        <Player keys={keys} orbit={orbit} pos={pos} teleport={teleport} cheerKey={cheerKey} hold={hold} room={cameraRoomOf(area.id)} />
      </group>
    </Physics>
  );
}

/**
 * The 3D courtyard canvas. Lighting is deliberately flat and the same
 * everywhere: no spotlight on a "good" tower, nothing that flatters a weak one.
 */
export default function Scene({ world, onLockChange, onStats, statsDetail = false, area = COURTYARD, room = null, hold = false, look = EMPTY_LOOK, onFieldPresets = noop }: Props) {
  const inside = AREAS[area.id].lighting === "indoor";
  // The weather: only the sky and fog colour change (calm keeps the courtyard's own sky); lights stay as they are.
  const wx = weatherLook(look.siegeLevel);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 60, near: 0.1, far: 500, position: [0, 6, 44] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      tabIndex={0}
      aria-label="3D courtyard. Walk with W A S D, look with the mouse."
    >
      {inside ? (
        <Fragment key="in">
          {/* Indoors: warm and dim, the same everywhere; no shelf is lit more kindly than another. */}
          <color attach="background" args={[HALL_DARK]} />
          <fog attach="fog" args={[HALL_DARK, 28, 70]} />
          <hemisphereLight args={["#ffe9c8", "#5a4430", 1.15]} />
          <directionalLight
            position={[4, 16, 8]}
            intensity={0.9}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-16}
            shadow-camera-right={16}
            shadow-camera-top={16}
            shadow-camera-bottom={-16}
            shadow-camera-near={1}
            shadow-camera-far={50}
            shadow-bias={-0.0005}
          />
        </Fragment>
      ) : (
        <Fragment key="out">
          <color attach="background" args={[wx.sky]} />
          <SkyDome look={wx} />
          <fog attach="fog" args={[wx.sky, wx.fogNear, wx.fogFar]} />
          <hemisphereLight args={["#ffffff", "#9aa88a", 0.9]} />
          <directionalLight
            position={[60, 100, 45]}
            intensity={1.3}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
            shadow-camera-near={1}
            shadow-camera-far={300}
            shadow-bias={-0.0005}
          />
        </Fragment>
      )}
      <Suspense fallback={null}>
        <World world={world} onLockChange={onLockChange} area={area} room={room} hold={hold} look={look} onFieldPresets={onFieldPresets} />
      </Suspense>
      <PerfProbe onStats={onStats} detail={statsDetail} />
    </Canvas>
  );
}
