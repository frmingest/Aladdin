import {
  HOURGLASS_BANNER,
  HOURGLASS_BANNER_KEY,
  HOURGLASS_FRAME_FAILED,
  HOURGLASS_GAP,
  HOURGLASS_PAUSE,
  HOURGLASS_PLAY,
  HOURGLASS_TODAY,
} from "./hourglassWordsV1";
import { dayLabel } from "./hourglassPlan";
import type { DayStatus } from "./HourglassPanel";

/**
 * Always on screen while you look back: the date, that nothing can be written, Play or Pause (so a replay can be
 * watched with the panel shut and stopped from here), and the one key home. It sits under the toolbar so no button is
 * covered. A day with no picture says so here, once, so a bare yard is never mistaken for an empty fortress.
 */
export default function HourglassBanner({
  day,
  status,
  playing,
  onPlayToggle,
  onToday,
}: {
  day: string;
  status: DayStatus;
  playing: boolean;
  onPlayToggle: () => void;
  onToday: () => void;
}) {
  return (
    <div
      role="status"
      className="g3d-panel absolute left-1/2 top-14 z-30 flex w-max max-w-[92%] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm"
    >
      <strong>{dayLabel(day)}</strong>
      <span>{HOURGLASS_BANNER}</span>
      {status === "gap" && <span>{HOURGLASS_GAP}</span>}
      {status === "failed" && <span>{HOURGLASS_FRAME_FAILED}</span>}
      <button type="button" className="g3d-btn" onClick={onPlayToggle}>
        {playing ? HOURGLASS_PAUSE : HOURGLASS_PLAY}
      </button>
      <button type="button" className="g3d-btn" onClick={onToday}>
        {HOURGLASS_TODAY} ({HOURGLASS_BANNER_KEY})
      </button>
    </div>
  );
}
