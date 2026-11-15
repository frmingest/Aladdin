import {
  HOURGLASS_EARLIER,
  HOURGLASS_EMPTY,
  HOURGLASS_FRAME_FAILED,
  HOURGLASS_GAP,
  HOURGLASS_INTRO,
  HOURGLASS_KEPT,
  HOURGLASS_LATER,
  HOURGLASS_LOADING,
  HOURGLASS_NIGHT_GAP,
  HOURGLASS_PANEL_TITLE,
  HOURGLASS_PAUSE,
  HOURGLASS_PLAY,
  HOURGLASS_RECORD,
  HOURGLASS_RETRY,
  HOURGLASS_SAMPLE,
  HOURGLASS_SLIDER,
  HOURGLASS_STRIP,
  HOURGLASS_TODAY,
  HOURGLASS_UNREADABLE,
} from "./hourglassWordsV1";
import { dayLabel } from "./hourglassPlan";
import type { TimelineDay } from "./hourglassPlan";
import { PANEL_CLOSE } from "./watchWordsV1";

export type HistoryStatus = "idle" | "loading" | "ready" | "failed";
/** What the day on screen turned out to be: a stored picture, a gap (nothing stored) or one that could not be read. */
export type DayStatus = "frame" | "gap" | "failed";

/** How many of the newest nights get a button each (the daily frames the backend keeps are the last 90). */
const STRIP_NIGHTS = 90;

interface Props {
  status: HistoryStatus;
  demo: boolean;
  timeline: readonly TimelineDay[];
  /** The night on screen; null is today. */
  day: string | null;
  dayStatus: DayStatus | null;
  /** A day is being read. */
  turning: boolean;
  playing: boolean;
  onPick: (day: string) => void;
  onEarlier: () => void;
  onLater: () => void;
  onPlayToggle: () => void;
  onToday: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * The Hourglass panel (#414): step or play through the stored nights, see the gaps as gaps. It only chooses a day; the
 * page draws that day with the same `stateToWorld` as today. Nothing here writes anything.
 */
export default function HourglassPanel(p: Props) {
  const gaps = p.timeline.filter((t) => !t.stored).length;
  const kept = p.timeline.length - gaps;
  const index = p.day === null ? -1 : p.timeline.findIndex((t) => t.day === p.day);
  const strip = p.timeline.slice(-STRIP_NIGHTS);
  return (
    <aside
      aria-label={HOURGLASS_PANEL_TITLE}
      className="g3d-panel absolute inset-x-3 top-14 z-40 flex max-h-[calc(100%-4.5rem)] flex-col overflow-hidden p-2 text-sm md:inset-x-[25%]"
    >
      <header className="g3d-head">
        <h2>{HOURGLASS_PANEL_TITLE}</h2>
        <button type="button" className="g3d-x" aria-label={PANEL_CLOSE} onClick={p.onClose}>×</button>
      </header>
      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto rounded bg-surface p-3">
        <p className="text-ink-muted">{HOURGLASS_INTRO}</p>
        {p.status === "loading" && <p role="status">{HOURGLASS_LOADING}</p>}
        {p.status === "failed" && (
          <p role="alert">
            {HOURGLASS_UNREADABLE}{" "}
            <button type="button" className="g3d-btn" onClick={p.onRetry}>{HOURGLASS_RETRY}</button>
          </p>
        )}
        {p.status === "ready" && p.demo && <p>{HOURGLASS_SAMPLE}</p>}
        {p.status === "ready" && !p.demo && p.timeline.length === 0 && <p>{HOURGLASS_EMPTY}</p>}
        {p.status === "ready" && !p.demo && p.timeline.length > 0 && (
          <>
            <p className="text-base font-semibold text-ink" aria-live="polite">
              {p.day === null ? "Today" : dayLabel(p.day)}
            </p>
            {p.turning && <p role="status">{HOURGLASS_LOADING}</p>}
            {!p.turning && p.dayStatus === "gap" && <p>{HOURGLASS_GAP}</p>}
            {!p.turning && p.dayStatus === "failed" && (
              <p role="alert">{HOURGLASS_FRAME_FAILED}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="g3d-btn" onClick={p.onEarlier} disabled={index === 0}>{HOURGLASS_EARLIER}</button>
              <button type="button" className="g3d-btn" onClick={p.onLater} disabled={p.day === null}>{HOURGLASS_LATER}</button>
              <button type="button" className="g3d-btn" onClick={p.onPlayToggle}>{p.playing ? HOURGLASS_PAUSE : HOURGLASS_PLAY}</button>
              <button type="button" className="g3d-btn" onClick={p.onToday} disabled={p.day === null}>{HOURGLASS_TODAY}</button>
            </div>
            <label className="block">
              <span className="text-ink-muted">{HOURGLASS_SLIDER}</span>
              <input
                type="range"
                className="mt-1 w-full"
                min={0}
                max={p.timeline.length - 1}
                value={index < 0 ? p.timeline.length - 1 : index}
                onChange={(e) => p.onPick(p.timeline[Number(e.target.value)].day)}
                aria-valuetext={p.day === null ? "Today" : dayLabel(p.day)}
              />
            </label>
            <div>
              <p className="text-ink-muted">{HOURGLASS_STRIP}</p>
              <ul className="mt-1 flex flex-wrap gap-1" aria-label={HOURGLASS_STRIP}>
                {strip.map((t) => (
                  <li key={t.day}>
                    <button
                      type="button"
                      onClick={() => p.onPick(t.day)}
                      title={t.stored ? dayLabel(t.day) : `${dayLabel(t.day)}: ${HOURGLASS_NIGHT_GAP}`}
                      aria-label={t.stored ? dayLabel(t.day) : `${dayLabel(t.day)}, ${HOURGLASS_NIGHT_GAP}`}
                      aria-pressed={t.day === p.day}
                      // A kept night is a solid block, a gap is an empty outline: the shape says it, not the colour.
                      className={`h-4 w-3 rounded-sm border border-ink ${t.stored ? "bg-ink" : "bg-transparent"} ${t.day === p.day ? "ring-2 ring-offset-1" : ""}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-ink-muted">{HOURGLASS_KEPT(kept, gaps)}. {HOURGLASS_RECORD}</p>
          </>
        )}
      </div>
    </aside>
  );
}
