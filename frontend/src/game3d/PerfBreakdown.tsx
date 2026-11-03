import { groupLine, topGroups } from "./perfGroups";
import type { PerfStats } from "./PerfProbe";

/**
 * Under the toolbar while the stats are on (P): memory, and which part of the scene owns the draw calls.
 * For measuring only; the numbers are the same for every holding and say nothing about any of them.
 */
export default function PerfBreakdown({ stats }: { stats: PerfStats | null }) {
  if (!stats) return null;
  const { shown, more } = topGroups(stats.groups ?? [], 10);
  const counted = (stats.groups ?? []).reduce((sum, g) => sum + g.calls, 0);
  return (
    <div
      role="status"
      aria-label="Stats detail"
      className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-md bg-black/70 px-3 py-2 font-mono text-xs leading-5 text-white"
    >
      <div>
        {stats.geometries ?? "?"} shapes · {stats.textures ?? "?"} textures in memory
      </div>
      {shown.length === 0 ? (
        <div>Counting parts...</div>
      ) : (
        <>
          {shown.map((g) => (
            <div key={g.group}>{groupLine(g)}</div>
          ))}
          {more > 0 && <div>{more} more</div>}
          <div>
            parts add up to {counted} of {stats.calls} draws
          </div>
        </>
      )}
    </div>
  );
}
