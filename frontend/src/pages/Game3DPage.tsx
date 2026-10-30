import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SceneBoundary from "../game3d/SceneBoundary";
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
 * 3D courtyard (prototype, week 1): a walled courtyard you can walk round with
 * W A S D and the mouse. No portfolio data yet; the flat Fortress stays the
 * full-fidelity view and the fallback.
 */
export default function Game3DPage() {
  const supported = useMemo(webglSupported, []);
  const [locked, setLocked] = useState(false);
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [showPerf, setShowPerf] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F3") {
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
          <Scene onLockChange={setLocked} onStats={setStats} />
        </Suspense>
      </SceneBoundary>

      <Link
        to="/fortress"
        className="absolute left-3 top-3 rounded border border-border bg-surface/90 px-3 py-1.5 text-sm text-ink hover:opacity-80"
      >
        ← Flat fortress
      </Link>

      {!locked && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded bg-black/60 px-4 py-2 text-center text-sm text-white">
          Click to look around · W A S D walk · Shift run · Space jump · Wheel zoom · Esc frees the mouse
        </p>
      )}

      {showPerf && stats && (
        <p className="pointer-events-none absolute right-3 top-3 rounded bg-black/60 px-3 py-1.5 font-mono text-xs text-white">
          {stats.fps} fps · {stats.calls} draws · {Math.round(stats.triangles / 1000)}k tris
        </p>
      )}
    </div>
  );
}
