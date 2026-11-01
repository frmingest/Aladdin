import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import type { GameState, Journal, JournalEntryInput, Standing } from "../lib/types";
import SceneBoundary from "../game3d/SceneBoundary";
import TowerPanel from "../game3d/TowerPanel";
import QuestLog from "../game3d/QuestLog";
import DialoguePanel from "../game3d/DialoguePanel";
import DeskPanel from "../game3d/DeskPanel";
import ShelfPanel from "../game3d/ShelfPanel";
import { shelvesFor } from "../game3d/libraryShelves";
import type { ShelfId } from "../game3d/libraryShelves";
import type { RoomView } from "../game3d/Scene";
import { deskBlock } from "../game3d/deskForm";
import Toolbar from "../game3d/Toolbar";
import { PANEL_KEYS, loadPanels, savePanels, togglePanel } from "../game3d/hudPanels";
import type { PanelId } from "../game3d/hudPanels";
import { celebrationDue } from "../game3d/celebrate";
import { sixMonthReckoning } from "../game3d/quest";
import { unwrittenThesisV2 } from "../game3d/questV2";
import type { NpcId } from "../game3d/npcs";
import { stateToWorld } from "../game3d/stateToWorld";
import { withGaps } from "../game3d/standingGaps";
import { wordsFor } from "../game3d/standingWordsV2";
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
  // The tower library: which door you stand at, which tower you are inside, and what you stand at in there.
  const [nearTower, setNearTower] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [nearShelf, setNearShelf] = useState<ShelfId | null>(null);
  const [atDoor, setAtDoor] = useState(false);
  const [readShelf, setReadShelf] = useState<ShelfId | null>(null);
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

  const enterTower = useCallback((id: string) => {
    if (document.pointerLockElement) {
      // Keep the mouse look going through the door: only free it if something else is open.
    }
    setTalking(null);
    setDeskOpen(false);
    setNear(null);
    setAtDesk(false);
    setNearTower(null);
    setNearShelf(null);
    setAtDoor(false);
    setReadShelf(null);
    setRoom(id);
  }, []);
  const leaveTower = useCallback(() => {
    setReadShelf(null);
    setNearShelf(null);
    setAtDoor(false);
    setRoom(null);
  }, []);

  // Walking away from a shelf closes its page.
  useEffect(() => {
    if (readShelf && nearShelf !== readShelf) setReadShelf(null);
  }, [nearShelf, readShelf]);

  // Walking away from the desk closes it; so does starting a talk.
  useEffect(() => {
    if (deskOpen && (!atDesk || talking)) setDeskOpen(false);
  }, [atDesk, deskOpen, talking]);

  // Walking away ends the talk.
  useEffect(() => {
    if (talking && near !== talking) setTalking(null);
  }, [near, talking]);

  useEffect(() => {
    const onTalk = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (room) {
        // Inside a tower: E reads the shelf you stand at, or takes the door back out.
        if (!nearShelf && !atDoor) return;
        e.preventDefault();
        if (nearShelf) {
          if (readShelf !== nearShelf && document.pointerLockElement) document.exitPointerLock();
          setReadShelf((v) => (v === nearShelf ? null : nearShelf));
        } else leaveTower();
        return;
      }
      if (!near && !nearTower && !atDesk) return;
      e.preventDefault();
      if (!near && nearTower) {
        enterTower(nearTower);
        return;
      }
      if (!near) {
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
  }, [near, talking, atDesk, deskOpen, room, nearShelf, atDoor, readShelf, nearTower, enterTower, leaveTower]);

  useEffect(() => {
    const onPanelKey = (e: KeyboardEvent) => {
      const id = PANEL_KEYS[e.code];
      if (!id || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      flip(id);
    };
    window.addEventListener("keydown", onPanelKey);
    return () => window.removeEventListener("keydown", onPanelKey);
  }, [flip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // F3 is often grabbed by the browser or editor ("find"), so P works too.
      if (e.code === "F3" || e.code === "KeyP") {
        e.preventDefault();
        setShowPerf((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            talking={talking}
            cheerKey={cheerKey}
            onNearTower={setNearTower}
            room={roomView}
            onNearShelf={setNearShelf}
            onNearDoor={setAtDoor}
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
      />
      {panels.towers && <TowerPanel world={shownWorld} loading={loading} error={error} onRetry={load} onClose={() => flip("towers")} />}
      {panels.quests && <QuestLog quest={quest} reviews={reviews} demo={world.demo} standing={standingText} wires={standing && !standingFailed ? (standing.wires ?? []) : undefined} onLookAtWire={lookAtWire} onRefreshStanding={refreshStanding} onClose={() => flip("quests")} />}
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
      {roomView && readShelf && (
        <ShelfPanel name={roomView.name} open={readShelf} shelves={roomView.shelves} demo={world.demo} onClose={() => setReadShelf(null)} />
      )}
      {talking && <DialoguePanel npc={talking} quest={quest} reviews={reviews} onClose={() => setTalking(null)} onRetry={load} />}

      <Link
        to="/fortress"
        className="absolute left-3 top-3 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
      >
        ← Flat fortress
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
      {room && atDoor && !nearShelf && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          Press E to go back outside
        </p>
      )}

      {atDesk && !deskOpen && !talking && !nearTower && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 w-max -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-sm text-white">
          Press E to write at the desk
        </p>
      )}

      {!locked && !talking && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          Click to look around · W A S D walk · Shift run · Space jump · Wheel zoom · Esc frees the mouse · Q quests · T towers
        </p>
      )}
    </div>
  );
}
