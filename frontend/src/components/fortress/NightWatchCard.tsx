import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { STATUS_CLASS, STATUS_LABEL, TONE_CLASS, TONE_MARK, WATCH_STATE_LABEL, stampLine } from "../../lib/nightWatch";
import type { NightWatch } from "../../lib/types";
import { Card } from "../ui";

/** Game mode G16, Night Watch: the nightly tripwire check as a morning dispatch. It reads what the
 * worker stored overnight (GET /game/night-watch) and never runs a check, calls a provider or tells
 * you to trade. A watch that has not reported in is "not reporting", never "quiet". */
export default function NightWatchCard() {
  const [watch, setWatch] = useState<NightWatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getNightWatch()
      .then((w) => live && setWatch(w))
      .catch((e: unknown) => live && setError(e instanceof ApiError ? e.message : "Could not load the dispatch."));
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <Card className="py-3 text-sm text-ink-muted">
        <h2 className="section-title">Night Watch</h2>
        <p>{error}</p>
      </Card>
    );
  }
  if (!watch) return null;

  return (
    <Card aria-label="Night Watch dispatch">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="section-title mb-0">Night Watch</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[watch.status]}`}>
          {STATUS_LABEL[watch.status]}
        </span>
        {watch.demo && (
          <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">Demo data</span>
        )}
        <span className="text-xs text-ink-faint">{WATCH_STATE_LABEL[watch.watch_state]}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-ink">{watch.headline}</p>
      <p className="text-xs text-ink-faint">{stampLine(watch)}</p>

      <ul className="mt-3 divide-y divide-border-subtle">
        {watch.lines.map((line, i) => (
          <li key={`${line.tone}-${i}`} className="flex gap-3 py-2 text-sm">
            <span className={`w-4 shrink-0 text-center font-bold ${TONE_CLASS[line.tone]}`} aria-hidden>
              {TONE_MARK[line.tone]}
            </span>
            <div className="min-w-0">
              <p className={line.tone === "warning" ? "font-medium text-ink" : "text-ink-muted"}>
                {line.holding_id && line.holding_name ? (
                  <>
                    <Link to={`/holdings/${line.holding_id}`} className="text-accent hover:underline">
                      {line.holding_name}
                    </Link>
                    {": "}
                    {line.text}
                  </>
                ) : (
                  line.text
                )}
              </p>
              {line.facts.length > 0 && <p className="text-xs text-ink-faint">{line.facts.join(" · ")}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">
        A reading of what the worker stored. It never runs the check itself and never says what to do.{" "}
        <Link to="/fortress/chronicle" className="text-accent hover:underline">
          Open the Chronicle
        </Link>
      </p>
    </Card>
  );
}
