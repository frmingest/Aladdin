import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import type { DecisionRecord, DocumentSummary, GameState, HoldingAdvisors, Watchlist, Journal, JournalEntryInput, NightWatch, Ravens, Standing, StormDrillInput, StormDrills } from "../lib/types";
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
import { MACRO_ROUTE, dialsPrompt, towerDoorPrompt } from "../game3d/weatherTowerRoom";
import { PLAIN_VIEW, PLAIN_VIEW_TITLE, SIGN_PROMPT } from "../game3d/worldWordsV2";
import { drillBlock, stormDrillQuest } from "../game3d/stormDrill";
import { DRILL_PROMPT } from "../game3d/stormDrillWordsV1";
import ShelfPanel from "../game3d/ShelfPanel";
import { centreSlotFor } from "../game3d/landCentre";
import { centreTowerFor, gateStoneFor, landRadius, lanternsFor, pricePostFor, workplaceCondition } from "../game3d/holdingLand";
import { LANTERN_WORDS } from "../game3d/landLanternWordsV1";
import { loadOpened } from "../lib/scrolls";
import { surveyTower } from "../lib/survey";
import type { SurveyCheckId } from "../lib/survey";
import { LAND_WORDS } from "../game3d/holdingLandWordsV1";
import { shelvesFor } from "../game3d/libraryShelves";
import type { CouncilInput, ShelfId } from "../game3d/libraryShelves";
import type { RoomView } from "../game3d/Scene";
import { COURTYARD } from "../game3d/areas";
import type { AreaRef } from "../game3d/areas";
import { canGoBack, escapeTarget } from "../game3d/layers";
import type { OpenLayers } from "../game3d/layers";
import { placeFromSearch, searchFor } from "../game3d/placeLink";
import AreaFade from "../game3d/AreaFade";
import { INITIAL_AREA, areaReducer, isMoving } from "../game3d/areaMachine";
import type { AreaAction, AreaState } from "../game3d/areaMachine";
import { AREA_STUCK, areaLine, areaName } from "../game3d/areaWordsV1";
import { FIELD_WORDS } from "../game3d/siegeFieldWordsV1";
import { DEFAULT_TOOLS, applySpot, spotPrompt as fieldSpotPrompt } from "../game3d/siegeFieldTools";
import type { FieldSpotId, FieldTools } from "../game3d/siegeFieldTools";
import { setYardBenchmark, yardBenchmark } from "../game3d/siegeYard";
import { buildQuarter } from "../game3d/quarterPlan";
import { QUARTER_WORDS } from "../game3d/quarterWordsV1";
import { prefersReducedMotion } from "../game3d/motionPref";
import { standingAt } from "../game3d/near";
import type { Nears } from "../game3d/near";
import { deskBlock } from "../game3d/deskForm";
import PerfBreakdown from "../game3d/PerfBreakdown";
import Toolbar from "../game3d/Toolbar";
import { typingInField } from "../game3d/useKeys";
import { stallPrompt, storeDoor } from "../game3d/stallDoor";
import { BUILDINGS, buildingPrompt, doorAction } from "../game3d/townPlan";
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
import { HINT_TEXT, countVisit, hintWanted } from "../game3d/hintLine";
import { SOUND_KEY, ambienceLevel } from "../game3d/soundPlan";
import { useAmbience } from "../game3d/useAmbience";
import type { PanelId } from "../game3d/hudPanels";
import { celebrationDue } from "../game3d/celebrate";
import { sixMonthReckoning } from "../game3d/quest";
import {
  guideMarks,
  guideStatus,
  loadGuide,
  markSalVisited,
  markWeatherVisited,
  onGuideTalk,
  replayGuide,
  saveGuide,
} from "../game3d/guideQuests";
import type { GuideSaved, GuideStatus } from "../game3d/guideQuests";
import { unwrittenThesisV2 } from "../game3d/questV2";
import { NPCS, alsoHereNote } from "../game3d/npcs";
import type { NpcId } from "../game3d/npcs";
import ActionPrompt from "../game3d/ActionPrompt";
import { emptyStreetNote, streetOverflowLine } from "../game3d/streetPlan";
import { stateToWorld } from "../game3d/stateToWorld";
import { withGaps } from "../game3d/standingGaps";
import { wordsFor } from "../game3d/standingWordsV3";
import { withGameStandingLabels } from "../game3d/standingLabelsWordsV1";
import { webglSupported } from "../game3d/webgl";
import type { PerfStats } from "../game3d/PerfProbe";

// The 3D engine and the physics are heavy, so they only download on this page.
const Scene = lazy(() => import("../game3d/Scene"));

/** The frame-rate button is a developer tool: it shows with ?debug. P and F3 still toggle the readout for anyone. */
const DEBUG_STATS = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

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
// The place a link names, or the courtyard. A land link is held back until its tower has loaded.
function startingArea(init: AreaState): AreaState {
  if (typeof window === "undefined") return init;
  const ref = placeFromSearch(window.location.search);
  return ref.id === "holding" ? init : { ...init, current: ref };
}
function landLink(search: string): string | null {
  const ref = placeFromSearch(search);
  return ref.id === "holding" ? ref.holdingId : null;
}

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
/** The browser's own storage, or null when it is blocked (private mode, a locked-down page). The Guide then just does not remember. */
function guideStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

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
  // A tower door: which one you stand at; and, once inside the holding's land, which shelf, the gate or the table you stand at.
  const [nearTower, setNearTower] = useState<string | null>(null);
  // Which place you are in: one value, not four flags. A tower's land is `holding` with the holding's id.
  const [areaState, dispatchArea] = useReducer(areaReducerWithMotion, INITIAL_AREA, startingArea);
  // A `?at=holding:<id>` link waits for the towers to load (a land needs its tower); the other places open at once.
  const linkedLand = useRef<string | null>(typeof window === "undefined" ? null : landLink(window.location.search));
  const room = areaState.current.id === "holding" ? areaState.current.holdingId : null;
  // The Town beyond the gate: whether you are in it, and which door or the gate road you stand at.
  const [townNear, setTownNear] = useState<BuildingId | null>(null);
  // Inside the Town Hall: whether you are in it, which board you stand at, whether the door is in reach, and which pages the menu is narrowed to.
  const [nearBoard, setNearBoard] = useState<BoardId | null>(null);
  const [atHallDoor, setAtHallDoor] = useState(false);
  // Inside the Hall of Records: whether you are in it, whether you stand at the shelves, and whether the door is in reach.
  const [atShelves, setAtShelves] = useState(false);
  const [atArchiveDoor, setAtArchiveDoor] = useState(false);
  const [atDials, setAtDials] = useState(false);
  const [atWeatherDoor, setAtWeatherDoor] = useState(false);
  const [onlyRoutes, setOnlyRoutes] = useState<readonly string[] | null>(null);
  // The Siege Field: whether you stand at its gate in the courtyard, and whether its road back is in reach.
  const [atSiegeGate, setAtSiegeGate] = useState(false);
  const [atFieldExit, setAtFieldExit] = useState(false);
  // Inside the field: the tool in reach, and the fall and yardstick the winch, stones and banners steer.
  const [fieldSpot, setFieldSpot] = useState<FieldSpotId | null>(null);
  const [fieldTools, setFieldTools] = useState<FieldTools>(() => DEFAULT_TOOLS(yardBenchmark()));
  const onFieldPresets = useCallback(
    (p: { toStorm: number | null; toSiege: number | null; min: number; max: number }) =>
      setFieldTools((t) => (t.toStorm === p.toStorm && t.toSiege === p.toSiege && t.min === p.min && t.max === p.max ? t : { ...t, ...p })),
    [],
  );
  // The Market Quarter: whether you stand at its arch in the courtyard, and whether its road back is in reach.
  const [atQuarterGate, setAtQuarterGate] = useState(false);
  // The Town Hall stands on the meadow outside the gate: whether you stand at its door.
  const [atQuarterExit, setAtQuarterExit] = useState(false);
  const [onlyPlace, setOnlyPlace] = useState<PlaceId | null>(null);
  const [nearShelf, setNearShelf] = useState<ShelfId | null>(null);
  const [atLandGate, setAtLandGate] = useState(false);
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
  // The key hint teaches the controls, so it shows on the first few visits only (C2).
  const [showHint] = useState(() => hintWanted(countVisit()));
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
  // The Market Quarter: the same companies, up to twelve, laid up one lane. The arch counts them all; an unread watchlist counts nothing.
  const quarter = useMemo(() => buildQuarter(watchlist?.rows), [watchlist]);
  const archCounts = useMemo(() => (watchlist ? { total: quarter.total, inRange: quarter.inRange } : null), [watchlist, quarter]);
  // Never invent towers: no state means bare pads.
  const world = useMemo(() => stateToWorld(state), [state]);
  // What is drawn and listed: the same world, with the Standing's named gaps labelled on their towers.
  const shownWorld = useMemo(() => withGaps(world, standing?.gaps ?? []), [world, standing]);
  const standingText = useMemo(() => withGameStandingLabels(wordsFor(standing, standingFailed)), [standing, standingFailed]);
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
  // The Guide (First Steps): five small quests. Two read real facts (a stall exists, a why exists); the three "you went
  // there" steps are the only thing saved, in this browser. On the sample fortress the real facts are unknown, so those steps stay open.
  const [guideSaved, setGuideSaved] = useState<GuideSaved>(() => loadGuide(guideStorage()));
  const guideFacts = useMemo(
    () => ({
      stalls: demoMode === true || watchlist === null ? null : watchlist.rows.length,
      whys: demoMode === true || !(quest.status === "open" || quest.status === "done") ? null : quest.written,
    }),
    [demoMode, watchlist, quest],
  );
  const guide = useMemo(() => guideStatus(guideSaved, guideFacts), [guideSaved, guideFacts]);
  const questMarks = useMemo(() => guideMarks(guide, guideSaved), [guide, guideSaved]);
  useEffect(() => {
    saveGuide(guideStorage(), guideSaved);
  }, [guideSaved]);
  // What the Guide looked like when you walked up to an advisor, so the words match the step you came for.
  const [guideTalkSnap, setGuideTalkSnap] = useState<{ status: GuideStatus; met: readonly NpcId[] } | null>(null);
  const guideNow = useRef({ saved: guideSaved, facts: guideFacts });
  guideNow.current = { saved: guideSaved, facts: guideFacts };
  const startGuideTalk = useCallback((id: NpcId) => {
    const { saved, facts } = guideNow.current;
    setGuideTalkSnap({ status: guideStatus(saved, facts), met: saved.met });
    setGuideSaved(onGuideTalk(saved, facts, id));
  }, []);
  const replayGuideNow = useCallback(() => setGuideSaved(replayGuide(guideNow.current.facts)), []);
  useEffect(() => {
    if (celebrationDue(quest.status, world.demo, cheered.current)) {
      cheered.current = true;
      setCheerKey(Date.now());
    }
  }, [quest.status, world.demo]);
  // Quest 2 reads the same journal; it needs no holdings, so it does not wait for the towers.
  const drillQuest = useMemo(() => stormDrillQuest(drills, drillsFailed), [drills, drillsFailed]);
  const reviews = useMemo(() => sixMonthReckoning(journal?.entries ?? null, journalFailed), [journal, journalFailed]);


  // The Council's words (the seventh shelf): the advisor lines for the holding whose land you are in. Asked when you
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

  // The survey lanterns (fog of war): the same four checks as the flat Cartographer's table, read for the one holding
  // you walked into. Until the report list and the decision records have answered (or failed), the lanterns stay hooded.
  const [landSurvey, setLandSurvey] = useState<{ holdingId: string; docs: DocumentSummary[] | null; records: DecisionRecord[] | null } | null>(null);
  const [openedTick, setOpenedTick] = useState(0);
  useEffect(() => {
    if (!room || isSample) return;
    let live = true;
    void Promise.all([
      api.listDocuments(room).catch(() => null),
      api.getRecords().then((r) => r.records).catch(() => null),
    ]).then(([docs, records]) => live && setLandSurvey({ holdingId: room, docs, records }));
    return () => {
      live = false;
    };
  }, [room, isSample]);
  const [atLantern, setAtLantern] = useState<SurveyCheckId | null>(null);
  const [lanternOpen, setLanternOpen] = useState<SurveyCheckId | null>(null);

  // The land you are in: the stored row for that holding, turned into a gate stone and seven shelves. Nothing is stored here.
  const roomView = useMemo<RoomView | null>(() => {
    if (!room || !state) return null;
    const tower = state.towers.find((t) => t.holding_id === room);
    const view = shownWorld.plain.find((t) => t.holdingId === room);
    if (!tower || !view) return null;
    const surveyed = workplaceCondition(tower.wall, false) !== "unknown";
    return {
      holdingId: room,
      name: tower.name,
      ticker: tower.ticker,
      gap: view.gap ?? null,
      gate: gateStoneFor(tower, surveyed),
      radius: landRadius(tower.size_class),
      centre: centreSlotFor(tower, centreTowerFor(view)),
      price: pricePostFor(tower),
      shelves: shelvesFor(tower, councilInput),
      lanterns: lanternsFor(
        isSample
          ? surveyTower(tower, { state, records: null, documents: {}, opened: new Set() })
          : landSurvey && landSurvey.holdingId === room
            ? surveyTower(tower, { state, records: landSurvey.records, documents: { [room]: landSurvey.docs }, opened: loadOpened() })
            : null,
      ),
    };
    // `openedTick` makes the "report opened" lantern re-read the opened list after you read the report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, state, shownWorld, councilInput, landSurvey, isSample, openedTick]);
  // A fresh load that drops the tower (or the state) puts you back outside rather than in an empty room.
  useEffect(() => {
    if (room && !roomView) dispatchArea({ type: "enter", ref: COURTYARD, instant: true });
  }, [room, roomView]);
  // The place the scene draws: a land whose tower is gone is not a place, so it reads as the courtyard.
  const area: AreaRef = areaState.current.id === "holding" && !roomView ? COURTYARD : areaState.current;
  // Opt-in sound: off on every load, follows the same stored siege level as the sky, quiet indoors.
  const sound = useAmbience(ambienceLevel(area.id, state?.siege?.level ?? null));
  const inHall = area.id === "townhall";
  const inRecords = area.id === "records";

  // The address follows the place (replace, not push, so the browser's Back leaves the page instead of re-walking your steps).
  useEffect(() => {
    if (typeof window === "undefined" || linkedLand.current) return;
    const next = searchFor(area, window.location.search);
    if (next !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
  }, [area]);
  // A land link: once the towers are known, go in if that tower exists; otherwise stay in the courtyard.
  useEffect(() => {
    const id = linkedLand.current;
    if (!id || !state) return;
    linkedLand.current = null;
    if (state.towers.some((t) => t.holding_id === id)) dispatchArea({ type: "enter", ref: { id: "holding", holdingId: id }, instant: true });
  }, [state]);

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

  // The world reads the watchlist from the same facts as the flat Marketplace. A price saved in a store page, or a company added, changes
  // those facts behind the world's back, so read the watchlist again whenever a store page or the Where-to panel closes or goes back,
  // and whenever you change place. A failed read keeps what the world already shows (no stalls vanish because of one bad request).
  const refreshWatchlist = useCallback(() => {
    api
      .getWatchlist()
      .then(setWatchlist)
      .catch(() => undefined);
  }, []);
  const watchedPage = useRef<boolean>(false);
  useEffect(() => {
    const open = whereOpen && !!worldPage;
    if (watchedPage.current && !open) refreshWatchlist();
    watchedPage.current = open;
  }, [whereOpen, worldPage, refreshWatchlist]);
  const watchedPlace = useRef<string | null>(null);
  useEffect(() => {
    const key = `${areaState.current.id}:${"holdingId" in areaState.current ? areaState.current.holdingId : ""}`;
    if (watchedPlace.current !== null && watchedPlace.current !== key) refreshWatchlist();
    watchedPlace.current = key;
  }, [areaState, refreshWatchlist]);

  // E at a stand: the flat page's own Sal dialog or Hype Booth dialog, over the world.
  const openBooth = useCallback((id: BoothId) => {
    if (document.pointerLockElement) document.exitPointerLock();
    if (id === "sal") setGuideSaved(markSalVisited);
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
    setTownNear(null);
    setAtSiegeGate(false);
    setAtFieldExit(false);
    setFieldSpot(null);
    setAtQuarterGate(false);
    setAtQuarterExit(false);
    setNearBoard(null);
    setAtHallDoor(false);
    setAtShelves(false);
    setAtArchiveDoor(false);
    setAtDials(false);
    setAtWeatherDoor(false);
  }, []);
  // Out to the Siege Field and back to its gate. The courtyard's watchers are unmounted while there, so the nears are cleared.
  const enterField = useCallback(() => {
    clearNears();
    setDeskOpen(false);
    setVaultOpen(false);
    setWatchOpen(false);
    setPerchOpen(false);
    setRealmOpen(false);
    setLampOpen(false);
    setDrillOpen(false);
    dispatchArea({ type: "enter", ref: { id: "siege" } });
  }, [clearNears]);
  const leaveField = useCallback(() => {
    clearNears();
    dispatchArea({ type: "leave" });
  }, [clearNears]);
  // E at the winch, a marker stone or a yardstick banner: the same what-if, a different fall or yardstick.
  const workFieldSpot = useCallback((id: FieldSpotId) => {
    setFieldTools((t) => {
      const next = applySpot(id, t);
      if (next === null) return t;
      // The yardstick is shared with the flat Siege Simulator (same storage key), so both pages answer alike.
      if (next.benchmark !== t.benchmark) setYardBenchmark(next.benchmark);
      return next;
    });
  }, []);
  // Under the arch to the Market Quarter and back out beside it. Same shape as the Siege Field's gate.
  const enterQuarter = useCallback(() => {
    clearNears();
    setDeskOpen(false);
    setVaultOpen(false);
    setWatchOpen(false);
    setPerchOpen(false);
    setRealmOpen(false);
    setLampOpen(false);
    setDrillOpen(false);
    dispatchArea({ type: "enter", ref: { id: "quarter" } });
  }, [clearNears]);
  const leaveQuarter = useCallback(() => {
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
  // Into the Weather Tower and back out to its door; E at the dials opens the flat Macro page in the world panel.
  const enterWeather = useCallback(() => {
    setGuideSaved(markWeatherVisited);
    clearNears();
    dispatchArea({ type: "enter", ref: { id: "weather" } });
  }, [clearNears]);
  const leaveWeather = useCallback(() => {
    clearNears();
    dispatchArea({ type: "leave" });
  }, [clearNears]);
  const openDials = useCallback(() => {
    const row = REGISTER.find((d) => d.route === MACRO_ROUTE);
    if (!row) return;
    if (document.pointerLockElement) document.exitPointerLock();
    setWhereOpen(true);
    setOnlyPlace(null);
    setOnlyRoutes(null);
    setWorldPage(row);
  }, []);
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
    if (id === "weather") {
      enterWeather();
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
  }, [enterHall, enterRecords, enterWeather]);

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
    setAtLandGate(false);
    setAtTable(false);
    setAtLantern(null);
    setLanternOpen(null);
    setReport(null);
    setTableNote(null);
    setReadShelf(null);
    dispatchArea({ type: "enter", ref: { id: "holding", holdingId: id } });
  }, []);
  const leaveTower = useCallback(() => {
    setReadShelf(null);
    setNearShelf(null);
    setAtLandGate(false);
    setAtTable(false);
    setAtLantern(null);
    setLanternOpen(null);
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
          setOpenedTick((n) => n + 1);
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

  // Walking away from a lantern puts its plate away.
  useEffect(() => {
    if (lanternOpen && atLantern !== lanternOpen) setLanternOpen(null);
  }, [atLantern, lanternOpen]);

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
      vault: atVault,
      watch: atWatch,
      perch: atPerch,
      realm: atRealm,
      shelf: nearShelf,
      table: atTable,
      lantern: atLantern,
      landGate: atLandGate,
      building: townNear,
      board: nearBoard,
      hallDoor: atHallDoor,
      shelves: atShelves,
      archiveDoor: atArchiveDoor,
      dials: atDials,
      weatherDoor: atWeatherDoor,
      siegeGate: atSiegeGate,
      fieldExit: atFieldExit,
      fieldSpot,
      quarterGate: atQuarterGate,
      quarterExit: atQuarterExit,
    }),
    [near, nearTower, atDesk, atDrill, atSign, nearBooth, nearStall, atVault, atWatch, atPerch, atRealm, nearShelf, atTable, atLantern, atLandGate, townNear, nearBoard, atHallDoor, atShelves, atArchiveDoor, atDials, atWeatherDoor, atSiegeGate, atFieldExit, fieldSpot, atQuarterGate, atQuarterExit],
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
        case "weather":
          // In the Weather Tower: E opens the full weather page at the dials, or takes the door back out.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "dials") openDials();
          else leaveWeather();
          return;
        case "townhall":
          // In the Town Hall: E opens the board you stand at, or takes the door back out.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "board") openBoard(at.id);
          else leaveHall();
          return;
        case "siege":
          // In the Siege Field: E works the winch, a stone or a banner in reach, or takes the road back.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "fieldSpot") workFieldSpot(at.id);
          else leaveField();
          return;
        case "quarter":
          // In the Market Quarter: E steps into the store of the stall you stand at, or takes the road back.
          if (whereOpen || at.kind === "none") return;
          e.preventDefault();
          if (at.kind === "stall") openStore(at.holdingId);
          else leaveQuarter();
          return;
        case "holding":
          // In a holding's land: E reads the shelf you stand at, opens the latest report at the table, or takes the door back out.
          if (report || at.kind === "none" || !room) return;
          e.preventDefault();
          if (at.kind === "table") openReport(room);
          else if (at.kind === "lantern") {
            const c = at.check;
            setLanternOpen((v) => (v === c ? null : c));
          } else if (at.kind === "shelf") {
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
            startGuideTalk(at.id);
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
        case "building":
          openBuilding(at.id);
          return;
        case "siegeGate":
          enterField();
          return;
        case "quarterGate":
          enterQuarter();
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
  }, [area, areaState, atSpot, whereOpen, openShelves, leaveRecords, openDials, leaveWeather, enterField, leaveField, workFieldSpot, enterQuarter, leaveQuarter, enterHall, openBoard, leaveHall, openBuilding, talking, vaultOpen, watchOpen, perchOpen, ravens, realmOpen, lampOpen, state, boothOpen, openBooth, openStore, toggleWhere, drillOpen, deskOpen, room, report, readShelf, enterTower, leaveTower, openReport, startGuideTalk]);

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
    const onSoundKey = (e: KeyboardEvent) => {
      if (e.code !== SOUND_KEY || e.ctrlKey || e.metaKey || e.altKey || e.repeat || !sound.supported) return;
      if (typingInField(e.target)) return;
      e.preventDefault();
      sound.toggle();
    };
    window.addEventListener("keydown", onSoundKey);
    return () => window.removeEventListener("keydown", onSoundKey);
  }, [sound]);

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

  // B walks back out of the place you are in: the same call each room's own door makes.
  const goBack = useCallback(() => {
    if (area.id === "holding") leaveTower();
    else if (area.id === "townhall") leaveHall();
    else if (area.id === "records") leaveRecords();
    else if (area.id === "weather") leaveWeather();
    else if (area.id === "siege") leaveField();
    else if (area.id === "quarter") leaveQuarter();
  }, [area.id, leaveTower, leaveHall, leaveRecords, leaveWeather, leaveField, leaveQuarter]);

  // G opens or shuts the "Where to?" menu from anywhere. Esc closes what is on top (the panel drawn over the others), and
  // B walks back out once nothing is open over the world.
  const layers: OpenLayers = {
    booth: !!boothOpen,
    lamp: lampOpen,
    report: !!report,
    books: deskOpen && booksOpen,
    shelf: !!readShelf,
    talking: !!talking,
    desk: deskOpen,
    drill: drillOpen,
    vault: vaultOpen,
    realm: realmOpen,
    watch: watchOpen,
    perch: perchOpen,
    worldPage: whereOpen && !!worldPage,
    where: whereOpen,
  };
  const layerKey = JSON.stringify(layers);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;
      const open = JSON.parse(layerKey) as OpenLayers;
      if (e.code === "KeyG") {
        e.preventDefault();
        toggleWhere();
      } else if (e.code === "Escape") {
        switch (escapeTarget(open)) {
          case "books": return setBooksOpen(false);
          case "shelf": return setReadShelf(null);
          case "talking": return setTalking(null);
          case "desk": return setDeskOpen(false);
          case "drill": return setDrillOpen(false);
          case "vault": return setVaultOpen(false);
          case "realm": return setRealmOpen(false);
          case "watch": return setWatchOpen(false);
          case "perch": return setPerchOpen(false);
          case "worldPage": return setWorldPage(null);
          case "where": return closeWhere();
          default: return;
        }
      } else if (e.code === "KeyB" && canGoBack(open) && !isMoving(areaState) && area.id !== "courtyard") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleWhere, closeWhere, goBack, layerKey, areaState, area.id]);

  if (!supported) return <Unavailable />;

  /** The prompt is also a button: a tap does what the E key does. */
  const pressE = () => document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", bubbles: true }));

  // The prompt is the E key's own answer (`atSpot`), so it never promises something E does not do.
  let spotPrompt: string | null = null;
  let spotNote: string | null = null;
  switch (atSpot.kind) {
    case "npc":
      if (!talking) {
        spotPrompt = `Press E to talk to ${NPCS.find((n) => n.id === atSpot.id)?.name ?? "them"}`;
        // The two advisors stand side by side, so say who else is within reach (a step toward them makes them the answer).
        spotNote = alsoHereNote(atSpot.id);
      }
      break;
    case "shelves":
      if (!whereOpen) spotPrompt = shelfPrompt;
      break;
    case "dials":
      if (!whereOpen) spotPrompt = dialsPrompt;
      break;
    case "board":
      if (!whereOpen) spotPrompt = hallPrompt(boardById(atSpot.id));
      break;
    case "building":
      if (!whereOpen) spotPrompt = buildingPrompt(BUILDINGS.find((b) => b.id === atSpot.id) ?? BUILDINGS[0]);
      break;
    case "leave":
      if (area.id === "holding") spotPrompt = LAND_WORDS.gatePrompt;
      else if (area.id === "siege") spotPrompt = FIELD_WORDS.exitPrompt;
      else if (area.id === "quarter") spotPrompt = QUARTER_WORDS.exitPrompt;
      else if (!whereOpen) spotPrompt = area.id === "records" ? archiveDoorPrompt : area.id === "weather" ? towerDoorPrompt : hallDoorPrompt;
      break;
    case "shelf":
      if (!readShelf) spotPrompt = `Press E to read ${roomView?.shelves.find((s) => s.id === atSpot.id)?.title ?? "the shelf"}`;
      break;
    case "lantern": {
      const lan = roomView?.lanterns.find((l) => l.check === atSpot.check);
      if (lan) spotPrompt = lanternOpen === lan.check ? LANTERN_WORDS.plate(lan.label, lan.reason) : LANTERN_WORDS.prompt(lan.label);
      break;
    }
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
    case "siegeGate":
      if (!whereOpen) spotPrompt = FIELD_WORDS.gatePrompt;
      break;
    case "fieldSpot":
      if (!whereOpen) spotPrompt = fieldSpotPrompt(atSpot.id, fieldTools);
      break;
    case "quarterGate":
      if (!whereOpen) spotPrompt = QUARTER_WORDS.gatePrompt;
      break;
    case "sign":
      if (!whereOpen) spotPrompt = SIGN_PROMPT;
      break;
    case "booth":
      if (!boothOpen && !whereOpen) {
        spotPrompt = boothPrompt(atSpot.id);
        spotNote = emptyStreetNote(atSpot.id, watchlist ? watchlist.rows.length : null);
      }
      break;
    case "stall":
      if (!whereOpen) {
        // Stalls stand only in the Market Quarter; the courtyard keeps the arch, Sal's counter and the Hype Booth.
        spotPrompt = stallPrompt(quarter.stalls.find((s) => s.holdingId === atSpot.holdingId)?.name ?? "this company");
        if (quarter.overflow.length > 0) spotNote = streetOverflowLine(quarter.overflow.length);
      }
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

  // One Back button for every room (C2): the Town Hall, the Hall of Records, the Weather Tower and a holding's tower.
  const backOutside = roomView ? leaveTower : inHall ? leaveHall : inRecords ? leaveRecords : area.id === "weather" ? leaveWeather : null;
  // Any panel or dialog on screen: the hint line steps aside for it.
  const anyPanelOpen =
    panels.quests || panels.towers || whereOpen || vaultOpen || realmOpen || watchOpen || perchOpen || deskOpen || drillOpen || lampOpen || boothOpen !== null || report !== null;

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
            questMarks={questMarks}
            talking={talking}
            cheerKey={cheerKey}
            hold={isMoving(areaState)}
            onNearTower={setNearTower}
            area={area}
            room={roomView}
            onNearShelf={setNearShelf}
            onNearTable={setAtTable}
            onNearLantern={setAtLantern}
            onNearLandGate={setAtLandGate}
            townNear={townNear}
            onNearBuilding={setTownNear}
            onNearSiegeGate={setAtSiegeGate}
            onNearFieldExit={setAtFieldExit}
            onNearFieldSpot={setFieldSpot}
            fieldTools={fieldTools}
            onFieldPresets={onFieldPresets}
            quarter={quarter}
            archCounts={archCounts}
            onNearQuarterGate={setAtQuarterGate}
            onNearQuarterExit={setAtQuarterExit}
            onNearBoard={setNearBoard}
            onNearHallDoor={setAtHallDoor}
            onNearShelves={setAtShelves}
            onNearArchiveDoor={setAtArchiveDoor}
            onNearDials={setAtDials}
            onNearWeatherDoor={setAtWeatherDoor}
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
        showStats={DEBUG_STATS}
        whereOpen={whereOpen}
        onToggleWhere={toggleWhere}
        sound={sound.supported ? { on: sound.on, onToggle: sound.toggle } : undefined}
      />
      {showPerf && <PerfBreakdown stats={stats} />}
      {whereOpen && !worldPage && <WhereToPanel onPick={pickDoor} onClose={closeWhere} only={onlyPlace} onlyRoutes={onlyRoutes} />}
      {whereOpen && worldPage && <WorldPanel door={worldPage} onBack={() => setWorldPage(null)} onClose={closeWhere} />}
      {panels.towers && <TowerPanel world={shownWorld} loading={loading} error={error} onRetry={load} onClose={() => flip("towers")} />}
      {panels.quests && <QuestLog quest={quest} reviews={reviews} demo={world.demo} standing={standingText} wires={standing && !standingFailed ? (standing.wires ?? []) : undefined} onLookAtWire={lookAtWire} onRefreshStanding={refreshStanding} drill={drillQuest} guide={{ status: guide, saved: guideSaved, onReplay: replayGuideNow }} onClose={() => flip("quests")} />}
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
      {talking && <DialoguePanel npc={talking} quest={quest} reviews={reviews} drill={drillQuest} guide={guideTalkSnap} onClose={() => setTalking(null)} onRetry={load} />}

      <Link
        to="/fortress"
        title={PLAIN_VIEW_TITLE}
        className="absolute left-3 top-3 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
      >
        {PLAIN_VIEW}
      </Link>
      {backOutside && (
        <button
          type="button"
          onClick={backOutside}
          className="absolute left-3 top-14 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
        >
          ← Back outside
        </button>
      )}
      {boothOpen === "sal" && <SalesRepDialog voice="game" demoMode={demoMode === true} rows={watchlist?.rows ?? []} onClose={closeBooth} onAdded={setWatchlist} />}
      {boothOpen === "hype" && <HypeBoothDialog voice="game" demoMode={demoMode === true} rows={watchlist?.rows ?? []} onClose={closeBooth} onAdded={setWatchlist} />}

      {spotPrompt && <ActionPrompt text={spotPrompt} note={spotNote} onPress={pressE} />}

      {showHint && !locked && !talking && !anyPanelOpen && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          {HINT_TEXT}
        </p>
      )}
    </div>
  );
}
