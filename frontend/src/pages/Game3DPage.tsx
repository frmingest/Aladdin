import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import type { DocumentSummary, GameState, Watchlist, Journal, JournalEntryInput, Standing, StormDrillInput, StormDrills } from "../lib/types";
import { DocumentReader } from "../components/DocumentReader";
import { latestReport } from "../game3d/libraryReport";
import SceneBoundary from "../game3d/SceneBoundary";
import TowerPanel from "../game3d/TowerPanel";
import QuestLog from "../game3d/QuestLog";
import DialoguePanel from "../game3d/DialoguePanel";
import DeskPanel from "../game3d/DeskPanel";
import DrillPanel from "../game3d/DrillPanel";
import WhereToPanel from "../game3d/WhereToPanel";
import WorldPanel from "../game3d/WorldPanel";
import type { Door } from "../game3d/parity3d";
import { PLAIN_VIEW, PLAIN_VIEW_TITLE, SIGN_PROMPT } from "../game3d/worldWordsV1";
import { drillBlock, stormDrillQuest } from "../game3d/stormDrill";
import { DRILL_PROMPT } from "../game3d/stormDrillWordsV1";
import ShelfPanel from "../game3d/ShelfPanel";
import { shelvesFor } from "../game3d/libraryShelves";
import type { ShelfId } from "../game3d/libraryShelves";
import type { RoomView } from "../game3d/Scene";
import { deskBlock } from "../game3d/deskForm";
import Toolbar from "../game3d/Toolbar";
import { typingInField } from "../game3d/useKeys";
import { stallPrompt, storeDoor } from "../game3d/stallDoor";
import { BUILDINGS, buildingPrompt, doorAction, exitPrompt, gatePrompt } from "../game3d/townPlan";
import type { BuildingId } from "../game3d/townPlan";
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
  const [room, setRoom] = useState<string | null>(null);
  // The Town beyond the gate: whether you are in it, and which door or the gate road you stand at.
  const [inTown, setInTown] = useState(false);
  const [atGate, setAtGate] = useState(false);
  const [townNear, setTownNear] = useState<BuildingId | null>(null);
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
  }, []);

  // After a desk entry is saved, read the journal and the Standing again: the shelf and the level are
  // worked out from the facts, never from "I just saved".
  const saveAtDesk = useCallback(async (input: JournalEntryInput) => {
    await api.createJournalEntry(input);
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
    document.title = "3D courtyard · Aladdin";
    if (supported) load();
  }, [supported, load]);

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


  // The library you are in: the stored row for that holding, turned into six shelves. Nothing is stored here.
  const roomView = useMemo<RoomView | null>(() => {
    if (!room || !state) return null;
    const tower = state.towers.find((t) => t.holding_id === room);
    const view = shownWorld.plain.find((t) => t.holdingId === room);
    if (!tower || !view) return null;
    return { holdingId: room, name: tower.name, ticker: tower.ticker, gap: view.gap ?? null, shelves: shelvesFor(tower) };
  }, [room, state, shownWorld]);
  // A fresh load that drops the tower (or the state) puts you back outside rather than in an empty room.
  useEffect(() => {
    if (room && !roomView) setRoom(null);
  }, [room, roomView]);

  // Opening the menu frees the mouse so the buttons can be clicked; shutting it never leaves a page open.
  const toggleWhere = useCallback(() => {
    setWhereOpen((open) => {
      if (!open && document.pointerLockElement) document.exitPointerLock();
      return !open;
    });
    setWorldPage(null);
    setOnlyPlace(null);
  }, []);
  const closeWhere = useCallback(() => {
    setWhereOpen(false);
    setWorldPage(null);
    setOnlyPlace(null);
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
    setAtDrill(false);
    setAtSign(false);
    setNearStall(null);
    setNearBooth(null);
    setNearTower(null);
    setAtGate(false);
    setTownNear(null);
    setAtTownExit(false);
  }, []);
  const enterTown = useCallback(() => {
    clearNears();
    setDeskOpen(false);
    setDrillOpen(false);
    setInTown(true);
  }, [clearNears]);
  const leaveTown = useCallback(() => {
    clearNears();
    setInTown(false);
  }, [clearNears]);
  // E at a building: its page in the world panel, or (the Workshop) the menu of its place.
  const openBuilding = useCallback((id: BuildingId) => {
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
  }, []);

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
    setRoom(id);
  }, []);
  const leaveTower = useCallback(() => {
    setReadShelf(null);
    setNearShelf(null);
    setAtDoor(false);
    setAtTable(false);
    setReport(null);
    setTableNote(null);
    setRoom(null);
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

  // Walking away from the drill post ends the drill (the camp goes); so does starting a talk.
  useEffect(() => {
    if (drillOpen && (!atDrill || talking)) setDrillOpen(false);
  }, [atDrill, drillOpen, talking]);

  // Walking away ends the talk.
  useEffect(() => {
    if (talking && near !== talking) setTalking(null);
  }, [near, talking]);

  useEffect(() => {
    const onTalk = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const el = e.target as HTMLElement | null;
      if (typingInField(el)) return;
      if (boothOpen) return;
      if (inTown) {
        // In the Town: E knocks at the door you stand at, or takes the road back.
        if (whereOpen) return;
        if (!townNear && !atTownExit) return;
        e.preventDefault();
        if (townNear) openBuilding(townNear);
        else leaveTown();
        return;
      }
      if (room) {
        // Inside a tower: E reads the shelf you stand at, opens the latest report at the table, or takes the door back out.
        if (report) return;
        if (!nearShelf && !atDoor && !atTable) return;
        e.preventDefault();
        if (!nearShelf && atTable) openReport(room);
        else if (nearShelf) {
          if (readShelf !== nearShelf && document.pointerLockElement) document.exitPointerLock();
          setReadShelf((v) => (v === nearShelf ? null : nearShelf));
        } else leaveTower();
        return;
      }
      if (!near && !nearTower && !atDesk && !atDrill && !atSign && !nearStall && !nearBooth && !atGate) return;
      e.preventDefault();
      if (!near && nearTower) {
        enterTower(nearTower);
        return;
      }
      if (!near) {
        if (!atDesk && !atDrill && !atSign && !nearStall && !nearBooth && atGate) {
          enterTown();
          return;
        }
        if (!atDesk && !atDrill && !atSign && !nearStall && nearBooth) {
          openBooth(nearBooth);
          return;
        }
        if (!atDesk && !atDrill && !atSign && nearStall) {
          openStore(nearStall);
          return;
        }
        if (!atDesk && !atDrill) {
          // Only the signpost is in reach: E opens or shuts the "Where to?" menu.
          toggleWhere();
          return;
        }
        if (!atDesk) {
          // Only the drill post is in reach: E starts or ends a drill.
          if (!drillOpen && document.pointerLockElement) document.exitPointerLock();
          setDrillOpen((v) => !v);
          return;
        }
        // Only the desk is in reach: E opens or closes it.
        if (!deskOpen && document.pointerLockElement) document.exitPointerLock();
        setDeskOpen((v) => !v);
        return;
      }
      if (talking) {
        setTalking(null);
      } else {
        // Free the mouse so the Close and Try again buttons can be clicked.
        if (document.pointerLockElement) document.exitPointerLock();
        setTalking(near);
      }
    };
    window.addEventListener("keydown", onTalk);
    return () => window.removeEventListener("keydown", onTalk);
  }, [inTown, whereOpen, townNear, atTownExit, atGate, openBuilding, leaveTown, enterTown, near, talking, atDesk, atDrill, atSign, nearStall, nearBooth, boothOpen, openBooth, openStore, toggleWhere, drillOpen, deskOpen, room, nearShelf, atDoor, atTable, report, readShelf, nearTower, enterTower, leaveTower, openReport]);

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

  return (
    <div className="relative h-[calc(100dvh-5rem)] min-h-[480px] w-full overflow-hidden bg-surface">
      <SceneBoundary fallback={<Unavailable />}>
        <Suspense fallback={<p className="p-6 text-sm text-ink-muted">Raising the walls...</p>}>
          <Scene
            world={shownWorld}
            standingLevel={standingText.lit}
            onLockChange={setLocked}
            onStats={setStats}
            onNear={setNear}
            near={near}
            books={quest.written}
            onNearDesk={setAtDesk}
            onNearDrill={setAtDrill}
            onNearSign={setAtSign}
            onNearStall={setNearStall}
            onNearBooth={setNearBooth}
            drillOpen={drillOpen}
            stalls={street.stalls}
            talking={talking}
            cheerKey={cheerKey}
            onNearTower={setNearTower}
            room={roomView}
            onNearShelf={setNearShelf}
            onNearTable={setAtTable}
            onNearDoor={setAtDoor}
            inTown={inTown}
            onNearGate={setAtGate}
            townNear={townNear}
            onNearBuilding={setTownNear}
            onNearTownExit={setAtTownExit}
          />
        </Suspense>
      </SceneBoundary>

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
      {whereOpen && !worldPage && <WhereToPanel onPick={pickDoor} onClose={closeWhere} only={onlyPlace} />}
      {whereOpen && worldPage && <WorldPanel door={worldPage} onBack={() => setWorldPage(null)} onClose={closeWhere} />}
      {panels.towers && <TowerPanel world={shownWorld} loading={loading} error={error} onRetry={load} onClose={() => flip("towers")} />}
      {panels.quests && <QuestLog quest={quest} reviews={reviews} demo={world.demo} standing={standingText} wires={standing && !standingFailed ? (standing.wires ?? []) : undefined} onLookAtWire={lookAtWire} onRefreshStanding={refreshStanding} drill={drillQuest} onClose={() => flip("quests")} />}
      {deskOpen && (
        <DeskPanel
          holdings={world.plain}
          missing={quest.missing}
          written={quest.written}
          block={deskBlock(world.demo, quest.status)}
          onSave={saveAtDesk}
          onClose={() => setDeskOpen(false)}
        />
      )}
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

      {inTown && (
        <button
          type="button"
          onClick={leaveTown}
          className="absolute left-3 top-14 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
        >
          ← Back to the courtyard
        </button>
      )}
      {inTown && !whereOpen && townNear && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {buildingPrompt(BUILDINGS.find((b) => b.id === townNear) ?? BUILDINGS[0])}
        </p>
      )}
      {inTown && !whereOpen && !townNear && atTownExit && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {exitPrompt}
        </p>
      )}
      {!inTown && atGate && !whereOpen && !talking && !nearTower && !atSign && !atDesk && !atDrill && !nearStall && !nearBooth && !room && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {gatePrompt}
        </p>
      )}

      {!room && nearTower && !near && !talking && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          Press E to go into {world.plain.find((t) => t.holdingId === nearTower)?.name ?? "the tower"}
        </p>
      )}
      {room && nearShelf && !readShelf && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          Press E to read {roomView?.shelves.find((s) => s.id === nearShelf)?.title ?? "the shelf"}
        </p>
      )}
      {room && atTable && !nearShelf && !report && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {tableNote ?? "Press E to open the latest report"}
        </p>
      )}
      {room && atDoor && !nearShelf && !atTable && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          Press E to go back outside
        </p>
      )}

      {atDesk && !deskOpen && !talking && !nearTower && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          Press E to write at the desk
        </p>
      )}

      {atDrill && !drillOpen && !talking && !nearTower && !atDesk && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {DRILL_PROMPT}
        </p>
      )}

      {nearStall && !whereOpen && !talking && !nearTower && !atSign && !atDesk && !atDrill && !room && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          {stallPrompt(street.stalls.find((s) => s.holdingId === nearStall)?.name ?? "this company")}
          {street.overflow.length > 0 && <span className="block text-xs opacity-80">{streetOverflowLine(street.overflow.length)}</span>}
        </p>
      )}

      {nearBooth && !boothOpen && !whereOpen && !talking && !nearTower && !nearStall && !atSign && !atDesk && !atDrill && !room && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          {boothPrompt(nearBooth)}
        </p>
      )}

      {boothOpen === "sal" && <SalesRepDialog demoMode={demoMode === true} rows={watchlist?.rows ?? []} onClose={closeBooth} onAdded={setWatchlist} />}
      {boothOpen === "hype" && <HypeBoothDialog demoMode={demoMode === true} rows={watchlist?.rows ?? []} onClose={closeBooth} onAdded={setWatchlist} />}

      {atSign && !whereOpen && !talking && !nearTower && !atDesk && !atDrill && !room && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          {SIGN_PROMPT}
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
