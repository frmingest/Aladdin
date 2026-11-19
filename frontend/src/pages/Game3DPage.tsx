import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { describeError } from "../lib/errors";
import type { DecisionRecord, DocumentSummary, GameState, HistoryDays, HoldingAdvisors, Watchlist, Journal, JournalEntryInput, NightWatch, Ravens, Standing, StormDrillInput, StormDrills } from "../lib/types";
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
import HourglassBanner from "../game3d/HourglassBanner";
import HourglassPanel from "../game3d/HourglassPanel";
import type { DayStatus, HistoryStatus } from "../game3d/HourglassPanel";
import { PLAY_STEP_MS, buildTimeline, openInThePast, playNext, stepDay, todayUtc } from "../game3d/hourglassPlan";
import { HOURGLASS_PROMPT, HOURGLASS_SHUT } from "../game3d/hourglassWordsV1";
import MagicLamp from "../components/fortress/MagicLamp";
import { summarizeRealm } from "../lib/realmVerdict";
import { PERCH_PROMPT, WATCH_PROMPT } from "../game3d/watchWordsV1";
import DrillPanel from "../game3d/DrillPanel";
import WhereToPanel from "../game3d/WhereToPanel";
import WorldPanel from "../game3d/WorldPanel";
import { REGISTER } from "../game3d/parity3d";
import type { Door } from "../game3d/parity3d";
import { RECORDS_ROUTE, archiveDoorPrompt, shelfPrompt } from "../game3d/recordsHallRoomLogic";
import { MACRO_ROUTE, dialsPrompt, towerDoorPrompt } from "../game3d/weatherTowerRoomLogic";
import MintPlainPanel from "../game3d/MintPlainPanel";
import { bookPrompt, doorPrompt as mintDoorPrompt } from "../game3d/mintRoomLogic";
import { leverReadout } from "../game3d/mintRoomLogic";
import { MINT_WORDS } from "../game3d/mintWordsV1";
import { useMint } from "../game3d/useMint";
import { PLAIN_VIEW, PLAIN_VIEW_TITLE, SIGN_PROMPT } from "../game3d/worldWordsV2";
import { drillBlock, stormDrillQuest } from "../game3d/stormDrill";
import { DRILL_PROMPT } from "../game3d/stormDrillWordsV1";
import ShelfPanel from "../game3d/ShelfPanel";
import { centreSlotFor } from "../game3d/landCentreLogic";
import { centreTowerFor, gateStoneFor, landRadius, lanternsFor, pricePostFor, workplaceCondition } from "../game3d/holdingLandLogic";
import { LANTERN_WORDS } from "../game3d/landLanternWordsV1";
import { loadOpened } from "../lib/scrolls";
import { surveyTower } from "../lib/survey";
import type { SurveyCheckId } from "../lib/survey";
import { LAND_WORDS } from "../game3d/holdingLandWordsV1";
import { shelvesFor } from "../game3d/libraryShelves";
import type { CouncilInput, ShelfId } from "../game3d/libraryShelves";
import type { RoomView, SceneLook } from "../game3d/Scene";
import { COURTYARD } from "../game3d/areas";
import type { AreaRef } from "../game3d/areas";
import { canGoBack, escapeTarget } from "../game3d/layers";
import type { OpenLayers } from "../game3d/layers";
import { placeFromSearch, searchFor } from "../game3d/placeLink";
import AreaFade from "../game3d/AreaFade";
import { INITIAL_AREA, areaReducer, isMoving } from "../game3d/areaMachine";
import type { AreaAction, AreaState } from "../game3d/areaMachine";
import { AREA_STUCK, areaLine, areaName } from "../game3d/areaWordsV1";
import { FIELD_WORDS } from "../game3d/siegeFieldWordsV2";
import { DEFAULT_TOOLS, applySpot, spotPrompt as fieldSpotPrompt } from "../game3d/siegeFieldTools";
import type { FieldSpotId, FieldTools } from "../game3d/siegeFieldTools";
import { setYardBenchmark, yardBenchmark } from "../game3d/siegeYard";
import { buildQuarter } from "../game3d/quarterPlan";
import { QUARTER_WORDS } from "../game3d/quarterWordsV1";
import { prefersReducedMotion } from "../game3d/motionPref";
import { standingAt } from "../game3d/near";
import { NO_MARKS, archLit, holdingMarks, litStalls, noticeSheets, placeMarks, recentRavenIds, stallsRead, unseenWireIds } from "../game3d/marks";
import { MAX_DONE, buildRound, roundChipCount, loadRound, persistRound, pruneDone, ravenFactIds, stopId, wireFactIds } from "../game3d/round";
import { SAMPLE_SHEETS, sampleLit, sampleMarks, sampleRound, sampleRoundFacts } from "../game3d/sampleRound";
import type { Stop } from "../game3d/round";
import type { MarkSource } from "../game3d/marks";
import type { Standing as AtSpot } from "../game3d/near";
import { useNears } from "../game3d/nearStore";
import { deskBlock } from "../game3d/deskForm";
import PerfBreakdown from "../game3d/PerfBreakdown";
import Toolbar from "../game3d/Toolbar";
import { typingInField } from "../game3d/useKeys";
import { stallPrompt, storeDoor } from "../game3d/stallDoor";
import { BUILDINGS, buildingPrompt, doorAction } from "../game3d/townPlan";
import type { BuildingId } from "../game3d/townPlan";
import { boardById, doorsOfBoard, hallDoorPrompt, hallPrompt } from "../game3d/townHallRoomLogic";
import type { BoardId } from "../game3d/townHallRoomLogic";
import type { PlaceId } from "../game3d/parity3d";
import { boothPrompt } from "../game3d/boothPlan";
import type { BoothId } from "../game3d/boothPlan";
import SalesRepDialog from "../components/marketplace/SalesRepDialog";
import HypeBoothDialog from "../components/marketplace/HypeBoothDialog";
import { useDemoMode } from "../lib/demoMode";
import { PANEL_KEYS, autoOpenQuests, loadPanels, savePanels, togglePanel } from "../game3d/hudPanels";
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

/** How many read nights the Hourglass keeps in memory (the replay moves forward, so older ones are read again if you go back). */
const FRAME_CACHE_MAX = 30;

/** The panels that open where you stand and shut when you walk away. Each is also a kind in the list of spots (near.ts). */
const PANEL_SPOTS = ["desk", "drill", "vault", "realm", "watch", "perch", "hourglass"] as const;
type PanelSpot = (typeof PANEL_SPOTS)[number];
type SpotPanels = Record<PanelSpot, boolean>;
const NO_SPOT_PANELS: SpotPanels = { desk: false, drill: false, vault: false, realm: false, watch: false, perch: false, hourglass: false };
const NOWHERE: AtSpot = { kind: "none" };
/** What one kind of spot does: its prompt (null while silent), an optional second line, and what E does. */
interface SpotAct<S> {
  prompt: (at: S) => string | null;
  note?: (at: S) => string | null;
  press: (at: S) => void;
}
/** One entry per kind in the list of things you can walk up to. A new kind does not compile until it has one. */
type SpotActs = { [S in Exclude<AtSpot, { kind: "none" }> as S["kind"]]: SpotAct<S> };

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
  // Where the hero stands: the scene's one watcher writes it and the page reads it (near.ts, #411).
  const nears = useNears();
  const [talking, setTalking] = useState<NpcId | null>(null);
  // The panels that open where you stand (the writing desk, the drill post whose camp stands while it is open, the vault
  // chest, the Realm post, the Night Watch post, the raven perch): which of them are open.
  const [spotPanels, setSpotPanels] = useState<SpotPanels>(NO_SPOT_PANELS);
  const { desk: deskOpen, drill: drillOpen, vault: vaultOpen, realm: realmOpen, watch: watchOpen, perch: perchOpen, hourglass: hourglassOpen } = spotPanels;
  const setSpotPanel = useCallback((id: PanelSpot, open: boolean) => setSpotPanels((p) => (p[id] === open ? p : { ...p, [id]: open })), []);
  // The old books (past journal entries), opened from the desk panel; and the Magic Lamp on the writing desk (the Genie).
  const [booksOpen, setBooksOpen] = useState(false);
  const [lampOpen, setLampOpen] = useState(false);
  // The dispatch (decides the lantern) and the ravens (decide the birds). Each is read on its own: if one cannot be read the
  // lantern stays dark with a "?" and the perch stays bare, and the panel says so.
  const [nightWatch, setNightWatch] = useState<NightWatch | null>(null);
  const [ravens, setRavens] = useState<Ravens | null>(null);
  // "Seen" is the flat page's own per-browser list, so a raven marked here is marked there too.
  const [seenRavens, setSeenRavens] = useState<Set<string>>(() => loadSeen());
  // The Hourglass (#414): the stored days, and the one day you are looking back at (null is today, the live fortress).
  // A day is set only once it has been read, so the date on screen is always the day that is drawn.
  const [history, setHistory] = useState<{ status: HistoryStatus; demo: boolean; days: string[] }>({ status: "idle", demo: false, days: [] });
  const [past, setPast] = useState<{ day: string; status: DayStatus; state: GameState | null } | null>(null);
  const [turning, setTurning] = useState(false);
  const [playing, setPlaying] = useState(false);
  const frameCache = useRef(new Map<string, GameState>());
  const frameInflight = useRef(new Map<string, Promise<GameState>>());
  const turnSeq = useRef(0);
  const inPast = past !== null;
  // The signpost by the gate: whether the "Where to?" menu is open, and the flat page shown in the world panel.
  const [whereOpen, setWhereOpen] = useState(false);
  const [worldPage, setWorldPage] = useState<Door | null>(null);
  // Which flat-page dialog (Sal or the Hype Booth) is open over the world.
  const [boothOpen, setBoothOpen] = useState<BoothId | null>(null);
  const { demoMode } = useDemoMode();
  // The Storm Drill: the stored drills.
  const [drills, setDrills] = useState<StormDrills | null>(null);
  const [drillsFailed, setDrillsFailed] = useState(false);
  // Market Street: the watchlist is separate too; if it cannot be read, the street simply has no stalls.
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  // Which place you are in: one value, not four flags. A tower's land is `holding` with the holding's id.
  const [areaState, dispatchArea] = useReducer(areaReducerWithMotion, INITIAL_AREA, startingArea);
  // A `?at=holding:<id>` link waits for the towers to load (a land needs its tower); the other places open at once.
  const linkedLand = useRef<string | null>(typeof window === "undefined" ? null : landLink(window.location.search));
  const room = areaState.current.id === "holding" ? areaState.current.holdingId : null;
  // The "Where to?" menu narrowed to one board's pages or one building's place.
  const [onlyRoutes, setOnlyRoutes] = useState<readonly string[] | null>(null);
  const [onlyPlace, setOnlyPlace] = useState<PlaceId | null>(null);
  // Inside the Siege Field: the fall and yardstick the winch, stones and banners steer.
  const [fieldTools, setFieldTools] = useState<FieldTools>(() => DEFAULT_TOOLS(yardBenchmark()));
  const onFieldPresets = useCallback(
    (p: { toStorm: number | null; toSiege: number | null; min: number; max: number }) =>
      setFieldTools((t) => (t.toStorm === p.toStorm && t.toSiege === p.toSiege && t.min === p.min && t.max === p.max ? t : { ...t, ...p })),
    [],
  );
  // A holding's land: the shelf being read, the report the reading table opened, and a short note when there is none.
  const [readShelf, setReadShelf] = useState<ShelfId | null>(null);
  const [report, setReport] = useState<DocumentSummary | null>(null);
  const [tableNote, setTableNote] = useState<string | null>(null);
  // The quest-done cheer: a new number starts it, once per page load, never on the sample journal.
  const [cheerKey, setCheerKey] = useState<number | null>(null);
  const cheered = useRef(false);
  // Panels start shut (or as you left them) so the scene is not covered.
  const [panels, setPanels] = useState(loadPanels);
  // The key hint teaches the controls, so it shows on the first few visits only (C2).
  const [showHint] = useState(() => hintWanted(countVisit()));
  // The Quest log holds the wires, so while you look back its key does nothing (it stays as you left it for today).
  const flip = useCallback((id: PanelId) => { if (inPast && id === "quests") return; setPanels((p) => togglePanel(p, id)); }, [inPast]);
  // The sample fortress opens the Quests panel once so the made-up round shows with no tap; it never stores that (demo wins).
  const autoOpened = useRef(false);
  useEffect(() => {
    if (state === null || !(state.demo === true || demoMode === true)) return;
    const next = autoOpenQuests(panels, true, autoOpened.current);
    autoOpened.current = true;
    if (next) setPanels(next);
  }, [state, demoMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state?.demo === true || demoMode === true) return;
    savePanels(panels);
  }, [panels, state, demoMode]);

  // Which of the round's own reads have answered (well or badly). Until they have, the round says nothing about them.
  const [settled, setSettled] = useState({ stalls: false, watch: false, ravens: false });
  const settle = useCallback((k: "stalls" | "watch" | "ravens") => setSettled((v) => (v[k] ? v : { ...v, [k]: true })), []);
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
      .catch(() => setWatchlist(null))
      .finally(() => settle("stalls"));
    setStandingFailed(false);
    api
      .getStanding()
      .then(setStanding)
      .catch(() => setStandingFailed(true));
    api
      .getNightWatch()
      .then(setNightWatch)
      .catch(() => setNightWatch(null))
      .finally(() => settle("watch"));
    api
      .getRavens()
      .then(setRavens)
      .catch(() => setRavens(null))
      .finally(() => settle("ravens"));
  }, [settle]);
  // Today's round (#412 step 3): what you dealt with, kept in this browser like the Guide. A stop is ticked only when you did the
  // thing at the spot; walking past ticks nothing. The sample fortress never ticks, never saves and never shows a real round.
  const [roundSince] = useState(() => loadRound(guideStorage()).lastVisit);
  const [visitAt] = useState(() => Date.now());
  const [roundDone, setRoundDone] = useState<string[]>(() => loadRound(guideStorage()).done);
  const roundOff = state?.demo === true || demoMode === true;
  // The sample fortress has its own made-up round: ticks live in memory only, never in the real browser keys.
  const [sampleDone, setSampleDone] = useState<string[]>([]);
  /** The latest facts and stops, for the event handlers below (read when you act, never while drawing). */
  const roundRef = useRef<{
    ravens: ReadonlyMap<string, string>;
    wires: ReadonlyMap<string, string>;
    lit: ReadonlySet<string>;
    noticeDay: string | null;
    noticeSheets: number;
    stops: readonly Stop[];
  }>({ ravens: new Map(), wires: new Map(), lit: new Set(), noticeDay: null, noticeSheets: 0, stops: [] });
  /** Stops ticked this visit, kept so one whose fact has since left (a wire you looked at) still shows ticked. */
  const roundCarry = useRef<Stop[]>([]);
  const tickStops = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const shown = roundRef.current.stops.filter((s) => ids.includes(s.id));
      roundCarry.current = [...roundCarry.current.filter((c) => !ids.includes(c.id)), ...shown.map((s) => ({ ...s, done: true }))];
      (roundOff ? setSampleDone : setRoundDone)((d) => {
        const add = ids.filter((i) => !d.includes(i));
        return add.length === 0 ? d : [...d, ...add].slice(-MAX_DONE);
      });
    },
    [roundOff],
  );
  /** Sample fortress: tick everything off again so the made-up round can be replayed. */
  const startSampleAgain = useCallback(() => {
    roundCarry.current = [];
    setSampleDone([]);
  }, []);
  const onRavensSeen = useCallback((ids: string[]) => {
    const hit: string[] = [];
    roundRef.current.ravens.forEach((rid, h) => ids.includes(rid) && hit.push(stopId("raven", h, rid)));
    tickStops(hit);
    setSeenRavens((cur) => {
      const next = markSeen(cur, ids);
      saveSeen(next);
      return next;
    });
  }, [tickStops]);
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
  const lookAtWire = useCallback(
    async (id: string) => {
      const r = await api.acknowledgeTripwire(id);
      const hit: string[] = [];
      roundRef.current.wires.forEach((wid, h) => wid === id && hit.push(stopId("smoke", h, wid)));
      tickStops(hit);
      return r;
    },
    [tickStops],
  );
  const refreshStanding = useCallback(
    () => api.getStanding().then((st) => { setStanding(st); setStandingFailed(false); }),
    [],
  );

  useEffect(() => {
    if (supported) load();
  }, [supported, load]);

  // Looking back, everything drawn comes from the stored day's own state (a gap or an unreadable day has none: bare pads and fog).
  const viewState = inPast ? past.state : state;
  // The verdict on the whole fortress, by the flat page's own function. A fortress that could not be read is "unknown", never "sound".
  const realmLevel = useMemo(() => (viewState ? summarizeRealm(viewState).level : null), [viewState]);
  // The Market Quarter: the same companies, up to twelve, laid up one lane. The arch counts them all; an unread watchlist counts nothing.
  const quarter = useMemo(() => buildQuarter(watchlist?.rows), [watchlist]);
  const archCounts = useMemo(() => (watchlist ? { total: quarter.total, inRange: quarter.inRange } : null), [watchlist, quarter]);
  // Never invent towers: no state means bare pads.
  const world = useMemo(() => stateToWorld(viewState), [viewState]);
  // What is drawn and listed: the same world, with the Standing's named gaps labelled on their towers (today's gaps, so not in the past).
  const shownWorld = useMemo(() => (inPast ? world : withGaps(world, standing?.gaps ?? [])), [inPast, world, standing]);
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
  // The Royal Mint: the lever list is read the first time you go in; the stamped answer lives here, not in the scene.
  const mint = useMint(area.id === "mint");
  const [plainOpen, setPlainOpen] = useState(false);

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
    // The flat pages behind this menu can write, so the menu stays shut while you look back (#414).
    if (inPast) return;
    setWhereOpen((open) => {
      if (!open && document.pointerLockElement) document.exitPointerLock();
      return !open;
    });
    setWorldPage(null);
    setOnlyPlace(null);
    setOnlyRoutes(null);
  }, [inPast]);
  const closeWhere = useCallback(() => {
    setWhereOpen(false);
    setWorldPage(null);
    setOnlyPlace(null);
    setOnlyRoutes(null);
  }, []);
  // --- The Hourglass (#414) -------------------------------------------------------------------------------------
  const today = useMemo(() => todayUtc(new Date()), []);
  const timeline = useMemo(() => buildTimeline(history.days, today), [history.days, today]);
  const loadHistory = useCallback(() => {
    setHistory((h) => ({ ...h, status: "loading" }));
    api
      .getGameHistory()
      .then((r: HistoryDays) => setHistory({ status: "ready", demo: r.demo, days: r.days }))
      .catch(() => setHistory((h) => ({ ...h, status: "failed" })));
  }, []);
  /** One stored day as a picture: a stored frame, a gap (nothing stored, or a 404) or a day that could not be read. */
  const readDay = useCallback(
    async (day: string): Promise<{ status: DayStatus; state: GameState | null }> => {
      if (!history.days.includes(day)) return { status: "gap", state: null };
      const cached = frameCache.current.get(day);
      if (cached) return { status: "frame", state: cached };
      try {
        // One request per day, even when a read-ahead and a step ask for the same night.
        let pending = frameInflight.current.get(day);
        if (!pending) {
          pending = api.getGameFrame(day).then((f) => f.state).finally(() => frameInflight.current.delete(day));
          frameInflight.current.set(day, pending);
        }
        const state = await pending;
        // Keep the newest few nights only; the Map's order is oldest first.
        frameCache.current.set(day, state);
        while (frameCache.current.size > FRAME_CACHE_MAX) frameCache.current.delete(frameCache.current.keys().next().value as string);
        return { status: "frame", state };
      } catch (e) {
        return e instanceof ApiError && e.status === 404 ? { status: "gap", state: null } : { status: "failed", state: null };
      }
    },
    [history.days],
  );
  /** Look at a night, or go back to today (null). The day is set only after it has been read, so the date always matches what is drawn. */
  const goToDay = useCallback(
    (day: string | null) => {
      const seq = ++turnSeq.current;
      if (day === null) {
        setPast(null);
        setPlaying(false);
        setTurning(false);
        return;
      }
      setTurning(true);
      readDay(day).then((r) => {
        if (seq !== turnSeq.current) return;
        setPast({ day, ...r });
        setTurning(false);
        // Read the next night ahead of the replay so it does not stall.
        const next = playNext(timeline, day);
        if (next && history.days.includes(next) && !frameCache.current.has(next)) void readDay(next);
      });
    },
    [readDay, timeline, history.days],
  );
  const pastDay = past?.day ?? null;
  const playToggle = useCallback(() => {
    if (playing) return setPlaying(false);
    if (pastDay === null) {
      const first = timeline[0]?.day;
      if (!first) return;
      goToDay(first);
    }
    setPlaying(true);
  }, [playing, pastDay, timeline, goToDay]);
  // The replay rests on each night, then turns to the next; at the newest night it stops (never loops, never leaves the past by itself).
  useEffect(() => {
    if (!playing || turning || pastDay === null) return;
    const t = window.setTimeout(() => {
      const next = playNext(timeline, pastDay);
      if (next === null) setPlaying(false);
      else goToDay(next);
    }, PLAY_STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, turning, pastDay, timeline, goToDay]);
  // A replay does not run in a hidden tab (no reads, no rebuilds nobody sees).
  useEffect(() => {
    if (!playing) return;
    const onHide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [playing]);
  // H takes you home to today from anywhere while you look back.
  useEffect(() => {
    if (!inPast) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyH" || e.ctrlKey || e.metaKey || e.altKey || typingInField(e.target)) return;
      e.preventDefault();
      goToDay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inPast, goToDay]);
  // Going back shuts whatever could write (a panel left open, the flat pages, a dialog) before the past is drawn.
  useEffect(() => {
    if (!inPast) return;
    setWhereOpen(false);
    setWorldPage(null);
    setBoothOpen(null);
    setTalking(null);
    setBooksOpen(false);
    setLampOpen(false);
    setSpotPanels((p) => (p.desk || p.drill || p.vault || p.watch || p.perch ? { ...p, desk: false, drill: false, vault: false, watch: false, perch: false } : p));
  }, [inPast]);

  // E at a stall: that company's store, in the world panel (the flat store page itself).
  const openStore = useCallback((holdingId: string) => {
    const door = storeDoor(holdingId);
    if (!door) return;
    if (document.pointerLockElement) document.exitPointerLock();
    if (roundRef.current.lit.has(holdingId)) tickStops([stopId("stall", holdingId, null)]);
    setWhereOpen(true);
    setWorldPage(door);
  }, [tickStops]);

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

  // Through a door, any door: put away what is open where you stood, then go. The scene's watcher forgets the old
  // place's spots on arrival, so there is nothing to clear by hand.
  const closeLand = useCallback(() => {
    setReadShelf(null);
    setLanternOpen(null);
    setReport(null);
    setTableNote(null);
  }, []);
  const enterArea = useCallback(
    (ref: AreaRef) => {
      setTalking(null);
      setSpotPanels(NO_SPOT_PANELS);
      setLampOpen(false);
      closeLand();
      setPlainOpen(false);
      if (ref.id === "weather") setGuideSaved(markWeatherVisited);
      dispatchArea({ type: "enter", ref });
    },
    [closeLand],
  );
  const leaveArea = useCallback(() => {
    closeLand();
    setPlainOpen(false);
    dispatchArea({ type: "leave" });
  }, [closeLand]);
  // A world-only door (the Royal Mint) has no page: picking it walks you in and puts the menu away.
  const pickDoor = useCallback(
    (door: Door) => {
      if (door.world) {
        closeWhere();
        enterArea({ id: door.world });
        return;
      }
      setWorldPage(door);
    },
    [closeWhere, enterArea],
  );
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
  // E at the dials or the archive shelves: that room's flat page (the Macro page, the Hall of Records) in the world panel.
  const openPage = useCallback((route: string) => {
    const row = REGISTER.find((d) => d.route === route);
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
  // E at a building: a room of its own, its page in the world panel, or (the Workshop) the menu of its place.
  const openBuilding = useCallback(
    (id: BuildingId) => {
      if (id === "townhall" || id === "records" || id === "weather" || id === "mint") return enterArea({ id });
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
    },
    [enterArea],
  );
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
    if (readShelf && nears.shelf !== readShelf) setReadShelf(null);
  }, [nears.shelf, readShelf]);

  // Walking away from a lantern puts its plate away.
  useEffect(() => {
    if (lanternOpen && nears.lantern !== lanternOpen) setLanternOpen(null);
  }, [nears.lantern, lanternOpen]);

  // Walking away from the table puts its note away.
  useEffect(() => {
    if (!nears.table) setTableNote(null);
  }, [nears.table]);

  // Walking away from the desk, the drill post, the vault, the Realm post, the watch post or the perch closes its panel
  // (the drill's camp goes with it); so does starting a talk.
  useEffect(() => {
    setSpotPanels((p) => {
      const shut = PANEL_SPOTS.filter((id) => p[id] && (!nears[id] || talking));
      return shut.length === 0 ? p : { ...p, ...Object.fromEntries(shut.map((id) => [id, false])) };
    });
  }, [nears, talking, spotPanels]);
  // The old books belong to the desk: they close with it.
  useEffect(() => {
    if (booksOpen && !deskOpen) setBooksOpen(false);
  }, [booksOpen, deskOpen]);

  // Walking away ends the talk.
  useEffect(() => {
    if (talking && nears.npc !== talking) setTalking(null);
  }, [nears.npc, talking]);

  // One answer to "what am I standing at": the E key and the prompt below both read it. Nothing is in reach on the way out of a door.
  const atSpot = useMemo<AtSpot>(() => (areaState.phase === "fadingOut" ? NOWHERE : standingAt(area, nears)), [area, nears, areaState.phase]);

  // What E does at each thing you can walk up to, and what its prompt says (#411). One entry per kind in the list
  // (`SPOTS`, near.ts); the compiler asks for an entry when the list grows. The prompt is silent while its panel is open.
  const openSpotPanel = (id: PanelSpot) => {
    if (!spotPanels[id] && document.pointerLockElement) document.exitPointerLock();
    setSpotPanel(id, !spotPanels[id]);
  };
  const acts: SpotActs = {
    npc: {
      prompt: (at) => (talking ? null : `Press E to talk to ${NPCS.find((n) => n.id === at.id)?.name ?? "them"}`),
      // The two advisors stand side by side, so say who else is within reach (a step toward them makes them the answer).
      note: (at) => alsoHereNote(at.id),
      press: (at) => {
        if (talking) return setTalking(null);
        // Free the mouse so the Close and Try again buttons can be clicked.
        if (document.pointerLockElement) document.exitPointerLock();
        startGuideTalk(at.id);
        setTalking(at.id);
      },
    },
    tower: {
      prompt: (at) => `Press E to go into ${world.plain.find((t) => t.holdingId === at.id)?.name ?? "the tower"}`,
      press: (at) => enterArea({ id: "holding", holdingId: at.id }),
    },
    desk: { prompt: () => (deskOpen ? null : "Press E to write at the desk"), press: () => openSpotPanel("desk") },
    drill: { prompt: () => (drillOpen ? null : DRILL_PROMPT), press: () => openSpotPanel("drill") },
    siegeGate: { prompt: () => (whereOpen ? null : FIELD_WORDS.gatePrompt), press: () => enterArea({ id: "siege" }) },
    quarterGate: { prompt: () => (whereOpen ? null : QUARTER_WORDS.gatePrompt), press: () => enterArea({ id: "quarter" }) },
    sign: { prompt: () => (whereOpen ? null : SIGN_PROMPT), press: toggleWhere },
    booth: {
      prompt: (at) => (boothOpen || whereOpen ? null : boothPrompt(at.id)),
      note: (at) => emptyStreetNote(at.id, watchlist ? watchlist.rows.length : null),
      press: (at) => openBooth(at.id),
    },
    building: {
      prompt: (at) => (whereOpen ? null : buildingPrompt(BUILDINGS.find((b) => b.id === at.id) ?? BUILDINGS[0])),
      press: (at) => openBuilding(at.id),
    },
    vault: { prompt: () => (vaultOpen ? null : VAULT_PROMPT), press: () => openSpotPanel("vault") },
    watch: {
      prompt: () => (watchOpen ? null : WATCH_PROMPT),
      press: () => {
        if (!watchOpen && roundRef.current.noticeSheets > 0) tickStops([stopId("notice", null, roundRef.current.noticeDay)]);
        openSpotPanel("watch");
      },
    },
    // Without data there is nothing to open.
    perch: { prompt: () => (perchOpen || !ravens ? null : PERCH_PROMPT), press: () => {
        if (!ravens) return;
        if (roundOff) tickStops([...roundRef.current.ravens].map(([h, rid]) => stopId("raven", h, rid)));
        openSpotPanel("perch");
      },
    },
    realm: { prompt: () => (realmOpen || !viewState ? null : REALM_PROMPT), press: () => viewState && openSpotPanel("realm") },
    // The Hourglass: opening it reads the stored days (read-only); the panel then chooses the night.
    hourglass: {
      prompt: () => (hourglassOpen ? null : HOURGLASS_PROMPT),
      press: () => {
        if (!hourglassOpen && history.status !== "ready" && history.status !== "loading") loadHistory();
        openSpotPanel("hourglass");
      },
    },
    // A holding's land.
    shelf: {
      prompt: (at) => (readShelf ? null : `Press E to read ${roomView?.shelves.find((s) => s.id === at.id)?.title ?? "the shelf"}`),
      press: (at) => {
        if (readShelf !== at.id && document.pointerLockElement) document.exitPointerLock();
        setReadShelf((v) => (v === at.id ? null : at.id));
      },
    },
    table: { prompt: () => (report ? null : (tableNote ?? "Press E to open the latest report")), press: () => room && openReport(room) },
    lantern: {
      prompt: (at) => {
        const lan = roomView?.lanterns.find((l) => l.check === at.id);
        return !lan ? null : lanternOpen === lan.check ? LANTERN_WORDS.plate(lan.label, lan.reason) : LANTERN_WORDS.prompt(lan.label);
      },
      press: (at) => setLanternOpen((v) => (v === at.id ? null : at.id)),
    },
    // The rooms and the fields.
    shelves: { prompt: () => (whereOpen ? null : shelfPrompt), press: () => openPage(RECORDS_ROUTE) },
    dials: { prompt: () => (whereOpen ? null : dialsPrompt), press: () => openPage(MACRO_ROUTE) },
    // The Royal Mint: a lever moves one notch, the span post flips 1 and 3 years, the press stamps, the lectern opens the plain list.
    mintLever: {
      prompt: (at) => {
        const lever = mint.view.levers.find((l) => l.key === at.id);
        return lever ? MINT_WORDS.leverPrompt(lever.name) : null;
      },
      note: (at) => {
        const lever = mint.view.levers.find((l) => l.key === at.id);
        return lever ? leverReadout(lever, mint.view.leverState[lever.key] ?? -1) : null;
      },
      press: (at) => mint.pull(at.id),
    },
    mintPress: {
      prompt: () => (mint.view.wall === "loading" ? MINT_WORDS.pressBusy : mint.canStamp ? MINT_WORDS.pressPrompt : MINT_WORDS.pressNeedsPull),
      note: () => (mint.view.wall === "failed" ? MINT_WORDS.pressFailed : null),
      press: () => mint.stamp(),
    },
    mintSpan: { prompt: () => MINT_WORDS.spanPrompt(mint.view.horizon), press: () => mint.toggleSpan() },
    mintBook: {
      prompt: () => (plainOpen ? null : bookPrompt),
      press: () => {
        if (document.pointerLockElement) document.exitPointerLock();
        setPlainOpen(true);
      },
    },
    board: { prompt: (at) => (whereOpen ? null : hallPrompt(boardById(at.id))), press: (at) => openBoard(at.id) },
    fieldSpot: { prompt: (at) => (whereOpen ? null : fieldSpotPrompt(at.id, fieldTools)), press: (at) => workFieldSpot(at.id) },
    stall: {
      prompt: (at) => (whereOpen ? null : stallPrompt(quarter.stalls.find((s) => s.holdingId === at.id)?.name ?? "this company")),
      note: () => (quarter.overflow.length > 0 ? streetOverflowLine(quarter.overflow.length) : null),
      press: (at) => openStore(at.id),
    },
    // The way back out, whichever place you are in.
    leave: {
      prompt: () =>
        area.id === "holding"
          ? LAND_WORDS.gatePrompt
          : area.id === "siege"
            ? FIELD_WORDS.exitPrompt
            : area.id === "quarter"
              ? QUARTER_WORDS.exitPrompt
              : whereOpen
                ? null
                : area.id === "records"
                  ? archiveDoorPrompt
                  : area.id === "weather"
                    ? towerDoorPrompt
                    : area.id === "mint"
                      ? mintDoorPrompt
                      : hallDoorPrompt,
      press: leaveArea,
    },
  };
  // Looking back, only places that read stay open (the hourglass, the Realm post): every other place says it is shut and does nothing (#414).
  const shutAct: SpotAct<AtSpot> = { prompt: () => HOURGLASS_SHUT, press: () => {} };
  const spotAct =
    atSpot.kind === "none" ? null : inPast && !openInThePast(atSpot.kind) ? shutAct : (acts[atSpot.kind] as SpotAct<AtSpot>);
  // E waits while something covers the world: a page over a room or a field, the report in a holding's land.
  const eBlocked = boothOpen !== null || lampOpen || isMoving(areaState) || (area.id === "holding" ? !!report || !room : area.id !== "courtyard" && whereOpen);
  const pressSpot = useRef<(() => void) | null>(null);
  pressSpot.current = spotAct && !eBlocked ? () => spotAct.press(atSpot) : null;

  // The E key: does the one thing `atSpot` names (the prompt shows the same thing).
  useEffect(() => {
    const onE = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || typingInField(e.target as HTMLElement | null) || !pressSpot.current) return;
      e.preventDefault();
      pressSpot.current();
    };
    window.addEventListener("keydown", onE);
    return () => window.removeEventListener("keydown", onE);
  }, []);

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
  const goBack = leaveArea;

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
    hourglass: hourglassOpen,
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
          case "desk": return setSpotPanel("desk", false);
          case "drill": return setSpotPanel("drill", false);
          case "vault": return setSpotPanel("vault", false);
          case "realm": return setSpotPanel("realm", false);
          case "watch": return setSpotPanel("watch", false);
          case "perch": return setSpotPanel("perch", false);
          case "hourglass": return setSpotPanel("hourglass", false);
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
  }, [toggleWhere, closeWhere, goBack, layerKey, areaState, area.id, setSpotPanel]);

  // The marks (#412 step 2): one pure mapping from the stored facts. A source that did not report gives no mark, never calm.
  const nowMs = useMemo(() => Date.now(), [watchlist, nightWatch, state]); // eslint-disable-line react-hooks/exhaustive-deps
  // The sample fortress gets made-up marks from its own towers and stall names; no real fact reaches them.
  const sampleStalls = useMemo(() => quarter.stalls.map((s) => ({ holdingId: s.holdingId, ticker: s.ticker })), [quarter]);
  const lit = useMemo(
    () => (roundOff ? new Set(sampleLit(sampleStalls).map((s) => s.holdingId)) : litStalls(watchlist?.rows, nowMs)),
    [roundOff, sampleStalls, watchlist, nowMs],
  );
  const sheets = roundOff ? SAMPLE_SHEETS : noticeSheets(nightWatch, nowMs);
  const marks = useMemo(() => {
    if (roundOff) return sampleMarks(shownWorld.plain);
    const w = unseenWireIds(standing, standingFailed);
    return holdingMarks(shownWorld.plain, {
      recentRavenHoldingIds: recentRavenIds(ravens, seenRavens),
      unseenWireHoldingIds: w.ids,
      wiresUnmatched: w.unmatched,
      watchState: nightWatch?.watch_state ?? null,
      stallsRead: stallsRead(watchlist?.rows, nowMs),
    });
  }, [roundOff, shownWorld, ravens, seenRavens, standing, standingFailed, nightWatch, watchlist, nowMs]);
  const placedMarks = useMemo(() => placeMarks(shownWorld.towers, marks), [shownWorld, marks]);

  // Today's round: the same marks, written as a short list. The sample fortress shows a made-up one instead.
  const round = useMemo(() => {
    if (state === null) return undefined;
    if (roundOff) return sampleRound(shownWorld.plain, sampleStalls, new Set(sampleDone), nowMs, roundCarry.current);
    const names = new Map<string, string>();
    for (const r of ravens?.ravens ?? []) names.set(r.holding_id, r.name);
    for (const r of watchlist?.rows ?? []) names.set(r.holding_id, r.name);
    const standingPending = standing === null && !standingFailed;
    const pending = new Set<MarkSource>();
    if (!settled.ravens) pending.add("ravens");
    if (!settled.watch) pending.add("watch");
    if (!settled.stalls) pending.add("stalls");
    if (standingPending || !settled.watch) pending.add("wires");
    const litSet = litStalls(watchlist?.rows, nowMs);
    const tickers = new Map((watchlist?.rows ?? []).map((r) => [r.holding_id, r.ticker]));
    return buildRound(
      {
        towers: shownWorld.plain,
        marks,
        ravenFacts: ravenFactIds(ravens, seenRavens),
        wireFacts: wireFactIds(standing, standingFailed),
        lit: [...litSet].map((holdingId) => ({ holdingId, ticker: tickers.get(holdingId) ?? "" })),
        names,
        noticeSheets: noticeSheets(nightWatch, nowMs),
        noticeDay: nightWatch?.last_frame_day ?? null,
      },
      { done: new Set(roundDone), since: roundSince, nowMs, pending },
      roundCarry.current,
    );
  }, [roundOff, state, sampleStalls, sampleDone, ravens, seenRavens, watchlist, shownWorld, marks, standing, standingFailed, nightWatch, nowMs, roundDone, roundSince, settled]);
  useEffect(() => {
    if (roundOff) {
      const f = sampleRoundFacts(shownWorld.plain, sampleStalls);
      roundRef.current = {
        ravens: f.ravenFacts, wires: f.wireFacts, lit: new Set(f.lit.map((l) => l.holdingId)),
        noticeDay: f.noticeDay, noticeSheets: f.noticeSheets, stops: round?.stops ?? [],
      };
      return;
    }
    roundRef.current = {
      ravens: ravenFactIds(ravens, seenRavens),
      wires: wireFactIds(standing, standingFailed),
      lit: litStalls(watchlist?.rows, nowMs),
      noticeDay: nightWatch?.last_frame_day ?? null,
      noticeSheets: noticeSheets(nightWatch, nowMs),
      stops: round?.stops ?? [],
    };
  }, [roundOff, shownWorld, sampleStalls, ravens, seenRavens, standing, standingFailed, watchlist, nightWatch, nowMs, round]);
  // Remember the visit and what you dealt with (this browser only; nothing for the sample fortress).
  useEffect(() => {
    if (state === null) return;
    persistRound(guideStorage(), roundOff, { lastVisit: visitAt, done: pruneDone(roundDone, round?.stops ?? [], marks.sources) });
  }, [roundOff, state, visitAt, roundDone, round, marks]);
  // The bell is dealt with when you open that holding's thesis shelf in its land.
  useEffect(() => {
    if (!room || readShelf !== "oath") return;
    const id = stopId("bell", room, null);
    if (roundRef.current.stops.some((x) => x.id === id)) tickStops([id]);
  }, [room, readShelf, tickStops]);
  // Sample fortress only: walking into the land of the holding with smoke is where you look at its wire.
  useEffect(() => {
    if (!room || !roundOff) return;
    const hit: string[] = [];
    roundRef.current.wires.forEach((wid, h) => h === room && hit.push(stopId("smoke", h, wid)));
    tickStops(hit);
  }, [room, roundOff, tickStops]);

  // What the world shows from the facts (the scene takes them as one thing, not one input each).
  const look = useMemo<SceneLook>(
    () => ({
      // Looking back, the world draws only what the stored day held (vault, weather, towers). Today's facts (the desk's books,
      // the watch, ravens, marks, quest marks, the Standing) stay out of it rather than sit on a past yard.
      books: inPast ? 0 : quest.written,
      vaultLevel: viewState?.vault.level ?? null,
      watchStatus: inPast ? null : (nightWatch?.status ?? null),
      unseenRavens: inPast ? 0 : unseenRavens,
      realmLevel,
      siegeLevel: viewState?.siege?.level ?? null,
      drillOpen,
      questMarks: inPast ? [] : questMarks,
      talking,
      cheerKey,
      standingLevel: inPast ? null : standingText.lit,
      fieldTools,
      quarter,
      archCounts,
      marks: inPast ? NO_MARKS : placedMarks,
      litStalls: lit,
      archLit: archLit(lit),
      noticeSheets: inPast ? 0 : sheets,
      mint: mint.view,
    }),
    [inPast, viewState, mint.view, sheets, quest.written, nightWatch, unseenRavens, realmLevel, drillOpen, questMarks, talking, cheerKey, standingText.lit, fieldTools, quarter, archCounts, placedMarks, lit],
  );

  if (!supported) return <Unavailable />;

  /** The prompt is also a button: a tap does what the E key does. */
  const pressE = () => document.body.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE", bubbles: true }));

  // The prompt is the E key's own answer (`atSpot`), read from the same table, so it never promises something E does not do.
  const spotPrompt = spotAct ? spotAct.prompt(atSpot) : null;
  const spotNote = spotPrompt && spotAct?.note ? spotAct.note(atSpot) : null;


  // One Back button for every room (C2): the Town Hall, the Hall of Records, the Weather Tower and a holding's tower.
  const backOutside = roomView || inHall || inRecords || area.id === "weather" || area.id === "mint" ? leaveArea : null;
  // Any panel or dialog on screen: the hint line steps aside for it.
  const anyPanelOpen =
    panels.quests || panels.towers || whereOpen || vaultOpen || realmOpen || watchOpen || perchOpen || hourglassOpen || deskOpen || drillOpen || lampOpen || boothOpen !== null || report !== null;

  return (
    <div className="relative h-[calc(100dvh-5rem)] min-h-[480px] w-full overflow-hidden bg-surface">
      <SceneBoundary fallback={<Unavailable />}>
        <Suspense fallback={<p className="p-6 text-sm text-ink-muted">Raising the walls...</p>}>
          <Scene world={shownWorld} area={area} room={roomView} hold={isMoving(areaState)} look={look} onFieldPresets={onFieldPresets} onLockChange={setLocked} onStats={setStats} statsDetail={showPerf} />
        </Suspense>
      </SceneBoundary>

      <AreaFade phase={movePhase} plate={plate} />

      <Toolbar
        open={panels}
        onToggle={flip}
        roundOpen={roundChipCount(round)}
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
      {area.id === "mint" && plainOpen && <MintPlainPanel result={mint.view.result} stale={mint.view.wall === "stale"} onClose={() => setPlainOpen(false)} />}
      {whereOpen && !inPast && !worldPage && <WhereToPanel onPick={pickDoor} onClose={closeWhere} only={onlyPlace} onlyRoutes={onlyRoutes} />}
      {whereOpen && !inPast && worldPage && <WorldPanel door={worldPage} onBack={() => setWorldPage(null)} onClose={closeWhere} />}
      {panels.towers && <TowerPanel world={shownWorld} loading={loading} error={error} onRetry={load} onClose={() => flip("towers")} marks={inPast ? undefined : marks} lit={inPast ? undefined : lit} noticeSheets={inPast ? 0 : sheets} />}
      {panels.quests && !inPast && <QuestLog quest={quest} reviews={reviews} demo={world.demo} standing={standingText} wires={standing && !standingFailed ? (standing.wires ?? []) : undefined} onLookAtWire={lookAtWire} onRefreshStanding={refreshStanding} drill={drillQuest} guide={{ status: guide, saved: guideSaved, onReplay: replayGuideNow }} round={round} onRoundAgain={roundOff ? startSampleAgain : undefined} onClose={() => flip("quests")} />}
      {vaultOpen && state && <VaultPanel state={state} onChanged={load} onClose={() => setSpotPanel("vault", false)} />}
      {realmOpen && viewState && <RealmPanel state={viewState} onClose={() => setSpotPanel("realm", false)} />}
      {inPast && past && (
        <>
          {/* A still sand-coloured edge says "this is the past" without any motion. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: "inset 0 0 140px 24px rgba(226,194,122,0.32)" }} />
          <HourglassBanner day={past.day} status={past.status} playing={playing} onPlayToggle={playToggle} onToday={() => goToDay(null)} />
        </>
      )}
      {hourglassOpen && (
        <HourglassPanel
          status={history.status}
          demo={history.demo}
          timeline={timeline}
          day={pastDay}
          dayStatus={past?.status ?? null}
          turning={turning}
          playing={playing}
          onPick={goToDay}
          onEarlier={() => {
            const d = stepDay(timeline, pastDay, -1);
            if (d !== null) goToDay(d);
          }}
          onLater={() => goToDay(stepDay(timeline, pastDay, 1))}
          onPlayToggle={playToggle}
          onToday={() => goToDay(null)}
          onRetry={loadHistory}
          onClose={() => setSpotPanel("hourglass", false)}
        />
      )}
      {watchOpen && <WatchPanel onClose={() => setSpotPanel("watch", false)} />}
      {perchOpen && ravens && <RavensPanel ravens={ravens} seen={seenRavens} onSeen={onRavensSeen} onClose={() => setSpotPanel("perch", false)} />}
      {deskOpen && (
        // Hidden, not unmounted, while the old books are open: what you typed stays where it is.
        <div style={{ display: booksOpen ? "none" : "contents" }}>
        <DeskPanel
          holdings={world.plain}
          missing={quest.missing}
          written={quest.written}
          block={deskBlock(world.demo, quest.status)}
          onSave={saveAtDesk}
          onClose={() => setSpotPanel("desk", false)}
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
            setSpotPanel("desk", false);
          }}
        />
      )}
      {lampOpen && <MagicLamp embedded onClose={() => setLampOpen(false)} />}
      {drillOpen && (
        <DrillPanel
          count={drillQuest.count}
          block={drillBlock(drillQuest)}
          onSave={saveDrill}
          onClose={() => setSpotPanel("drill", false)}
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
