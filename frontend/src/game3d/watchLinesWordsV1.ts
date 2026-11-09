/**
 * Game-voice layer for the sentences the backend writes into the Night Watch (text pass 4f). The backend keeps one
 * neutral wording (`night_watch.py`, `frame_diff.py`) that the flat Fortress shows as is; the 3D panel passes each line
 * through `gameWatchText` so the player never reads "worker", "frames stored", "dispatch" or "tower(s)".
 *
 * Only words change: counts, names and hours are copied from the line itself, so every number stays exact. A line this
 * file does not know (a new backend sentence) is returned untouched, never dropped or guessed. The backend and its
 * versioned rules are not edited, so this is a new file and the flat page cannot drift. Pure and tested against the
 * backend's own sentences.
 */

const n = (count: string | number, one: string, many: string) => `${count} ${Number(count) === 1 ? one : many}`;

type Rule = [RegExp, (m: RegExpMatchArray) => string];

const RULES: Rule[] = [
  [/^The watch has never walked the walls: the nightly tripwire check has not run\. Start the PC worker; it runs the check once a day\.$/,
    () => "The Watch has never walked the walls. Start it on your PC and it walks them once a night."],
  [/^The watch last reported (\d+) hours ago, which is longer than a night\. The worker may be off, so nothing below is fresh\.$/,
    (m) => `The Watch last walked the walls ${n(m[1], "hour", "hours")} ago, which is more than a night. What follows may be old.`],
  [/^The watch walked the walls (\d+) hours? ago\.$/, (m) => `The Watch walked the walls ${n(m[1], "hour", "hours")} ago.`],
  [/^(\d+) more tripwires fired overnight\.$/, (m) => `${n(m[1], "more tripwire", "more tripwires")} fired overnight.`],
  [/^(\d+) earlier tripwire\(s\) are still firing on (\d+) tower\(s\)\.$/,
    (m) => `${n(m[1], "earlier tripwire is", "earlier tripwires are")} still lit on ${n(m[2], "tower", "towers")}.`],
  [/^(\d+) more change\(s\) between the last two stored frames\.$/,
    (m) => `${n(m[1], "more change", "more changes")} between the last two looks.`],
  [/^(\d+) new report\(s\) landed overnight: (.*)\.$/,
    (m) => `${n(m[1], "raven", "ravens")} landed overnight: ${m[2]}.`],
  [/^No fortress frame has been stored yet, so the dispatch cannot say what changed\. The worker stores one a day\.$/,
    () => "No look is saved yet, so the Watch can't say what changed. It saves one a night."],
  [/^One fortress frame is stored; changes show from the second one\.$/,
    () => "One look is saved; changes show from the second."],
  [/^Nothing fired, nothing is firing, and nothing changed overnight\.$/,
    () => "All quiet: nothing fired, nothing is lit, nothing changed."],
  [/^(\d+) tripwire\(s\) fired overnight\.$/, (m) => `${n(m[1], "tripwire", "tripwires")} fired overnight.`],
  [/^(\d+) tripwire\(s\) are firing\.$/, (m) => `${n(m[1], "tripwire is", "tripwires are")} lit.`],
  [/^The watch has not reported in, so quiet cannot be claimed\.$/, () => "The Watch hasn't reported, so nobody can call it quiet."],
  [/^A quiet night: nothing is firing\.$/, () => "A quiet night: no tripwire is lit."],
  [/^between the two newest stored frames, up to (.*)$/, (m) => `between the two newest looks, up to ${m[1]}`],
];

/** One backend Night Watch sentence (headline, line or fact) in game voice; unknown sentences come back as they were. */
export function gameWatchText(text: string): string {
  for (const [re, fn] of RULES) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

/** Words that must not survive on a line the rules above know. Used by the test. */
export const WATCH_LINE_BANNED = [/\bworker\b/i, /\bframes?\b/i, /\bstored\b/i, /\bdispatch\b/i, /\(s\)/, /\bfortress frame\b/i];
