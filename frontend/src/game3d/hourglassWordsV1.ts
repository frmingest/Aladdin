/** Words for the Hourglass (version 1): short, plain and playful. A change that alters meaning is a new version file. */
export const HOURGLASS_PROMPT = "Press E to turn the hourglass";
export const HOURGLASS_PANEL_TITLE = "The Hourglass";
export const HOURGLASS_INTRO = "Turn back time and watch your fortress as it stood. Only nights the fortress was written down.";
export const HOURGLASS_EARLIER = "Earlier";
export const HOURGLASS_LATER = "Later";
export const HOURGLASS_PLAY = "Play";
export const HOURGLASS_PAUSE = "Pause";
export const HOURGLASS_TODAY = "Back to today";
/** Shown on the banner the whole time you are in the past. */
export const HOURGLASS_BANNER = "Looking back. Nothing can be written.";
export const HOURGLASS_BANNER_KEY = "H";
export const HOURGLASS_EMPTY = "The hourglass is still filling. Come back after a night or two.";
export const HOURGLASS_LOADING = "Turning the sand...";
export const HOURGLASS_UNREADABLE = "The sand will not turn. The history could not be read.";
export const HOURGLASS_RETRY = "Try again";
/** A day with no stored frame: shown as an empty yard, never filled in from its neighbours. */
export const HOURGLASS_GAP = "No picture was kept this day.";
export const HOURGLASS_FRAME_FAILED = "This day could not be read.";
export const HOURGLASS_RECORD = "A record of what was stored. Never a forecast.";
/** What E and the keys say at a place that is shut while you look back. */
export const HOURGLASS_SHUT = "Shut while you look back. Press H for today";
export const HOURGLASS_SAMPLE = "The sample fortress keeps no history.";
const nights = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;
export const HOURGLASS_KEPT = (kept: number, gaps: number) =>
  gaps > 0 ? `${nights(kept)} kept, ${gaps} with no picture` : `${nights(kept)} kept`;
export const HOURGLASS_SLIDER = "Which night";
export const HOURGLASS_STRIP = "The last nights";
export const HOURGLASS_NIGHT_GAP = "no picture kept";
