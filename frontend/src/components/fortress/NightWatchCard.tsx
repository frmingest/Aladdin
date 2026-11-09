import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { describeError } from "../../lib/errors";
import { STATUS_CLASS, STATUS_LABEL, TONE_CLASS, TONE_MARK, WATCH_STATE_LABEL, stampLine } from "../../lib/nightWatch";
import { useGameMode } from "../../lib/gameMode";
import type { NightWatch } from "../../lib/types";
import { Card, Disclosure } from "../ui";
import DispatchDisclosure from "./DispatchDisclosure";
import WatchBeacon from "./kit/WatchBeacon";
import { WATCH_STATE_V2, WATCH_STATUS_V2, WATCH_V2, stampLineV2, type Voice } from "../../game3d/vaultWatchWordsV2";
import { gameWatchText } from "../../game3d/watchLinesWordsV1";

/** Game mode G16, Night Watch: the nightly tripwire check as a morning dispatch. It reads what the
 * worker stored overnight (GET /game/night-watch) and never runs a check, calls a provider or tells
 * you to trade. A watch that has not reported in is "not reporting", never "quiet". */
export default function NightWatchCard({ voice = "flat" }: { voice?: Voice } = {}) {
  const g = voice === "game";
  const stamp = (w: NightWatch) => (g ? stampLineV2(w) : stampLine(w));
  const [watch, setWatch] = useState<NightWatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { gameMode } = useGameMode();

  useEffect(() => {
    let live = true;
    api
      .getNightWatch()
      .then((w) => live && setWatch(w))
      .catch((e: unknown) => live && setError(describeError(e, "the dispatch").message));
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
  // Reserve the room a quiet night takes while the dispatch loads: this card sits above the
  // scene, so popping in later used to push the whole scene down (layout shift 0.35 on a phone).
  if (!watch) {
    return (
      <Card className="min-h-[6.5rem] py-3">
        <div aria-busy="true">
          <h2 className="section-title">Night Watch</h2>
          <p className="text-xs text-ink-faint">{g ? WATCH_V2.loading : "Reading the overnight dispatch…"}</p>
        </div>
      </Card>
    );
  }

  // A quiet night is one line plus the new-report line; the rest is one click away (UX noise audit).
  const quiet = watch.status === "quiet" && !watch.lines.some((l) => l.tone === "warning");
  const reportLines = quiet ? watch.lines.filter((l) => l.text.includes("new report")) : [];
  const detailLines = quiet ? watch.lines.filter((l) => !l.text.includes("new report")) : watch.lines;

  const details = (
    <>
      <p className="text-sm font-medium text-ink">{g ? gameWatchText(watch.headline) : watch.headline}</p>
      <LineList lines={detailLines} game={g} />
      <DispatchNote game={g} />
    </>
  );

  return (
    <Card aria-label="Night Watch dispatch">
      <div className="flex items-start gap-3">
      <WatchBeacon status={watch.status} watchState={watch.watch_state} />
      <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="section-title mb-0">Night Watch</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[watch.status]}`}>
          {g ? WATCH_STATUS_V2[watch.status] : STATUS_LABEL[watch.status]}
        </span>
        {watch.demo && (
          <span className="rounded-full bg-caution-subtle px-2.5 py-0.5 text-xs font-semibold text-caution">{g ? WATCH_V2.demo : "Demo data"}</span>
        )}
        <span className="text-xs text-ink-faint">{g ? WATCH_STATE_V2[watch.watch_state] : WATCH_STATE_LABEL[watch.watch_state]}</span>
      </div>
      {quiet ? (
        <>
          <p className="mt-1 text-xs text-ink-faint">{stamp(watch)}</p>
          <LineList lines={reportLines} game={g} />
          {gameMode ? (
            <DispatchDisclosure lineCount={detailLines.length}>{details}</DispatchDisclosure>
          ) : (
            <Disclosure label="the dispatch details" level="evidence" className="mt-2">
              {details}
            </Disclosure>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-ink">{g ? gameWatchText(watch.headline) : watch.headline}</p>
          <p className="text-xs text-ink-faint">{stamp(watch)}</p>
          <LineList lines={detailLines} game={g} />
          <DispatchNote game={g} />
        </>
      )}
      </div>
      </div>
    </Card>
  );
}

function DispatchNote({ game = false }: { game?: boolean }) {
  return (
    <p className="mt-2 text-xs text-ink-faint">
      {game ? WATCH_V2.note : "A reading of what the worker stored. It never runs the check itself and never says what to do."}
    </p>
  );
}

function LineList({ lines, game = false }: { lines: NightWatch["lines"]; game?: boolean }) {
  const say = (t: string) => (game ? gameWatchText(t) : t);
  if (lines.length === 0) return null;
  return (
    <ul className="mt-2 divide-y divide-border-subtle">
      {lines.map((line, i) => (
        <li key={`${line.tone}-${i}`} className="flex gap-3 py-2 text-sm">
          <span className={`w-4 shrink-0 text-center font-bold ${TONE_CLASS[line.tone]}`} aria-hidden>
            {TONE_MARK[line.tone]}
          </span>
          <div className="min-w-0">
            <p className={line.tone === "warning" ? "font-medium text-ink" : "text-ink-muted"}>
              {line.holding_id && line.holding_name ? (
                <>
                  <Link to={`/holdings/${line.holding_id}`} className="text-accent underline underline-offset-2">
                    {line.holding_name}
                  </Link>
                  {": "}
                  {say(line.text)}
                </>
              ) : (
                say(line.text)
              )}
            </p>
            {line.facts.length > 0 && <p className="text-xs text-ink-faint">{line.facts.map(say).join(" · ")}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
