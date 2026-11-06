import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { LEAVE_RANGE, NPCS, TALK_RANGE } from "./npcs";
import type { NpcId } from "./npcs";
import NpcMesh from "./NpcMesh";
import PropMesh from "./PropMesh";
import Scenery from "./Scenery";
import Market from "./Market";
import MarketStreet from "./MarketStreet";
import Booths from "./Booths";
import { BOOTHS, BOOTH_LEAVE_RANGE, BOOTH_RANGE } from "./boothPlan";
import type { BoothId } from "./boothPlan";
import type { Stall } from "./streetPlan";
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
import { VAULT, VAULT_LEAVE_RANGE, VAULT_RANGE } from "./vaultPlan";
import type { FortressSiegeLevel, FortressVaultLevel, NightWatchStatus } from "../lib/types";
import WatchPost from "./WatchPost";
import RavenBirds from "./RavenBirds";
import RealmPost from "./RealmPost";
import Weather from "./Weather";
import SkyDome from "./SkyDome";
import { REALM_LEAVE_RANGE, REALM_POST, REALM_RANGE } from "./realmPlan";
import { weatherLook } from "./weatherPlan";
import type { RealmLevel } from "../lib/realmVerdict";
import { PERCH, PERCH_LEAVE_RANGE, PERCH_RANGE, WATCH_LEAVE_RANGE, WATCH_POST, WATCH_RANGE } from "./watchPlan";
import DrillCamp from "./DrillCamp";
import DrillPost from "./DrillPost";
import SiegeField from "./SiegeField";
import { DEFAULT_TOOLS } from "./siegeFieldTools";
import type { FieldSpotId, FieldTools } from "./siegeFieldTools";
import SiegeGate from "./SiegeGate";
import MarketQuarter from "./MarketQuarter";
import QuarterArch from "./QuarterArch";
import { QUARTER_EXIT, QUARTER_EXIT_LEAVE_RANGE, QUARTER_EXIT_RANGE, QUARTER_GATE, QUARTER_GATE_LEAVE_RANGE, QUARTER_GATE_RANGE } from "./quarterPlan";
import type { Quarter } from "./quarterPlan";
import { SIEGE_GATE, SIEGE_GATE_LEAVE_RANGE, SIEGE_GATE_RANGE } from "./siegeField";
import Signpost from "./Signpost";
import { SIGN, SIGN_LEAVE_RANGE, SIGN_RANGE } from "./signpost";
import { STALL_LEAVE_RANGE, STALL_RANGE } from "./stallDoor";
import { DRILL_LEAVE_RANGE, DRILL_POST, DRILL_RANGE } from "./stormDrill";
import { DESK, DESK_LEAVE_RANGE, DESK_RANGE } from "./desk";
import { PROPS } from "./props";
import HoldingLand from "./HoldingLand";
import type { GateStone, Lantern, PricePost } from "./holdingLand";
import type { LandCentreSlot } from "./landCentre";
import type { SurveyCheckId } from "../lib/survey";
import Town from "./Town";
import TownHallRoom from "./TownHallRoom";
import RecordsHallRoom from "./RecordsHallRoom";
import type { BoardId } from "./townHallRoom";
import { GATE_LEAVE_RANGE, GATE_RANGE, GATE_SPOT } from "./townPlan";
import type { BuildingId } from "./townPlan";
import { AREAS, COURTYARD, sameArea, transitionSpot } from "./areas";
import type { AreaRef } from "./areas";
import { pickNear } from "./near";
import type { NearTarget } from "./near";
import type { Shelf, ShelfId } from "./libraryShelves";
import { ENTER_LEAVE_REACH, ENTER_REACH, enterableOf } from "./towerDoor";

const HALL_DARK = "#1d1712";
const noop = () => {};

interface Props {
  world: WorldModel;
  onLockChange: (locked: boolean) => void;
  onStats: (s: PerfStats) => void;
  /** Per-group draw-call walk for the stats overlay; off unless the overlay is open. */
  statsDetail?: boolean;
  /** Who is close enough to talk to (null: nobody). Called only when it changes. */
  onNear: (id: NpcId | null) => void;
  near: NpcId | null;
  /** Books on the writing desk's shelf: holdings with a reason and a wrong-if line. */
  books?: number;
  /** Tells the page when the hero is at the writing desk. Called only when it changes. */
  onNearDesk?: (near: boolean) => void;
  /** Tells the page when the hero is at the drill post. */
  onNearDrill?: (near: boolean) => void;
  /** Tells the page when the hero is at the signpost by the gate. */
  onNearSign?: (near: boolean) => void;
  /** Which stall is within reach (a holding id), or null. Called only when it changes. */
  onNearStall?: (holdingId: string | null) => void;
  /** Which stand (Sal or the Hype Booth) is within reach, or null. Called only when it changes. */
  onNearBooth?: (id: BoothId | null) => void;
  /** The backend's vault level (decides the coin stacks on the chest), or null when it cannot be read. */
  vaultLevel?: FortressVaultLevel | null;
  /** Whether the vault chest is within reach. Called only when it changes. */
  onNearVault?: (near: boolean) => void;
  /** The backend's Night Watch status (decides the lantern), or null when the dispatch cannot be read. */
  watchStatus?: NightWatchStatus | null;
  /** Whether the Night Watch post is within reach. Called only when it changes. */
  onNearWatch?: (near: boolean) => void;
  /** Ravens not yet marked seen: one bird each on the perch, none when there are none. */
  unseenRavens?: number;
  /** Whether the raven perch is within reach. Called only when it changes. */
  onNearPerch?: (near: boolean) => void;
  /** The verdict on the whole fortress (worked out by summarizeRealm), or null when the fortress cannot be read. Decides the pennant. */
  realmLevel?: RealmLevel | null;
  /** The backend's siege level: the weather. Decides the sky, the clouds and the weather plate. Null when it cannot be read (mist). */
  siegeLevel?: FortressSiegeLevel | null;
  /** Whether the Realm post is within reach. Called only when it changes. */
  onNearRealm?: (near: boolean) => void;
  /** Market Street: one stall per watchlist company, already worked out (marketStreet.ts). */
  stalls?: readonly Stall[];
  /** A Storm Drill is open: the camp stands. */
  drillOpen?: boolean;
  /** Whose dialogue is open (the Oracle casts while he talks). */
  talking?: NpcId | null;
  /** A new number starts the quest-done cheer and confetti, once. */
  cheerKey?: number | null;
  /** A move between places is under way (S22): the hero stands still. */
  hold?: boolean;
  /** The Standing level (0 to 4); null when it could not be read. One Standing torch burns per level. */
  standingLevel?: number | null;
  /** Called only when it changes: which tower's door you stand at (null: none). */
  onNearTower?: (id: string | null) => void;
  /** Which place the hero is in. Only that place is drawn. */
  area?: AreaRef;
  /** The tower library's contents, when `area` is a library. */
  room?: RoomView | null;
  onNearShelf?: (id: ShelfId | null) => void;
  onNearLandGate?: (near: boolean) => void;
  onNearTable?: (near: boolean) => void;
  onNearLantern?: (check: SurveyCheckId | null) => void;
  /** Courtyard: the hero stands at the gate road. */
  onNearGate?: (near: boolean) => void;
  /** Town: which building's door the hero stands at, and whether the road back is in reach. */
  townNear?: BuildingId | null;
  onNearBuilding?: (id: BuildingId | null) => void;
  onNearTownExit?: (near: boolean) => void;
  /** Inside the Town Hall: which board you stand at, and whether the door is in reach. */
  onNearBoard?: (id: BoardId | null) => void;
  onNearHallDoor?: (near: boolean) => void;
  /** Inside the Hall of Records: whether you stand at the shelves, and whether the door is in reach. */
  onNearShelves?: (near: boolean) => void;
  onNearArchiveDoor?: (near: boolean) => void;
  /** Courtyard: the hero stands at the gate to the Siege Field. */
  onNearSiegeGate?: (near: boolean) => void;
  /** Siege Field: the road back is in reach. */
  onNearFieldExit?: (near: boolean) => void;
  /** Siege Field: the winch, a marker stone or a yardstick banner in reach, and the fall and yardstick they steer. */
  onNearFieldSpot?: (id: FieldSpotId | null) => void;
  fieldTools?: FieldTools;
  onFieldPresets?: (p: { toStorm: number | null; toSiege: number | null; min: number; max: number }) => void;
  /** Market Quarter: one stall per watchlist company, laid out up the lane (quarterPlan.ts). */
  quarter?: Quarter;
  /** The arch's count line: how many stalls, how many in range. Null while the watchlist is unread. */
  archCounts?: { total: number; inRange: number } | null;
  /** Courtyard: the hero stands at the arch to the Market Quarter. */
  onNearQuarterGate?: (near: boolean) => void;
  /** Market Quarter: the road back is in reach. */
  onNearQuarterExit?: (near: boolean) => void;
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

/** A stable empty list, so a missing watchlist never re-renders the street. */
const NO_STALLS: readonly Stall[] = [];

/**
 * Tells the page when the hero walks up to, or away from, one of `targets`. The one watcher behind every
 * courtyard "near" (it replaced twelve copies). Only calls `onChange` when the answer changes.
 */
function NearWatch<K>({
  pos,
  targets,
  onChange,
}: {
  pos: { current: { x: number; z: number } };
  targets: readonly NearTarget<K>[];
  onChange: (id: K | null) => void;
}) {
  const last = useRef<K | null>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);
  useFrame(() => {
    if (targets.length === 0 && last.current === null) return;
    const now = pickNear(pos.current, targets, last.current);
    if (now !== last.current) {
      last.current = now;
      cb.current(now);
    }
  });
  return null;
}

/** One fixed spot as a target list (the "near or not" spots). */
const spotTarget = (p: { x: number; z: number }, range: number, leaveRange: number): readonly NearTarget<true>[] => [
  { id: true, x: p.x, z: p.z, range, leaveRange },
];
const DESK_T = spotTarget(DESK, DESK_RANGE, DESK_LEAVE_RANGE);
const DRILL_T = spotTarget(DRILL_POST, DRILL_RANGE, DRILL_LEAVE_RANGE);
const SIGN_T = spotTarget(SIGN, SIGN_RANGE, SIGN_LEAVE_RANGE);
const SIEGE_GATE_T = spotTarget(SIEGE_GATE, SIEGE_GATE_RANGE, SIEGE_GATE_LEAVE_RANGE);
const QUARTER_GATE_T = spotTarget(QUARTER_GATE, QUARTER_GATE_RANGE, QUARTER_GATE_LEAVE_RANGE);
const QUARTER_EXIT_T = spotTarget(QUARTER_EXIT, QUARTER_EXIT_RANGE, QUARTER_EXIT_LEAVE_RANGE);
const NO_QUARTER: Quarter = { stalls: [], overflow: [], fogZ: null, total: 0, inRange: 0 };
const GATE_T = spotTarget(GATE_SPOT, GATE_RANGE, GATE_LEAVE_RANGE);
const VAULT_T = spotTarget(VAULT, VAULT_RANGE, VAULT_LEAVE_RANGE);
const REALM_T = spotTarget(REALM_POST, REALM_RANGE, REALM_LEAVE_RANGE);
const WATCH_T = spotTarget(WATCH_POST, WATCH_RANGE, WATCH_LEAVE_RANGE);
const PERCH_T = spotTarget(PERCH, PERCH_RANGE, PERCH_LEAVE_RANGE);
const NPC_T: readonly NearTarget<NpcId>[] = NPCS.map((n) => ({ id: n.id, x: n.x, z: n.z, range: TALK_RANGE, leaveRange: LEAVE_RANGE }));
const BOOTH_T: readonly NearTarget<BoothId>[] = BOOTHS.map((b) => ({ id: b.id, x: b.x, z: b.z, range: BOOTH_RANGE, leaveRange: BOOTH_LEAVE_RANGE }));

function World({
  onLockChange,
  world,
  onNear,
  near,
  talking,
  cheerKey,
  hold,
  standingLevel,
  books,
  onNearDesk,
  onNearDrill,
  onNearSign,
  onNearStall,
  onNearBooth,
  vaultLevel,
  onNearVault,
  watchStatus,
  onNearWatch,
  unseenRavens,
  onNearPerch,
  realmLevel,
  siegeLevel,
  onNearRealm,
  drillOpen,
  stalls,
  onNearTower,
  area,
  room,
  onNearShelf,
  onNearLandGate,
  onNearTable,
  onNearLantern,
  onNearGate,
  townNear,
  onNearBuilding,
  onNearTownExit,
  onNearBoard,
  onNearHallDoor,
  onNearShelves,
  onNearArchiveDoor,
  onNearSiegeGate,
  onNearFieldExit,
  onNearFieldSpot,
  fieldTools,
  onFieldPresets,
  quarter,
  archCounts,
  onNearQuarterGate,
  onNearQuarterExit,
}: {
  onLockChange: (locked: boolean) => void;
  world: WorldModel;
  onNear: (id: NpcId | null) => void;
  near: NpcId | null;
  books: number;
  onNearDesk: (near: boolean) => void;
  onNearDrill: (near: boolean) => void;
  onNearSign: (near: boolean) => void;
  onNearStall: (holdingId: string | null) => void;
  onNearBooth: (id: BoothId | null) => void;
  vaultLevel: FortressVaultLevel | null;
  onNearVault: (near: boolean) => void;
  watchStatus: NightWatchStatus | null;
  onNearWatch: (near: boolean) => void;
  unseenRavens: number;
  onNearPerch: (near: boolean) => void;
  realmLevel: RealmLevel | null;
  siegeLevel: FortressSiegeLevel | null;
  onNearRealm: (near: boolean) => void;
  drillOpen: boolean;
  stalls: readonly Stall[];
  talking: NpcId | null;
  cheerKey: number | null;
  hold: boolean;
  standingLevel: number | null;
  onNearTower: (id: string | null) => void;
  area: AreaRef;
  room: RoomView | null;
  onNearShelf: (id: ShelfId | null) => void;
  onNearLandGate: (near: boolean) => void;
  onNearTable: (near: boolean) => void;
  onNearLantern: (check: SurveyCheckId | null) => void;
  onNearGate: (near: boolean) => void;
  townNear: BuildingId | null;
  onNearBuilding: (id: BuildingId | null) => void;
  onNearTownExit: (near: boolean) => void;
  onNearBoard: (id: BoardId | null) => void;
  onNearHallDoor: (near: boolean) => void;
  onNearShelves: (near: boolean) => void;
  onNearArchiveDoor: (near: boolean) => void;
  onNearSiegeGate: (near: boolean) => void;
  onNearFieldExit: (near: boolean) => void;
  onNearFieldSpot: (id: FieldSpotId | null) => void;
  fieldTools: FieldTools;
  onFieldPresets: (p: { toStorm: number | null; toSiege: number | null; min: number; max: number }) => void;
  quarter: Quarter;
  archCounts: { total: number; inRange: number } | null;
  onNearQuarterGate: (near: boolean) => void;
  onNearQuarterExit: (near: boolean) => void;
}) {
  const keys = useKeys();
  const pos = useRef({ x: 0, z: 0 });
  const orbit = useOrbit(onLockChange);

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

  const stallTargets = useMemo<readonly NearTarget<string>[]>(
    () => stalls.map((s) => ({ id: s.holdingId, x: s.x, z: s.z, range: STALL_RANGE, leaveRange: STALL_LEAVE_RANGE })),
    [stalls],
  );
  const quarterStallTargets = useMemo<readonly NearTarget<string>[]>(
    () => quarter.stalls.map((s) => ({ id: s.holdingId, x: s.x, z: s.z, range: STALL_RANGE, leaveRange: STALL_LEAVE_RANGE })),
    [quarter],
  );
  // A tower's reach is counted from its wall, not its middle: fat towers are not easier to enter.
  const towerTargets = useMemo<readonly NearTarget<string>[]>(
    () =>
      world.towers.map((t) => ({
        id: t.holdingId,
        x: t.spot.x,
        z: t.spot.z,
        range: ENTER_REACH + (t.plot?.footprint ?? t.radius),
        leaveRange: ENTER_LEAVE_REACH + (t.plot?.footprint ?? t.radius),
      })),
    [world.towers],
  );
  const isYes = (f: (v: boolean) => void) => (id: true | null) => f(id !== null);

  return (
    <Physics gravity={[0, -25, 0]} timeStep="vary">
      {area.id === "records" ? (
        <group userData={{ perfGroup: "records" }}>
          <RecordsHallRoom pos={pos} onShelves={onNearShelves} onDoor={onNearArchiveDoor} />
        </group>
      ) : area.id === "townhall" ? (
        <group userData={{ perfGroup: "hall" }}>
          <TownHallRoom pos={pos} onBoard={onNearBoard} onDoor={onNearHallDoor} />
        </group>
      ) : area.id === "siege" ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "siege" }}>
            <SiegeField pos={pos} onNearExit={onNearFieldExit} onNearSpot={onNearFieldSpot} tools={fieldTools} onPresets={onFieldPresets} />
          </group>
        </>
      ) : area.id === "quarter" ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "quarter" }}>
            <MarketQuarter quarter={quarter} />
          </group>
          <NearWatch pos={pos} targets={quarterStallTargets} onChange={onNearStall} />
          <NearWatch pos={pos} targets={QUARTER_EXIT_T} onChange={isYes(onNearQuarterExit)} />
        </>
      ) : area.id === "town" ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "town" }}><Town pos={pos} near={townNear} onNearBuilding={onNearBuilding} onNearExit={onNearTownExit} /></group>
        </>
      ) : area.id === "holding" && room ? (
        <>
          <group userData={{ perfGroup: "backdrop" }}>
            <Backdrop />
          </group>
          <group userData={{ perfGroup: "holding" }}>
            <HoldingLand ticker={room.ticker} gap={room.gap} gate={room.gate} radius={room.radius} shelves={room.shelves} pos={pos} onShelf={onNearShelf} onGate={onNearLandGate} onTable={onNearTable} lanterns={room.lanterns} onLantern={onNearLantern} centre={room.centre} price={room.price} />
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
            {PROPS.map((p) => (
              <PropMesh key={p.id} prop={p} />
            ))}
          </group>
          <group userData={{ perfGroup: "scenery" }}>
            <Scenery />
          </group>
          <group userData={{ perfGroup: "market" }}>
            <Market />
            <MarketStreet stalls={stalls} />
            <Booths />
          </group>
          <group userData={{ perfGroup: "torches" }}>
            <StandingTorches level={standingLevel} />
          </group>
          <group userData={{ perfGroup: "desk" }}>
            <Desk books={books} />
          </group>
          <group userData={{ perfGroup: "vault" }}>
            <Vault level={vaultLevel} />
          </group>
          <group userData={{ perfGroup: "watch" }}>
            <WatchPost status={watchStatus} />
          </group>
          <group userData={{ perfGroup: "ravens" }}>
            <RavenBirds count={unseenRavens} />
          </group>
          <group userData={{ perfGroup: "realm" }}>
            <RealmPost level={realmLevel} siege={siegeLevel} />
          </group>
          <group userData={{ perfGroup: "drill" }}>
            <DrillPost />
            {drillOpen && <DrillCamp />}
            <SiegeGate />
            <QuarterArch counts={archCounts} />
          </group>
          <group userData={{ perfGroup: "signpost" }}>
            <Signpost />
          </group>
          <group userData={{ perfGroup: "weather" }}>
            <Weather level={siegeLevel} />
          </group>
          <group userData={{ perfGroup: "people" }}>
            {NPCS.map((n) => (
              <NpcMesh key={n.id} npc={n} active={near === n.id} playerPos={pos} talking={talking === n.id} cheerKey={cheerKey} />
            ))}
            <Townsfolk cheerKey={cheerKey} />
            <Workers />
          </group>
          <Confetti burstKey={cheerKey} />
          <NearWatch pos={pos} targets={NPC_T} onChange={onNear} />
          <NearWatch pos={pos} targets={DESK_T} onChange={isYes(onNearDesk)} />
          <NearWatch pos={pos} targets={DRILL_T} onChange={isYes(onNearDrill)} />
          <NearWatch pos={pos} targets={SIEGE_GATE_T} onChange={isYes(onNearSiegeGate)} />
          <NearWatch pos={pos} targets={QUARTER_GATE_T} onChange={isYes(onNearQuarterGate)} />
          <NearWatch pos={pos} targets={SIGN_T} onChange={isYes(onNearSign)} />
          <NearWatch pos={pos} targets={GATE_T} onChange={isYes(onNearGate)} />
          <NearWatch pos={pos} targets={stallTargets} onChange={onNearStall} />
          <NearWatch pos={pos} targets={BOOTH_T} onChange={onNearBooth} />
          <NearWatch pos={pos} targets={VAULT_T} onChange={isYes(onNearVault)} />
          <NearWatch pos={pos} targets={WATCH_T} onChange={isYes(onNearWatch)} />
          <NearWatch pos={pos} targets={PERCH_T} onChange={isYes(onNearPerch)} />
          <NearWatch pos={pos} targets={REALM_T} onChange={isYes(onNearRealm)} />
          <NearWatch pos={pos} targets={towerTargets} onChange={onNearTower} />
        </>
      )}
      <group userData={{ perfGroup: "hero" }}>
        <Player keys={keys} orbit={orbit} pos={pos} teleport={teleport} cheerKey={cheerKey} hold={hold} />
      </group>
    </Physics>
  );
}

/**
 * The 3D courtyard canvas. Lighting is deliberately flat and the same
 * everywhere: no spotlight on a "good" tower, nothing that flatters a weak one.
 */
export default function Scene({
  world,
  onLockChange,
  onStats,
  statsDetail = false,
  onNear,
  near,
  books = 0,
  onNearDesk = noop,
  onNearDrill = noop,
  onNearSign = noop,
  onNearStall = noop,
  onNearBooth = noop,
  vaultLevel = null,
  onNearVault = noop,
  watchStatus = null,
  onNearWatch = noop,
  unseenRavens = 0,
  onNearPerch = noop,
  realmLevel = null,
  siegeLevel = null,
  onNearRealm = noop,
  drillOpen = false,
  stalls = NO_STALLS,
  talking = null,
  cheerKey = null,
  hold = false,
  standingLevel = null,
  onNearTower = noop,
  area = COURTYARD,
  room = null,
  onNearShelf = noop,
  onNearLandGate = noop,
  onNearTable = noop,
  onNearLantern = noop,
  onNearGate = noop,
  townNear = null,
  onNearBuilding = noop,
  onNearTownExit = noop,
  onNearBoard = noop,
  onNearHallDoor = noop,
  onNearShelves = noop,
  onNearArchiveDoor = noop,
  onNearSiegeGate = noop,
  onNearFieldExit = noop,
  onNearFieldSpot = noop,
  fieldTools = DEFAULT_TOOLS("local"),
  onFieldPresets = noop,
  quarter = NO_QUARTER,
  archCounts = null,
  onNearQuarterGate = noop,
  onNearQuarterExit = noop,
}: Props) {
  const inside = AREAS[area.id].lighting === "indoor";
  // The weather: only the sky and fog colour change (calm keeps the courtyard's own sky); lights stay as they are.
  const wx = weatherLook(siegeLevel);
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
        <World
          onLockChange={onLockChange}
          world={world}
          onNear={onNear}
          near={near}
          books={books}
          onNearDesk={onNearDesk}
          onNearDrill={onNearDrill}
          onNearSign={onNearSign}
          onNearStall={onNearStall}
          onNearBooth={onNearBooth}
          vaultLevel={vaultLevel}
          onNearVault={onNearVault}
          watchStatus={watchStatus}
          onNearWatch={onNearWatch}
          unseenRavens={unseenRavens}
          onNearPerch={onNearPerch}
          realmLevel={realmLevel}
          siegeLevel={siegeLevel}
          onNearRealm={onNearRealm}
          drillOpen={drillOpen}
          stalls={stalls}
          talking={talking}
          cheerKey={cheerKey}
          hold={hold}
          standingLevel={standingLevel}
          onNearTower={onNearTower}
          area={area}
          room={room}
          onNearShelf={onNearShelf}
          onNearLandGate={onNearLandGate}
          onNearTable={onNearTable}
          onNearLantern={onNearLantern}
          onNearGate={onNearGate}
          townNear={townNear}
          onNearBuilding={onNearBuilding}
          onNearTownExit={onNearTownExit}
          onNearBoard={onNearBoard}
          onNearHallDoor={onNearHallDoor}
          onNearShelves={onNearShelves}
          onNearArchiveDoor={onNearArchiveDoor}
          onNearSiegeGate={onNearSiegeGate}
          onNearFieldExit={onNearFieldExit}
          onNearFieldSpot={onNearFieldSpot}
          fieldTools={fieldTools}
          onFieldPresets={onFieldPresets}
          quarter={quarter}
          archCounts={archCounts}
          onNearQuarterGate={onNearQuarterGate}
          onNearQuarterExit={onNearQuarterExit}
        />
      </Suspense>
      <PerfProbe onStats={onStats} detail={statsDetail} />
    </Canvas>
  );
}
