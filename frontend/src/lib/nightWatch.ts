import type { NightWatch, NightWatchLine, NightWatchState, NightWatchStatus } from "./types";

/** Wording and classes for the Night Watch dispatch (game mode G16, Sprint 24). Pure. The backend
 * decides every line from stored facts; this only chooses labels and colours. "Quiet" is only ever
 * shown for a watch that reported in: an unknown watch is never drawn as calm. */

export const STATUS_LABEL: Record<NightWatchStatus, string> = {
  attention: "Needs a look",
  quiet: "Quiet night",
  unknown: "Watch not reporting",
};

export const STATUS_CLASS: Record<NightWatchStatus, string> = {
  attention: "bg-negative-subtle text-negative",
  quiet: "bg-positive-subtle text-positive",
  unknown: "bg-caution-subtle text-caution",
};

export const WATCH_STATE_LABEL: Record<NightWatchState, string> = {
  ok: "Watch reported on time",
  old: "Watch report is old",
  never: "Watch has never reported",
};

export const TONE_CLASS: Record<NightWatchLine["tone"], string> = {
  warning: "text-negative",
  note: "text-ink",
  calm: "text-positive",
};

export const TONE_MARK: Record<NightWatchLine["tone"], string> = { warning: "!", note: "·", calm: "✓" };

export function hoursText(hours: number | null): string {
  if (hours === null) return "never";
  if (hours < 1) return "under an hour ago";
  if (hours === 1) return "1 hour ago";
  if (hours < 48) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** The sentence under the headline: when the watch last walked and when the pages were last rebuilt. */
export function stampLine(w: NightWatch): string {
  const parts = [`Watch: ${hoursText(w.watch_age_hours)}`];
  if (w.frames_stored > 0) parts.push(`${w.frames_stored} ${w.frames_stored === 1 ? "frame" : "frames"} stored`);
  return parts.join(" · ");
}
