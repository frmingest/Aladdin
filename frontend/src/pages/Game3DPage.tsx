import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import type { DocumentSummary, GameState, HoldingAdvisors, Watchlist, Journal, JournalEntryInput, NightWatch, Ravens, Standing, StormDrillInput, StormDrills } from "../lib/types";
import { loadSeen, markSeen, saveSeen, splitRavens } from "../lib/ravens";
import { DocumentReader } from "../components/DocumentReader";
import { latestReport, markReportOpened } from "../game3d/libraryReport";
import SceneBoundary from "../game3d/SceneBoundary";
import TowerPanel from "../game3d/TowerPanel";
import QuestLog from "../game3d/QuestLog";
import DialoguePanel from "../game3d/DialoguePanel";
import DeskPanel from "../game3d/DeskPanel";
import JournalBooksPanel from "../game3d/JournalBooksPanel";
import VaultPanel from "../game3d/VaultPanel";
import { VAULT_PROMPT } from "../game3d/vaultWordsV1";
import WatchPanel from "../game3d/WatchPanel";
import RavensPanel from "../game3d/RavensPanel";
import RealmPanel from "../game3d/RealmPanel";
import { REALM_PROMPT } from "../game3d/realmWordsV1";
import MagicLamp from "../components/fortress/MagicLamp";
import { summarizeRealm } from "../lib/realmVerdict";
import { PERCH_PROMPT, WATCH_PROMPT } from "../game3d/watchWordsV1";
import DrillPanel from "../game3d/DrillPanel";
import WhereToPanel from "../game3d/WhereToPanel";
import WorldPanel from "../game3d/WorldPanel";
import { REGISTER } from "../game3d/parity3d";
import type { Door } from "../game3d/parity3d";
import { RECORDS_ROUTE, archiveDoorPrompt, shelfPrompt } from "../game3d/recordsHallRoom";
import { PLAIN_VIEW, PLAIN_VIEW_TITLE, SIGN_PROMPT } from "../game3d/worldWordsV1";
import { drillBlock, stormDrillQuest } from "../game3d/stormDrill";
import { DRILL_PROMPT } from "../game3d/stormDrillWordsV1";
import ShelfPanel from "../game3d/ShelfPanel";
import { shelvesFor } from "../game3d/libraryShelves";
import type { CouncilInput, ShelfId } from "../game3d/libraryShelves";
import type { RoomView } from "../game3d/Scene";
import { COURTYARD } from "../game3d/areas";
import type { AreaRef } from "../game3d/areas";
import AreaFade from "../game3d/AreaFade";
import { INITIAL_AREA, areaReducer, isMoving } from "../game3d/areaMachine";
import type { AreaAction, AreaState } from "../game3d/areaMachine";
import { AREA_STUCK, areaLine, areaName } from "../game3d/areaWordsV1";
import { prefersReducedMotion } from "../game3d/motionPref";
import { standingAt } from "../game3d/near";
import type { Nears } from "../game3d/near";
import { deskBlock } from "../game3d/deskForm";
import PerfBreakdown from "../game3d/PerfBreakdown";
import Toolbar from "../game3d/Toolbar";
import { typingInField } from "../game3d/useKeys";
import { stallPrompt, storeDoor } from "../game3d/stallDoor";
import { BUILDINGS, buildingPrompt, doorAction, exitPrompt, gatePrompt } from "../game3d/townPlan";
import type { BuildingId } from "../game3d/townPlan";
import { boardById, doorsOfBoard, hallDoorPrompt, hallPrompt } from "../game3d/townHallRoom";
import type { BoardId } from "../game3d/townHallRoom";
import type { PlaceId } from "../game3d/parity3d";
import { boothPrompt } from "../game3d/boothPlan";
import type { BoothId } from "../game3d/boothPlan";
import SalesRepDialog from "../components/marketplace/SalesRepDialog";
import HypeBoothDialog from "../components/marketplace/HypeBoothDialog";
import { useDemoMode } from "../lib/demoMode";
import { PANEL_KEYS, loadPanels, savePanels, togglePanel } from "../game3d/hudPanels";
import type { PanelId } from "../game3d/hudPanels";
import { celebrationDue } from "../game3d/celebrate";
import { sixMonthReckoning } from "../game3d/quest";
import { unwrittenThesisV2 } from "../game3d/questV2";
import type { NpcId } from "../game3d/npcs";
import { buildStreet, streetOverflowLine } from "../game3d/streetPlan";
import { stateToWorld } from "../game3d/stateToWorld";
import { withGaps } from "../game3d/standingGaps";
import { wordsFor } from "../game3d/standingWordsV3";
import { webglSupported } from "../game3d/webgl";
import type { PerfStats } from "../game3d/PerfProbe";

// The 3D engine and the physics are heavy, so they only download on this page.
const Scene = lazy(() => import("../game3d/Scene"));

function Unavailable() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold text-ink">The 3D courtyard can't open here</h1>
      <p className="mt-2 text-sm text-ink-muted">
        This browser can't draw 3D right now. Your fortress is still there in the flat view, same facts.
      </p>
      <Link
        to="/fortress"
        className="mt-4 inline-block rounded border border-border bg-surface px-4 py-2 text-sm text-ink hover:opacity-80"
      >
        Open the fortress
      </Link>
    </div>
  );
}

/** A move is a cut, not a fade, for people who asked their system for less motion (S22). An explicit `instant` wins. */
function areaReducerWithMotion(state: AreaState, action: AreaAction): AreaState {
  if (action.type === "enter" || action.type === "leave") return areaReducer(state, { ...action, instant: action.instant ?? prefersReducedMotion() });
  return areaReducer(state, action);
}

/**
 * 3D courtyard (prototype, week 4): a walled courtyard you can walk round with
 * W A S D and the mouse. Each holding from /game/state stands on a pad as a
 * tower; the facts are in the side panel. Barren Wuffet and Marlie Chunger stand in the
 * courtyard (press E near them); the two quests are read from the decision journal. The flat Fortress stays the
 * full-fidelity view and the fallback.
 */
export default function Game3DPage() {
  const supported = useMemo(webglSupported, []);
  const [locked, setLocked] = useState(false);
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [showPerf, setShowPerf] = useState(false);
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  // The Standing is separate too: if it cannot be read, the torches stay unlit and the log says so.
  const [standing, setStanding] = useState<Standing | null>(null);
  const [standingFailed, setStandingFailed] = useState(false);
  const [journalFailed, setJournalFailed] = useState(false);
  const [near, setNear] = useState<NpcId | null>(null);
  const [talking, setTalking] = useState<NpcId | null>(null);
  // The writing desk: whether you stand at it, and whether its panel is open.
  const [atDesk, setAtDesk] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  // The old books (past journal entries), opened from the desk panel.
  const [booksOpen, setBooksOpen] = useState(false);
  // The vault chest east of the keep door: whether you stand at it, and whether its panel (Vault and Temperament) is open.
  const [atVault, setAtVault] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  // The Night Watch post inside the gate and the raven perch east of the fountain: whether you stand at each, and whether its panel is open.
  const [atWatch, setAtWatch] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [atPerch, setAtPerch] = useState(false);
  const [perchOpen, setPerchOpen] = useState(false);
  // The Realm post on the road to the keep (the verdict on the whole fortress), and the Magic Lamp on the writing desk (the Genie).
  const [atRealm, setAtRealm] = useState(false);
  const [realmOpen, setRealmOpen] = useState(false);
  const [lampOpen, setLampOpen] = useState(false);
  // The dispatch (decides the lantern) and the ravens (decide the birds). Each is read on its own: if one cannot be read the
  // lantern stays dark with a "?" and the perch stays bare, and the panel says so.
  const [nightWatch, setNightWatch] = useState<NightWatch | null>(null);
  const [ravens, setRavens] = useState<Ravens | null>(null);
  // "Seen" is the flat page's own per-browser list, so a raven marked here is marked there too.
  const [seenRavens, setSeenRavens] = useState<Set<string>>(() => loadSeen());
  // The signpost by the gate: whether you stand at it, whether the "Where to?" menu is open, and the flat page shown in the world panel.
  const [atSign, setAtSign] = useState(false);
  const [whereOpen, setWhereOpen] = useState(false);
  const [worldPage, setWorldPage] = useState<Door | null>(null);
  // Market Street: which stall (holding id) you stand at.
  const [nearStall, setNearStall] = useState<string | null>(null);
  // Market Street stands: which one you stand at, and which flat-page dialog (Sal or the Hype Booth) is open over the world.
  const [nearBooth, setNearBooth] = useState<BoothId | null>(null);
  const [boothOpen, setBoothOpen] = useState<BoothId | null>(null);
  const { demoMode } = useDemoMode();
  // The Storm Drill: whether you stand at the drill post, whether a drill is open (the camp stands while it is), and the stored drills.
  const [atDrill, setAtDrill] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drills, setDrills] = useState<StormDrills | null>(null);
  const [drillsFailed, setDrillsFailed] = useState(false);
  // Market Street: the watchlist is separate too; if it cannot be read, the street simply has no stalls.
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  // The tower library: which door you stand at, which tower you are inside, and what you stand at in there.
  const [nearTower, setNearTower] = useState<string | null>(null);
  // Which place you are in: one value, not four flags. A tower's library is `library` with the holding's id.
  const [areaState, dispatchArea] = useReducer(areaReducerWithMotion, INITIAL_AREA);
  const room = areaState.current.id === "library" ? areaState.current.holdingId : null;
  // The Town beyond the gate: whether you are in it, and which door or the gate road you stand at.
  const [atGate, setAtGate] = useState(false);
  const [townNear, setTownNear] = useState<BuildingId | null>(null);
  // Inside the Town Hall: whether you are in it, which board you stand at, whether the door is in reach, and which pages the menu is narrowed to.
  const [nearBoard, setNearBoard] = useState<BoardId | null>(null);
  const [atHallDoor, setAtHallDoor] = useState(false);
  // Inside the Hall of Records: whether you are in it, whether you stand at the shelves, and whether the door is in reach.
  const [atShelves, setAtShelves] = useState(false);
  const [atArchiveDoor, setAtArchiveDoor] = useState(false);
  const [onlyRoutes, setOnlyRoutes] = useState<readonly string[] | null>(null);
  const [atTownExit, setAtTownExit] = useState(false);
  const [onlyPlace, setOnlyPlace] = useState<PlaceId | null>(null);
  const [nearShelf, setNearShelf] = useState<ShelfId | null>(null);
  const [atDoor, setAtDoor] = useState(false);
  const [readShelf, setReadShelf] = useState<ShelfId | null>(null);
  // The reading table: whether you stand at it, the report it opened, and a short note when there is none.
  const [atTable, setAtTable] = useState(false);
  const [report, setReport] = useState<DocumentSummary | null>(null);
  const [tableNote, setTableNote] = useState<string | null>(null);
  // The quest-done cheer: a new number starts it, once per page load, never on the sample journal.
  const [cheerKey, setCheerKey] = useState<number | null>(null);
  const cheered = useRef(false);
  // Panels start shut (or as you left them) so the scene is not covered.
  const [panels, setPanels] = useState(loadPanels);
  const flip = useCallback((id: PanelId) => setPanels((p) => togglePanel(p, id)), []);
  useEffect(() => savePanels(panels), [panels]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getGameState()
      .then(setState)
      .catch((e: unknown) => setError(describeError(e, "the fortress").message))
      .finally(() => setLoading(false));
    // The journal is separate: if it fails, the towers still stand and the quest says so.
    setJournalFailed(false);
    api
      .getJournal()
      .then(setJournal)
      .catch(() => setJournalFailed(true));
    setDrillsFailed(false);
    api
      .getStormDrills()
      .then(setDrills)
      .catch(() => setDrillsFailed(true));
    api
      .getWatchlist()
      .then(setWatchlist)
      .catch(() => setWatchlist(null));
    setStandingFailed(false);
    api
      .getStanding()
      .then(setStanding)
      .catch(() => setStandingFailed(true));
    api
      .getNightWatch()
      .then(setNightWatch)
      .catch(() => setNightWatch(null));
    api
      .getRavens()
      .then(setRavens)
      .catch(() => setRavens(null));
  }, []);
  const onRavensSeen = useCallback((ids: string[]) => {
    setSeenRavens((cur) => {
      const next = markSeen(cur, ids);
      saveSeen(next);
      return next;
    });
  }, []);
  // One bird per raven the Ravens card calls "new" (landed in the last 48 hours and not marked seen). Older unseen ravens sit under
  // "Earlier" in the card and never show on the perch, so every bird you see is one you can actually mark seen.
  const unseenRavens = useMemo(() => splitRavens(ravens?.ravens ?? [], seenRavens, ravens?.as_of, "all").recent.length, [ravens, seenRavens]);

  // After a desk entry is saved, read the journal and the Standing again: the shelf and the level are
  // worked out from the facts, never from "I just saved".
  const refreshJournal = useCallback(async () => {
    const [j, st] = await Promise.allSettled([api.getJournal(), api.getStanding()]);
    if (j.status === "fulfilled") {
      setJournal(j.value);
      setJournalFailed(false);
    } else setJournalFailed(true);
    if (st.status === "fulfilled") {
      setStanding(st.value);
      setStandingFailed(false);
    }
  }, []);
  const saveAtDesk = useCallback(async (input: JournalEntryInput) => {
    await api.createJournalEntry(input);
    await refreshJournal();
  }, [refreshJournal]);

  // After a drill is written, read the drills again: the quest is worked out from what is stored.
  const saveDrill = useCallback(async (input: StormDrillInput) => {
    await api.createStormDrill(input);
    try {
      setDrills(await api.getStormDrills());
      setDrillsFailed(false);
    } catch {
      setDrillsFailed(true);
    }
  }, []);

  // Face the wire (Standing 3): mark one fired wire seen, then read the Standing again. The level is
  // worked out from the facts, never from "I just clicked".
  const lookAtWire = useCallback((id: string) => api.acknowledgeTripwire(id), []);
  const refreshStanding = useCallback(
    () => api.getStanding().then((st) => { setStanding(st); setStandingFailed(false); }),
    [],
  );

  useEffect(() => {
    if (supported) load();
  }, [supported, load]);

  // The verdict on the whole fortress, by the flat page's own function. A fortress that could not be read is "unknown", never "sound".
  const realmLevel = useMemo(() => (state ? summarizeRealm(state).level : null), [state]);
  // One stall per watchlist company, in the flat Marketplace's order; no watchlist means no stalls.
  const street = useMemo(() => buildStreet(watchlist?.rows), [watchlist]);
  // Never invent towers: no state means bare pads.
  const world = useMemo(() => stateToWorld(state), [state]);
  // What is drawn and listed: the same world, with the Standing's named gaps labelled on their towers.
  const shownWorld = useMemo(() => withGaps(world, standing?.gaps ?? []), [world, standing]);
  const standingText = useMemo(() => wordsFor(standing, standingFailed), [standing, standingFailed]);
  // The quest is worked out from the journal every render; nothing about it is stored.
  const quest = useMemo(
    () =>
      unwrittenThesisV2(
        world.plain,
        state === null ? null : (journal?.entries ?? null),
        journalFailed || (state === null && error !== null),
      ),
    [world, state, error, journal, journalFailed],
  );
  useEffect(() => {
    if (celebrationDue(quest.status, world.demo, cheered.current)) {
      cheered.current = true;
      setCheerKey(Date.now());
    }
  }, [quest.status, world.demo]);
  // Quest 2 reads the same journal; it needs no holdings, so it does not wait for the towers.
  const drillQuest = useMemo(() => stormDrillQuest(drills, drillsFailed), [drills, drillsFailed]);
  const reviews = useMemo(() => sixMonthReckoning(journal?.entries ?? null, journalFailed), [journal, journalFailed]);


  // The Council's words (the seventh shelf): the advisor lines for the holding whose library you are in. Asked when you
  // walk in; the sample fortress has no advisors to ask. The shelf says "not answered yet" or "could not be reached" until then.
  const [council, setCouncil] = useState<{ holdingId: string; data: HoldingAdvisors | "failed" } | null>(null);
  const isSample = state?.demo === true;
  useEffect(() => {
    if (!room || isSample) return;
    let live = true;
    api
      .getHoldingAdvisors(room)
      .then((d) => live && setCouncil({ holdingId: room, data: d }))
      .catch(() => live && setCouncil({ holdingId: room, data: "failed" }));
    return () => {
      live = false;
    };
  }, [room, isSample]);
  const councilInput: CouncilInput = isSample ? "sample" : council && council.holdingId === room ? council.data : null;

  // The library you are in: the stored row for that holding, turned into seven shelves. Nothing is stored here.
  const roomView = useMemo<RoomView | null>(() => {
    if (!room || !state) return null;
    const tower = state.towers.find((t) => t.holding_id === room);
    const view = shownWorld.plain.find((t) => t.holdingId === room);
    if (!tower || !view) return null;
    return { holdingId: room, name: tower.name, ticker: tower.ticker, gap: view.gap ?? null, shelves: shelvesFor(tower, councilInput) };
  }, [room, state, shownWorld, councilInput]);
  // A fresh load that drops the tower (or the state) puts you back outside rather than in an empty room.
  useEffect(() => {
    if (room && !roomView) dispatchArea({ type: "enter", ref: COURTYARD, instant: true });
  }, [room, roomView]);
  // The place the scene draws: a library whose tower is gone is not a place, so it reads as the courtyard.
  const area: AreaRef = areaState.current.id === "library" && !roomView ? COURTYARD : areaState.current;
  const inTown = area.id === "town";
  const inHall = area.id === "townhall";
  const inRecords = area.id === "records";

  // The place's name in the tab title (S22).
  const placeName = areaName(area, roomView?.name);
  useEffect(() => {
    document.title = `${placeName} · Aladdin`;
  }, [placeName]);

  // A move between places (S22): fade out, arrive in the dark, wait for the floor, fade in. The hero stands still throughout.
  const movePhase = areaState.phase;
  useEffect(() => {
    if (movePhase === "fadingOut" || movePhase === "fadingIn") {
      const t = setTimeout(() => dispatchArea({ type: "fadeDone" }), movePhase === "fadingOut" ? 350 : 450);
      return () => clearTimeout(t);
    }
    if (movePhase === "loading") {
      // The scene moves the hero the moment the place changes; two frames later its floor exists.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => dispatchArea({ type: "ready" }));
      });
      // If it never does, go back to where you were.
      const giveUp = setTimeout(() => dispatchArea({ type: "fail" }), 3000);
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
        clearTimeout(giveUp);
      };
    }
  }, [movePhase]);

  // The name plate: on arrival (after the fade, or straight away with reduced motion), for a couple of seconds.
  const [plate, setPlate] = useState<string | null>(null);
  const plateFor = useRef("");
  useEffect(() => {
    if (!areaState.from || (movePhase !== "fadingIn" && movePhase !== "idle")) return;
    const key = `${areaState.current.id}:${"holdingId" in areaState.current ? areaState.current.holdingId : ""}:${areaState.failed}`;
    if (plateFor.current === key) return;
    plateFor.current = key;
    setPlate(areaState.failed ? AREA_STUCK : areaLine(areaState.current, roomView?.name));
  }, [areaState, movePhase, roomView]);
  useEffect(() => {
    if (!plate) return;
    const t = setTimeout(() => setPlate(null), 2200);
    return () => clearTimeout(t);
  }, [plate]);

  // Opening the menu frees the mouse so the buttons can be clicked; shutting it never leaves a page open.
  const toggleWhere = useCallback(() => {
    setWhereOpen((open) => {
      if (!open && document.pointerLockElement) document.exitPointerLock();
      return !open;
    });
    setWorldPage(null);
    setOnlyPlace(null);
    setOnlyRoutes(null);
  }, []);
  const closeWhere = useCallback(() => {
    setWhereOpen(false);
    setWorldPage(null);
    setOnlyPlace(null);
    setOnlyRoutes(null);
  }, []);
  const pickDoor = useCallback((door: Door) => setWorldPage(door), []);
  // E at a stall: that company's store, in the world panel (the flat store page itself).
  const openStore = useCallback((holdingId: string) => {
    const door = storeDoor(holdingId);
    if (!door) return;
    if (document.pointerLockElement) document.exitPointerLock();
    setWhereOpen(true);
    setWorldPage(door);
  }, []);

  // E at a stand: the flat page's own Sal dialog or Hype Booth dialog, over the world.
  const openBooth = useCallback((id: BoothId) => {
    if (document.pointerLockElement) document.exitPointerLock();
    setBoothOpen(id);
  }, []);
  const closeBooth = useCallback(() => setBoothOpen(null), []);

  // Through the gate and back. The watchers of the other zone are unmounted, so every "near" is cleared on the way.
  const clearNears = useCallback(() => {
    setNear(null);
    setTalking(null);
    setAtDesk(false);
    setAtVault(false);
    setAtWatch(false);
    setAtPerch(false);
    setAtRealm(false);
    setAtDrill(false);
    setAtSign(false);
    setNearStall(null);
    setNearBooth(null);
    setNearTower(null);
    setAtGate(false);
    setTownNear(null);
    setAtTownExit(false);
    setNearBoard(null);
    setAtHallDoor(false);
    setAtShelves(false);
    setAtArchiveDoor(false);
  }, []);
  const enterTown = useCallback(() => {
    clearNears();
    setDeskOpen(false);
    setVaultOpen(false);
    setWatchOpen(false);
    setPerchOpen(false);
    setRealmOpen(false);
    setLampOpen(false);
    setDrillOpen(false);
    dispatchArea({ type: "enter", ref: { id: "town" } });
  }, [clearNears]);
  const leaveTown = useCallback(() => {
    clearNears();
    dispatchArea({ type: "leave" });
  }, [clearNears]);
  // Into the Town Hall and back out to its door. The Town's watchers are unmounted while inside, so the nears are cleared.
  const enterHall = useCallback(() => {
    clearNears();
    dispatchArea({ type: "enter", ref: { id: "townhall" } });
  }, [clearNears]);
  const leaveHall = useCallback(() => {
    clearNears();
    dispatchArea({ type: "leave" });
  }, [clearNears]);
  // Into the Hall of Records and back out to its door; E at the shelves opens the flat Hall of Records page in the world panel.
  const enterRecords = useCallback(() => {
    clearNears();
    dispatchArea({ type: "enter", ref: { id: "records" } });
  }, [clearNears]);
  const leaveRecords = useCallback(() => {
    clearNears();
    dispatchArea({ type: "leave" });
  }, [clearNears]);
  const openShelves = useCallback(() => {
    const row = REGISTER.find((d) => d.route === RECORDS_ROUTE);
    if (!row) return;
    if (document.pointerLockElement) document.exitPointerLock();
    setWhereOpen(true);
    setOnlyPlace(null);
    setOnlyRoutes(null);
    setWorldPage(row);
  }, []);
  // E at a board: one page opens as it is; a pair opens a menu of just those two pages.
  const openBoard = useCallback((id: BoardId) => {
    const board = boardById(id);
    const rows = doorsOfBoard(board);
    if (rows.length === 0) return;
    if (document.pointerLockElement) document.exitPointerLock();
    setWhereOpen(true);
    if (rows.length === 1) {
      setOnlyPlace(null);
      setOnlyRoutes(null);
      setWorldPage(rows[0]);
    } else {
      setWorldPage(null);
      setOnlyPlace("townhall");
      setOnlyRoutes(board.routes);
    }
  }, []);
  // E at a building: its page in the world panel, or (the Workshop) the menu of its place.
  const openBuilding = useCallback((id: BuildingId) => {
    if (id === "townhall") {
      enterHall();
      return;
    }
    if (id === "records") {
      enterRecords();
      return;
    }
    const b = BUILDINGS.find((x) => x.id === id);
    const action = b ? doorAction(b) : null;
    if (!action) return;
    if (document.pointerLockElement) document.exitPointerLock();
    setWhereOpen(true);
    if (action.kind === "page") {
      setOnlyPlace(null);
      setWorldPage(action.door);
    } else {
      setWorldPage(null);
      setOnlyPlace(action.place);
    }
  }, [enterHall, enterRecords]);

  const enterTower = useCallback((id: string) => {
    if (document.pointerLockElement) {
      // Keep the mouse look going through the door: only free it if something else is open.
    }
    setTalking(null);
    setDeskOpen(false);
    setDrillOpen(false);
    setAtDrill(false);
    setNear(null);
    setAtDesk(false);
    setNearTower(null);
    setNearShelf(null);
    setAtDoor(false);
    setAtTable(false);
    setReport(null);
    setTableNote(null);
    setReadShelf(null);
    dispatchArea({ type: "enter", ref: { id: "library", holdingId: id } });
  }, []);
  const leaveTower = useCallback(() => {
    setReadShelf(null);
    setNearShelf(null);
    setAtDoor(false);
    setAtTable(false);
    setReport(null);
    setTableNote(null);
    dispatchArea({ type: "leave" });
  }, []);
  const openReport = useCallback((holdingId: string) => {
    if (document.pointerLockElement) document.exitPointerLock();
    setReadShelf(null);
    setTableNote("Fetching the latest report…");
    api
      .listDocuments(holdingId)
      .then((docs) => {
        const doc = latestReport(docs);
        if (doc) {
          markReportOpened(doc);
          setReport(doc);
          setTableNote(null);
        } else setTableNote("No report on the table yet.");
      })
      .catch(() => setTableNote("Couldn't fetch the report. Try again."));
  }, []);

  // Walking away from a shelf closes its page.
  useEffect(() => {
    if (readShelf && nearShelf !== readShelf) setReadShelf(null);
  }, [nearShelf, readShelf]);

  // Walking away from the table puts its note away.
  useEffect(() => {
    if (!atTable) setTableNote(null);
  }, [atTable]);

  // Walking away from the desk closes it; so does starting a talk.
  useEffect(() => {
    if (deskOpen && (!atDesk || talking)) setDeskOpen(false);
  }, [atDesk, deskOpen, talking]);
  // The old books belong to the desk: they close with it.
  useEffect(() => {
    if (booksOpen && !deskOpen) setBooksOpen(false);
  }, [booksOpen, deskOpen]);
  // Walking away from the vault closes it too, and so does starting a talk.
  useEffect(() => {
    if (vaultOpen && (!atVault || talking)) setVaultOpen(false);
  }, [atVault, vaultOpen, talking]);
  // The Realm post: the same.
  useEffect(() => {
    if (realmOpen && (!atRealm || talking)) setRealmOpen(false);
  }, [atRealm, realmOpen, talking]);
  // The same for the watch post and the perch.
  useEffect(() => {
    if (watchOpen && (!atWatch || talking)) setWatchOpen(false);
  }, [atWatch, watchOpen, talking]);
  useEffect(() => {
    if (perchOpen && (!atPerch || talking)) setPerchOpen(false);
  }, [atPerch, perchOpen, talking]);

  // Walking away from the drill post ends the drill (the camp goes); so does starting a talk.
  useEffect(() => {
    if (drillOpen && (!atDrill || talking)) setDrillOpen(false);
  }, [atDrill, drillOpen, talking]);

  // Walking away ends the talk.
  useEffect(() => {
    if (talking && near !== talking) setTalking(null);
  }, [near, talking]);

  // One answer to "what am I standing at": the E key and the prompt below both read it.
  const nears = useMemo<Nears>(
    () => ({
      npc: near,
      tower: nearTower,
      desk: atDesk,
      drill: atDrill,
      sign: atSign,
      booth: nearBooth,
      stall: nearStall,
      gate: atGate,
      vault: atVault,
      watch: atWatch,
      perch: atPerch,
      realm: atRealm,
      shelf: nearShelf,
      table: atTable,
      libraryDoor: atDoor,
      building: townNear,
      townExit: atTownExit,
      board: nearBoard,
      hallDoor: atHallDoor,
      shelves: atShelves,
      archiveDoor: atArchiveDoor,
    }),
    [near, nearTower, atDesk, atDrill, atSign, nearBooth, nearStall, atGate, atVault, atWatch, atPerch, atRealm, nearShelf, atTable, atDoor, townNear, atTownExit, nearBoard, atHallDoor, atShelves, atArchiveDoor],
  );
  const atSpot = useMemo(() => standingAt(area, nears), [area, nears]);

  useEffect(() => {
    const onTalk = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const el = e.target as HTMLElement | null;
      if (typingInField(el)) return;
      if (boothOpen || lampOpen) return;
      // Mid-move (S22): no second door while the screen is dark.
      if (isMoving(areaState)) return;
      const at = atSpot;
      switch (area.id) {
        case "records":
          // In the Hall of Records: E reads the shelves, or takes the door back out.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "shelves") openShelves();
          else leaveRecords();
          return;
        case "townhall":
          // In the Town Hall: E opens the board you stand at, or takes the door back out.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "board") openBoard(at.id);
          else leaveHall();
          return;
        case "town":
          // In the Town: E knocks at the door you stand at, or takes the road back.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "building") openBuilding(at.id);
          else leaveTown();
          return;
        case "library":
          // Inside a tower: E reads the shelf you stand at, opens the latest report at the table, or takes the door back out.
          if (report || at.kind === "none" || !room) return;
          e.preventDefault();
          if (at.kind === "table") openReport(room);
          else if (at.kind === "shelf") {
            if (readShelf !== at.id && document.pointerLockElement) document.exitPointerLock();
            setReadShelf((v) => (v === at.id ? null : at.id));
          } else leaveTower();
          return;
      }
      // The courtyard: E does the one thing `atSpot` names (the prompt shows the same thing).
      if (at.kind === "none") return;
      e.preventDefault();
      switch (at.kind) {
        case "npc":
          if (talking) setTalking(null);
          else {
            // Free the mouse so the Close and Try again buttons can be clicked.
            if (document.pointerLockElement) document.exitPointerLock();
            setTalking(at.id);
          }
          return;
        case "tower":
          enterTower(at.holdingId);
          return;
        case "desk":
          if (!deskOpen && document.pointerLockElement) document.exitPointerLock();
          setDeskOpen((v) => !v);
          return;
        case "drill":
          if (!drillOpen && document.pointerLockElement) document.exitPointerLock();
          setDrillOpen((v) => !v);
          return;
        case "sign":
          toggleWhere();
          return;
        case "booth":
          openBooth(at.id);
          return;
        case "stall":
          openStore(at.holdingId);
          return;
        case "gate":
          enterTown();
          return;
        case "vault":
          if (!vaultOpen && document.pointerLockElement) document.exitPointerLock();
          setVaultOpen((v) => !v);
          return;
        case "watch":
          if (!watchOpen && document.pointerLockElement) document.exitPointerLock();
          setWatchOpen((v) => !v);
          return;
        case "perch":
          // Without data there is nothing to open.
          if (!ravens) return;
          if (!perchOpen && document.pointerLockElement) document.exitPointerLock();
          setPerchOpen((v) => !v);
          return;
        case "realm":
          if (!state) return;
          if (!realmOpen && document.pointerLockElement) document.exitPointerLock();
          setRealmOpen((v) => !v);
          return;
      }
    };
    window.addEventListener("keydown", onTalk);
    return () => window.removeEventListener("keydown", onTalk);
  }, [area, areaState, atSpot, whereOpen, openShelves, leaveRecords, openBoard, leaveHall, openBuilding, leaveTown, enterTown, talking, vaultOpen, watchOpen, perchOpen, ravens, realmOpen, lampOpen, state, boothOpen, openBooth, openStore, toggleWhere, drillOpen, deskOpen, room, report, readShelf, enterTower, leaveTower, openReport]);

  useEffect(() => {
    const onPanelKey = (e: KeyboardEvent) => {
      const id = PANEL_KEYS[e.code];
      if (!id || e.ctrlKey || e.metaKey || e.altKey) return;
      if (typingInField(e.target)) return;
      e.preventDefault();
      flip(id);
    };
    window.addEventListener("keydown", onPanelKey);
    return () => window.removeEventListener("keydown", onPanelKey);
  }, [flip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // F3 is often grabbed by the browser or editor ("find"), so P works too.
      if ((e.code === "F3" || e.code === "KeyP") && !e.ctrlKey && !e.metaKey && !e.altKey && !typingInField(e.target)) {
        e.preventDefault();
        setShowPerf((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // G opens or shuts the "Where to?" menu from anywhere; Esc backs out of a page, then the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;
      if (e.code === "KeyG") {
        e.preventDefault();
        toggleWhere();
      } else if (e.code === "Escape" && whereOpen) {
        if (worldPage) setWorldPage(null);
        else closeWhere();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleWhere, closeWhere, whereOpen, worldPage]);

  if (!supported) return <Unavailable />;

  // The prompt is the E key's own answer (`atSpot`), so it never promises something E does not do.
  let spotPrompt: string | null = null;
  let spotNote: string | null = null;
  switch (atSpot.kind) {
    case "shelves":
      if (!whereOpen) spotPrompt = shelfPrompt;
      break;
    case "board":
      if (!whereOpen) spotPrompt = hallPrompt(boardById(atSpot.id));
      break;
    case "building":
      if (!whereOpen) spotPrompt = buildingPrompt(BUILDINGS.find((b) => b.id === atSpot.id) ?? BUILDINGS[0]);
      break;
    case "leave":
      if (area.id === "library") spotPrompt = "Press E to go back outside";
      else if (!whereOpen) spotPrompt = area.id === "records" ? archiveDoorPrompt : area.id === "townhall" ? hallDoorPrompt : exitPrompt;
      break;
    case "shelf":
      if (!readShelf) spotPrompt = `Press E to read ${roomView?.shelves.find((s) => s.id === atSpot.id)?.title ?? "the shelf"}`;
      break;
    case "table":
      if (!report) spotPrompt = tableNote ?? "Press E to open the latest report";
      break;
    case "tower":
      spotPrompt = `Press E to go into ${world.plain.find((t) => t.holdingId === atSpot.holdingId)?.name ?? "the tower"}`;
      break;
    case "desk":
      if (!deskOpen) spotPrompt = "Press E to write at the desk";
      break;
    case "drill":
      if (!drillOpen) spotPrompt = DRILL_PROMPT;
      break;
    case "sign":
      if (!whereOpen) spotPrompt = SIGN_PROMPT;
      break;
    case "booth":
      if (!boothOpen && !whereOpen) spotPrompt = boothPrompt(atSpot.id);
      break;
    case "stall":
      if (!whereOpen) {
        spotPrompt = stallPrompt(street.stalls.find((s) => s.holdingId === atSpot.holdingId)?.name ?? "this company");
        if (street.overflow.length > 0) spotNote = streetOverflowLine(street.overflow.length);
      }
      break;
    case "gate":
      if (!whereOpen) spotPrompt = gatePrompt;
      break;
    case "vault":
      if (!vaultOpen) spotPrompt = VAULT_PROMPT;
      break;
    case "watch":
      if (!watchOpen) spotPrompt = WATCH_PROMPT;
      break;
    case "perch":
      if (!perchOpen && ravens) spotPrompt = PERCH_PROMPT;
      break;
    case "realm":
      if (!realmOpen && state) spotPrompt = REALM_PROMPT;
      break;
    default:
      break;
  }

  return (
    <div className="relative h-[calc(100dvh-5rem)] min-h-[480px] w-full overflow-hidden bg-surface">
      <SceneBoundary fallback={<Unavailable />}>
        <Suspense fallback={<p className="p-6 text-sm text-ink-muted">Raising the walls...</p>}>
          <Scene
            world={shownWorld}
            standingLevel={standingText.lit}
            onLockChange={setLocked}
            onStats={setStats}
            statsDetail={showPerf}
            onNear={setNear}
            near={near}
            books={quest.written}
            onNearDesk={setAtDesk}
            onNearDrill={setAtDrill}
            onNearSign={setAtSign}
            onNearStall={setNearStall}
            onNearBooth={setNearBooth}
            vaultLevel={state?.vault.level ?? null}
            onNearVault={setAtVault}
            watchStatus={nightWatch?.status ?? null}
            onNearWatch={setAtWatch}
            unseenRavens={unseenRavens}
            onNearPerch={setAtPerch}
            realmLevel={realmLevel}
            siegeLevel={state?.siege?.level ?? null}
            onNearRealm={setAtRealm}
            drillOpen={drillOpen}
            stalls={street.stalls}
            talking={talking}
            cheerKey={cheerKey}
            hold={isMoving(areaState)}
            onNearTower={setNearTower}
            area={area}
            room={roomView}
            onNearShelf={setNearShelf}
            onNearTable={setAtTable}
            onNearDoor={setAtDoor}
            onNearGate={setAtGate}
            townNear={townNear}
            onNearBuilding={setTownNear}
            onNearTownExit={setAtTownExit}
            onNearBoard={setNearBoard}
            onNearHallDoor={setAtHallDoor}
            onNearShelves={setAtShelves}
            onNearArchiveDoor={setAtArchiveDoor}
          />
        </Suspense>
      </SceneBoundary>

      <AreaFade phase={movePhase} plate={plate} />

      <Toolbar
        open={panels}
        onToggle={flip}
        questsWaiting={(quest.status === "open" ? 1 : 0) + (reviews.status === "open" ? 1 : 0)}
        towerCount={world.plain.length}
        statsOn={showPerf}
        statsLabel={stats ? `${stats.fps} fps · ${stats.calls} draws · ${Math.round(stats.triangles / 1000)}k tris` : "Measuring..."}
        onToggleStats={() => setShowPerf((v) => !v)}
        whereOpen={whereOpen}
        onToggleWhere={toggleWhere}
      />
      {showPerf && <PerfBreakdown stats={stats} />}
      {whereOpen && !worldPage && <WhereToPanel onPick={pickDoor} onClose={closeWhere} only={onlyPlace} onlyRoutes={onlyRoutes} />}
      {whereOpen && worldPage && <WorldPanel door={worldPage} onBack={() => setWorldPage(null)} onClose={closeWhere} />}
      {panels.towers && <TowerPanel world={shownWorld} loading={loading} error={error} onRetry={load} onClose={() => flip("towers")} />}
      {panels.quests && <QuestLog quest={quest} reviews={reviews} demo={world.demo} standing={standingText} wires={standing && !standingFailed ? (standing.wires ?? []) : undefined} onLookAtWire={lookAtWire} onRefreshStanding={refreshStanding} drill={drillQuest} onClose={() => flip("quests")} />}
      {vaultOpen && state && <VaultPanel state={state} onChanged={load} onClose={() => setVaultOpen(false)} />}
      {realmOpen && state && <RealmPanel state={state} onClose={() => setRealmOpen(false)} />}
      {watchOpen && <WatchPanel onClose={() => setWatchOpen(false)} />}
      {perchOpen && ravens && <RavensPanel ravens={ravens} seen={seenRavens} onSeen={onRavensSeen} onClose={() => setPerchOpen(false)} />}
      {deskOpen && (
        // Hidden, not unmounted, while the old books are open: what you typed stays where it is.
        <div style={{ display: booksOpen ? "none" : "contents" }}>
        <DeskPanel
          holdings={world.plain}
          missing={quest.missing}
          written={quest.written}
          block={deskBlock(world.demo, quest.status)}
          onSave={saveAtDesk}
          onClose={() => setDeskOpen(false)}
          entries={journal?.entries.length ?? 0}
          due={journal?.reviews_due ?? 0}
          onReadBooks={journalFailed ? undefined : () => setBooksOpen(true)}
          onRubLamp={() => {
            if (document.pointerLockElement) document.exitPointerLock();
            setLampOpen(true);
          }}
        />
        </div>
      )}
      {deskOpen && booksOpen && (
        <JournalBooksPanel
          entries={journal?.entries ?? null}
          failed={journalFailed}
          onChanged={refreshJournal}
          onBack={() => setBooksOpen(false)}
          onClose={() => {
            setBooksOpen(false);
            setDeskOpen(false);
          }}
        />
      )}
      {lampOpen && <MagicLamp embedded onClose={() => setLampOpen(false)} />}
      {drillOpen && (
        <DrillPanel
          count={drillQuest.count}
          block={drillBlock(drillQuest)}
          onSave={saveDrill}
          onClose={() => setDrillOpen(false)}
        />
      )}
      {roomView && readShelf && (
        <ShelfPanel
          name={roomView.name}
          shelf={roomView.shelves.find((s) => s.id === readShelf) ?? roomView.shelves[0]}
          demo={world.demo}
          onClose={() => setReadShelf(null)}
        />
      )}
      {report && <DocumentReader document={report} origin="50% 50%" onClosed={() => setReport(null)} />}
      {talking && <DialoguePanel npc={talking} quest={quest} reviews={reviews} onClose={() => setTalking(null)} onRetry={load} />}

      <Link
        to="/fortress"
        title={PLAIN_VIEW_TITLE}
        className="absolute left-3 top-3 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
      >
        {PLAIN_VIEW}
      </Link>
      {roomView && (
        <button
          type="button"
          onClick={leaveTower}
          className="absolute left-3 top-14 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
        >
          ← Back outside
        </button>
      )}

      {inHall && (
        <button
          type="button"
          onClick={leaveHall}
          className="absolute left-3 top-14 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
        >
          ← Back to the Town
        </button>
      )}
      {inRecords && (
        <button
          type="button"
          onClick={leaveRecords}
          className="absolute left-3 top-14 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
        >
          ← Back to the Town
        </button>
      )}
      {inTown && !inHall && !inRecords && (
        <button
          type="button"
          onClick={leaveTown}
          className="absolute left-3 top-14 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
        >
          ← Back to the courtyard
        </button>
      )}
      {boothOpen === "sal" && <SalesRepDialog demoMode={demoMode === true} rows={watchlist?.rows ?? []} onClose={closeBooth} onAdded={setWatchlist} />}
      {boothOpen === "hype" && <HypeBoothDialog demoMode={demoMode === true} rows={watchlist?.rows ?? []} onClose={closeBooth} onAdded={setWatchlist} />}

      {spotPrompt && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          {spotPrompt}
          {spotNote && <span className="block text-xs opacity-80">{spotNote}</span>}
        </p>
      )}

      {!locked && !talking && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          Click to look around · W A S D walk · Shift run · Space jump · Wheel zoom · Esc frees the mouse · Q quests · T towers · G where to
        </p>
      )}
    </div>
  );
}
