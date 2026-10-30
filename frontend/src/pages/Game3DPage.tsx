import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import type { GameState, Journal } from "../lib/types";
import SceneBoundary from "../game3d/SceneBoundary";
import TowerPanel from "../game3d/TowerPanel";
import QuestLog from "../game3d/QuestLog";
import DialoguePanel from "../game3d/DialoguePanel";
import { unwrittenThesis } from "../game3d/quest";
import type { NpcId } from "../game3d/npcs";
import { stateToWorld } from "../game3d/stateToWorld";
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
 * 3D courtyard (prototype, week 3): a walled courtyard you can walk round with
 * W A S D and the mouse. Each holding from /game/state stands on a pad as a
 * tower; the facts are in the side panel. The Oracle and the Partner stand in the
 * courtyard (press E near them); the one quest is read from the decision journal. The flat Fortress stays the
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
  const [journalFailed, setJournalFailed] = useState(false);
  const [near, setNear] = useState<NpcId | null>(null);
  const [talking, setTalking] = useState<NpcId | null>(null);

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
  }, []);

  useEffect(() => {
    document.title = "3D courtyard · Aladdin";
    if (supported) load();
  }, [supported, load]);

  // Never invent towers: no state means bare pads.
  const world = useMemo(() => stateToWorld(state), [state]);
  // The quest is worked out from the journal every render; nothing about it is stored.
  const quest = useMemo(
    () =>
      unwrittenThesis(
        world.plain,
        state === null ? null : (journal?.entries ?? null),
        journalFailed || (state === null && error !== null),
      ),
    [world, state, error, journal, journalFailed],
  );


  // Walking away ends the talk.
  useEffect(() => {
    if (talking && near !== talking) setTalking(null);
  }, [near, talking]);

  useEffect(() => {
    const onTalk = (e: KeyboardEvent) => {
      if (e.code !== "KeyE" || !near) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
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
  }, [near, talking]);

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
          <Scene world={world} onLockChange={setLocked} onStats={setStats} onNear={setNear} near={near} />
        </Suspense>
      </SceneBoundary>

      <TowerPanel world={world} loading={loading} error={error} onRetry={load} />
      <QuestLog quest={quest} demo={world.demo} />
      {talking && <DialoguePanel npc={talking} quest={quest} onClose={() => setTalking(null)} onRetry={load} />}

      <Link
        to="/fortress"
        className="absolute left-3 top-3 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
      >
        ← Flat fortress
      </Link>

      {!locked && !talking && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          Click to look around · W A S D walk · Shift run · Space jump · Wheel zoom · Esc frees the mouse
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowPerf((v) => !v)}
        aria-pressed={showPerf}
        className="absolute right-3 top-3 rounded border border-border bg-surface/90 px-3 py-1.5 text-xs text-ink hover:opacity-80"
      >
        {showPerf ? (stats ? `${stats.fps} fps · ${stats.calls} draws · ${Math.round(stats.triangles / 1000)}k tris` : "Measuring...") : "Stats (P)"}
      </button>
    </div>
  );
}
