/**
 * Game-voice layer for the lines the two advisors write about a holding, shown on the Library's Council shelf (text
 * pass 4i). The backend keeps one neutral wording (`advisor_lines_v1.py`, `advisors.py`) that the flat Fortress shows as
 * is; the 3D shelf passes each line, each "Why" fact and the footnote through these functions so the player never reads
 * "thesis", "tripwire", "portfolio" or "positions".
 *
 * Only words change. Names, shares, counts, days and correlations are copied out of the sentence, so every number stays
 * exact. The voices keep to the review's brief: the Oracle warm and in full phrases, the Partner clipped and dry. No line
 * says buy, sell, add or trim, and the "not quotations, not advice" footnote keeps its meaning. A sentence this file
 * does not know (a new backend rule, or a v2 wording) comes back untouched, never dropped or guessed. The backend is not
 * edited, so the flat page cannot drift. Version 1 (2026-11-09): a change to any wording that could be shown for real is a
 * NEW file (advisorLinesWordsV2.ts), never an edit of this one.
 */

type Rule = [RegExp, (m: RegExpMatchArray) => string];

const n = (count: string | number, one: string, many: string) => `${count} ${Number(count) === 1 ? one : many}`;

/** The backend writes a share as "12.3%" or "an unknown share". Unknown is fog. */
const SHARE = "(an unknown share|-?\\d+(?:\\.\\d+)?%)";
const holds = (s: string) => (s === "an unknown share" ? "a share in fog" : `${s} of the fortress`);

/** Wall materials, named like the 3D condition ladder: basalt sound, granite solid, brick worn, timber patched, rotted failing. */
const WALL: Record<string, string> = { basalt: "sound", granite: "solid", brick: "worn", timber: "patched", rotted: "failing", unsurveyed: "in fog" };
const WEATHER: Record<string, string> = { calm: "calm", gathering: "gathering", besieged: "besieged", unsurveyed: "in fog" };
const VAULT: Record<string, string> = { unsurveyed: "in fog" };
const LAND: Record<string, string> = { bargain: "bargain", discount: "discount", full_price: "full price", overpriced: "overpriced", fog: "in fog" };
/** The cases on the price board: bear is low, base is middle, bull is high. */
const CASE: Record<string, string> = { "bear case": "low case", "base case": "middle case", "bull case": "high case" };
const VAULT_REASON: Record<string, string> = {
  "no cash has been entered": "no cash is in the vault yet",
  "the cash figure is old": "the cash figure is old",
};

const word = (table: Record<string, string>, key: string) => table[key] ?? key;

const LINES: Rule[] = [
  [/^(.+?): (\d+) of the conditions you wrote down as proof the thesis was wrong has fired\. Read the thesis again while you are calm, before the price does the arguing for you\.$/,
    (m) => `${m[1]}: ${m[2]} of the signs you said would prove you wrong ${Number(m[2]) === 1 ? "has" : "have"} shown up. Read your why again while you're calm, before the price does the arguing.`],
  [/^(.+?): something changed since the last analysis\. Find out what moved before you decide anything about it\.$/,
    (m) => `${m[1]}: something moved since the last look. Find out what before you decide anything.`],
  [new RegExp(`^(.+) is ${SHARE} of the portfolio and its walls are (\\w+)\\. A big position should have the strongest balance sheet you own, not the weakest\\. Invert it: what would have to go wrong for this to hurt\\?$`),
    (m) => `${m[1]} holds ${holds(m[2])} and its walls are ${word(WALL, m[3])}. A big tower needs the strongest walls you own, not the weakest. Flip it: what has to go wrong for this to hurt?`],
  [new RegExp(`^(.+) is ${SHARE} of the portfolio and the analysis found no moat\\. Without one, a good year invites competitors in\\. Be sure that is the bet you meant to make\\.$`),
    (m) => `${m[1]} holds ${holds(m[2])} and the analysis found no moat. Without one, a good year invites rivals in. Be sure that's the bet you meant to make.`],
  [/^(.+?): a big tower, and the analysis is (\d+) days old\. A conclusion that old is a memory, not a reading\. Run it again before you lean on it\.$/,
    (m) => `${m[1]}: a big tower, and the last look is ${n(m[2], "day", "days")} old. That old, it's a memory, not a reading. Look again before you lean on it.`],
  [/^The weather is turning and the vault is (\w+)\. This is what dry powder is for\. Nothing here says you must spend it; being able to wait is the point\.$/,
    (m) => `The weather is turning and the vault is ${word(VAULT, m[1])}. That's what dry powder is for. Nothing says you must spend it; being able to wait is the point.`],
  [/^The weather is turning and the vault is (\w+)\. Ask yourself honestly whether you could sit through a worse quarter without being forced to give up a position\.$/,
    (m) => `The weather is turning and the vault is ${word(VAULT, m[1])}. Be honest: could you sit through a worse quarter without being forced to give up a tower?`],
  [/^(\d+) positions are each too small to matter\. A holding too small to move the result is also too small to be worth your attention\. Either it earns real study or it is clutter\.$/,
    (m) => `${n(m[1], "tower is", "towers are")} too small to matter. Too small to move the result is too small for your attention. Either it earns real study or it's clutter.`],
  [/^(.+) stand on one cracked wall \(correlation (-?\d+\.\d+), together (-?\d+(?:\.\d+)?%) of the portfolio\)\. In a bad week they are likely to fall together, so count them as one bet\.$/,
    (m) => `${m[1]} stand on one cracked wall (they move together, score ${m[2]}; ${m[3]} of the fortress between them). In a bad week they fall together, so count them as one bet.`],
  [/^(.+) is priced below its (bear case|base case) with strong walls and a moat\. That is a reason to study it closely, not a signal\. First find out why the market is paying so little\.$/,
    (m) => `${m[1]} sits below its ${word(CASE, m[2])}, with strong walls and a moat. That's a reason to study it, not a signal. First find out why the market pays so little.`],
  [new RegExp(`^(.+) is ${SHARE} of the portfolio and trades above its bull case\\. A wonderful business can still be bought at a poor price; the stored valuation assumes a lot goes right\\.$`),
    (m) => `${m[1]} holds ${holds(m[2])} and sits above its high case. A wonderful business can still cost too much; the worth estimate assumes a lot goes right.`],
  [/^The journal reads (\w+): (\d+) recent decisions went against your own rules, out of (\d+) logged\. Read the lines on the temperament card before the next decision, not after it\.$/,
    (m) => `The journal reads ${m[1]}: ${Number(m[2]) === 1 ? "1 decision went" : `${m[2]} decisions went`} against your own rules, out of ${m[3]} logged. Read the Temperament card before the next decision, not after it.`],
  [/^The journal reads composed over (\d+) logged decisions\. Keep writing down what would prove you wrong; that habit is what keeps this reading honest\.$/,
    (m) => `The journal reads composed over ${n(m[1], "logged decision", "logged decisions")}. Keep writing down what would prove you wrong; that habit keeps this honest.`],
  [/^I cannot judge your powder: (.+)\. Update the vault card so the weather report means something\.$/,
    (m) => `I can't judge your powder: ${word(VAULT_REASON, m[1])}. Update the vault so the weather report means something.`],
  [/^No tripwire has fired and nothing in the survey asks for action\. Most of the time the work is waiting, and waiting well is not the same as doing nothing\.$/,
    () => "No wire has rung and nothing in the latest look asks for action. Most of the time the work is waiting, and waiting well isn't doing nothing."],
];

const FACTS: Rule[] = [
  [/^(\d+) tripwire\(s\) fired on the thesis monitor$/, (m) => `${n(m[1], "wire", "wires")} rang on your why`],
  [/^the thesis monitor flagged it for review$/, () => "your why is due a look"],
  [new RegExp(`^weight ${SHARE}$`), (m) => (m[1] === "an unknown share" ? "share in fog" : `share ${m[1]}`)],
  [/^wall: (\w+)$/, (m) => `walls: ${word(WALL, m[1])}`],
  [/^moat: none found by the analysis$/, () => "moat: none found"],
  [/^moat: (\w+)$/, (m) => `moat: ${m[1]}`],
  [/^analysis age (\d+) days$/, (m) => `last look ${n(m[1], "day", "days")} old`],
  [/^land: above the bull case$/, () => "price: above the high case"],
  [/^land: (\w+)$/, (m) => `price: ${word(LAND, m[1])}`],
  [/^weather: (\w+)$/, (m) => `weather: ${word(WEATHER, m[1])}`],
  [/^vault: (\w+)$/, (m) => `vault: ${word(VAULT, m[1])}`],
  [/^stale: (True|False)$/, (m) => (m[1] === "True" ? "cash figure: old" : "cash figure: fresh")],
  [/^(\d+) positions under the tiny-position size$/, (m) => `${n(m[1], "tower", "towers")} under the tiny-tower size`],
  [/^(\d+) positions in all$/, (m) => `${n(m[1], "tower", "towers")} in all`],
  [/^correlation (-?\d+\.\d+)$/, (m) => `move-together score ${m[1]}`],
  [/^combined weight (-?\d+(?:\.\d+)?%)$/, (m) => `together ${m[1]} of the fortress`],
  [/^(\d+) holdings surveyed$/, (m) => `${n(m[1], "tower", "towers")} checked`],
  [/^no tripwire fired$/, () => "no wire rang"],
];

/** The backend's footnote under every advisor answer (`advisors.DISCLAIMER`). */
const DISCLAIMER =
  "Written for Aladdin in the spirit of a patient owner and a blunt sceptic. These are not quotations from Warren Buffett or Charlie Munger, and nothing here is advice to trade.";
const DISCLAIMER_GAME =
  "Hand-written in the spirit of a patient owner and a blunt sceptic. Not quotes from Warren Buffett or Charlie Munger, and not advice to trade.";

function run(rules: Rule[], text: string): string {
  for (const [re, fn] of rules) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

/** One advisor line in game voice; a sentence this file does not know comes back as it was. */
export const gameAdvisorLine = (text: string): string => run(LINES, text);
/** One "Why" fact in game voice. Free-text reasons the backend copies from other cards pass through untouched. */
export const gameAdvisorFact = (fact: string): string => run(FACTS, fact);
/** The footnote under the advisors' answers. */
export const gameAdvisorDisclaimer = (text: string): string => (text === DISCLAIMER ? DISCLAIMER_GAME : text);

/** Words that must not survive on a line or fact the rules above know. Used by the test. */
export const ADVISOR_BANNED = [
  /\bthesis\b/i, /\btripwires?\b/i, /\(s\)/, /\bportfolio\b/i, /\bpositions?\b/i, /\bvaluation\b/i,
  /\bstored\b/i, /\b(?:bear|base|bull) case\b/i, /\bweight\b/i, /\bcorrelation\b/i, /\bsurveyed\b/i, /\bbuy\b|\bsell\b/i,
];
