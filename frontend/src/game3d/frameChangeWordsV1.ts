/**
 * Game-voice layer for the "what changed between two looks" sentences the backend writes (`frame_diff.py`), shown on the
 * 3D Night Watch card (text pass 4h). The backend keeps one neutral wording that the flat Fortress shows as is; the 3D
 * card passes each line through `gameFrameChangeText` so the player never reads "surveyed", "thesis" or "of the realm".
 *
 * Only words change: names, percentages and the old and new state are copied from the sentence, so every number stays
 * exact. A sentence this file does not know (a new backend wording) comes back untouched, never dropped or guessed. The
 * backend is not edited, so the flat page cannot drift. Version 1 (2026-11-09): a change to any wording that could be
 * shown for real is a NEW file (frameChangeWordsV2.ts), never an edit of this one.
 */

type Rule = [RegExp, (m: RegExpMatchArray) => string];

/** The weather levels the backend writes (`calm`, `gathering`, `besieged`, `unsurveyed`). Unknown is fog. */
const WEATHER: Record<string, string> = { calm: "calm", gathering: "gathering", besieged: "besieged", unsurveyed: "fog" };
/** Wall materials, named like the 3D condition ladder: basalt sound, granite solid, brick worn, timber patched, rotted failing. */
const WALL: Record<string, string> = { basalt: "sound", granite: "solid", brick: "worn", timber: "patched", rotted: "failing", unsurveyed: "in fog" };
const MOAT: Record<string, string> = { wide: "wide", narrow: "narrow", none: "none", unsurveyed: "in fog" };
/** The state of the written-down why. The backend writes the raw state, with underscores turned into spaces on one line. */
const WHY: Record<string, string> = {
  intact: "standing",
  review: "due a look",
  breached: "broken",
  "not analyzed": "not checked yet",
  not_analyzed: "not checked yet",
};

const word = (table: Record<string, string>, key: string) => table[key] ?? key;
const SHARE = "(an unknown share|-?\\d+(?:\\.\\d+)?%)";
const shareWord = (s: string) => (s === "an unknown share" ? "a share in fog" : `a ${s} share`);

const RULES: Rule[] = [
  [/^The weather turned from (\w+) to (\w+)\.$/, (m) => `The weather turned from ${word(WEATHER, m[1])} to ${word(WEATHER, m[2])}.`],
  [new RegExp(`^(.+) joined the fortress \\(${SHARE} of the realm\\)\\.$`),
    (m) => `${m[1]} joined the fortress with ${shareWord(m[2])}.`],
  [new RegExp(`^(.+) left the fortress \\(it held ${SHARE} of the realm\\)\\.$`),
    (m) => `${m[1]} left the fortress; it held ${shareWord(m[2])}.`],
  [new RegExp(`^(.+) went from ${SHARE} to ${SHARE} of the realm\\.$`),
    (m) => `${m[1]}'s share went from ${m[2]} to ${m[3]} of the fortress.`],
  [/^The walls of (.+) were surveyed: (\w+)\.$/, (m) => `The walls of ${m[1]} were checked: ${word(WALL, m[2])}.`],
  [/^The walls of (.+) can no longer be surveyed \(the figures are missing\)\.$/,
    (m) => `The walls of ${m[1]} slipped back into fog (the figures are missing).`],
  [/^The walls of (.+) went from (\w+) to (\w+)\.$/, (m) => `The walls of ${m[1]} went from ${word(WALL, m[2])} to ${word(WALL, m[3])}.`],
  [/^The moat of (.+) was surveyed: (\w+)\.$/, (m) => `The moat of ${m[1]} was checked: ${word(MOAT, m[2])}.`],
  [/^The moat of (.+) is no longer surveyed\.$/, (m) => `The moat of ${m[1]} slipped back into fog.`],
  [/^The moat of (.+) went from (\w+) to (\w+)\.$/, (m) => `The moat of ${m[1]} went from ${word(MOAT, m[2])} to ${word(MOAT, m[3])}.`],
  // "A tripwire fired on Vend: Net debt / EBITDA." is a Night Watch line, not a frame change; the colon keeps it out.
  [/^A tripwire fired on ([^:]+)\.$/, (m) => `A tripwire rang on ${m[1]}.`],
  [/^The breach on (.+) cleared \(breached to (\w+)\)\.$/, (m) => `The breach on ${m[1]} cleared: its why is now ${word(WHY, m[2])}.`],
  [/^The thesis of (.+) moved from ([a-z ]+) to ([a-z ]+)\.$/,
    (m) => `The why of ${m[1]} went from ${word(WHY, m[2])} to ${word(WHY, m[3])}.`],
];

/** One backend frame-change sentence in game voice; an unknown sentence comes back as it was. */
export function gameFrameChangeText(text: string): string {
  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

/** Words that must not survive on a sentence the rules above know. Used by the test. */
export const FRAME_CHANGE_BANNED = [/\bsurveyed\b/i, /\bunsurveyed\b/i, /\bthesis\b/i, /\bof the realm\b/i, /_/, /\bfired\b/i];
