/**
 * Game-voice layer for the sentences the backend writes into the temperament meter (text pass 4g). The backend keeps one
 * neutral wording (`services/game/temperament.py`) that the flat Fortress shows as is; the 3D Vault passes each event
 * explanation, the summary and the rule names through here so the player never reads "judged event(s)", "snapshot
 * comparison(s)" or "temperament rule".
 *
 * Only words change: counts, names, dates and percentages are copied from the sentence itself, so every number stays
 * exact. A sentence this file does not know (a new backend wording) comes back untouched, never dropped or guessed. The
 * backend and its rules are not edited, so the flat page cannot drift. Version 1 (2026-11-09): a change to any wording
 * that could be shown for real is a NEW file (temperWordsV2.ts), never an edit of this one.
 */

const n = (count: string | number, one: string, many: string) => `${count} ${Number(count) === 1 ? one : many}`;

type Rule = [RegExp, (m: RegExpMatchArray) => string];

const EXPLANATIONS: Rule[] = [
  [/^(\w+) logged without writing what would prove it wrong\.$/, (m) => `${m[1]} with no "what would prove me wrong" on paper.`],
  [/^Sold while the latest analysis said (.+) and no tripwire had fired\.$/,
    (m) => `Sold while the analysis still said ${m[1]} and no tripwire had rung.`],
  [/^(\w+) while the latest analysis said ([^.]+)\.$/, (m) => `${m[1]}, though the latest analysis said ${m[2]}.`],
  [/^(\w+) after a tripwire on this holding had fired\.$/, (m) => `${m[1]} after a tripwire rang on this holding.`],
  [/^Went back and wrote the (6|12)-month review of this decision\.$/, (m) => `Came back and wrote the ${m[1]}-month look-back.`],
  [/^(\d+) trades on this holding within (\d+) days \((.+) to (.+)\)\.$/,
    (m) => `${n(m[1], "trade", "trades")} on this holding in ${n(m[2], "day", "days")} (${m[3]} to ${m[4]}).`],
  [/^Kept the position while the price fell (.+) between snapshots \((.+) to (.+)\), with no tripwire fired\.$/,
    (m) => `Held on while the price fell ${m[1]} between two saved looks (${m[2]} to ${m[3]}), and no tripwire had rung.`],
];

const SUMMARIES: Rule[] = [
  [/^(\d+) logged decision\(s\) and (\d+) snapshot comparison\(s\) in the last (\d+) days; none met a temperament rule, so there is nothing to judge\.$/,
    (m) => `${n(m[1], "decision", "decisions")} and ${n(m[2], "look", "looks")} compared in the last ${m[3]} days; none fit a rule, so there is nothing to weigh.`],
  [/^No logged decisions or snapshot comparisons in the last (\d+) days\. The meter fills in as you use the decision journal\.$/,
    (m) => `Nothing written or compared in the last ${m[1]} days. The needle moves as you use the journal.`],
  [/^(\d+) of (\d+) judged event\(s\) restored the meter, based on (\d+) logged decision\(s\) and (\d+) snapshot comparison\(s\) in the last (\d+) days\.$/,
    (m) => `${m[1]} of ${n(m[2], "moment", "moments")} calmed the needle, from ${n(m[3], "decision", "decisions")} and ${n(m[4], "look", "looks")} compared in the last ${m[5]} days.`],
];

const LOW_CONFIDENCE = /^(.*?) Fewer than (\d+) logged decisions: a low-confidence reading\.$/;

function apply(rules: Rule[], text: string): string | null {
  for (const [re, fn] of rules) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return null;
}

/** One backend event explanation in game voice; an unknown sentence comes back as it was. */
export function gameTemperExplanation(text: string): string {
  return apply(EXPLANATIONS, text) ?? text;
}

/** The backend's meter summary in game voice, with its low-confidence tail; an unknown sentence comes back as it was. */
export function gameTemperSummary(text: string): string {
  const tail = text.match(LOW_CONFIDENCE);
  if (tail) {
    const head = apply(SUMMARIES, tail[1]);
    return head === null ? text : `${head} Fewer than ${n(tail[2], "decision", "decisions")} so far, so the reading is shaky.`;
  }
  return apply(SUMMARIES, text) ?? text;
}

/** The rule names on each event line. Version 1 of the 3D names; a rule it does not know falls back to the flat label. */
export const TEMPER_RULE_LABEL_V1: Record<string, string> = {
  bought_against_verdict: "Bought against the analysis",
  no_invalidation: "No \"prove me wrong\" written",
  sold_intact_thesis: "Sold a plan that still held",
  churn: "Too much shuffling",
  acted_on_tripwire: "Moved when the tripwire rang",
  held_through_drop: "Held through a drop",
  review_6m_done: "6-month look-back done",
  review_12m_done: "12-month look-back done",
};

/** Words that must not survive on a sentence the rules above know. Used by the test. */
export const TEMPER_BANNED = [/\(s\)/, /\bsnapshots?\b/i, /\bjudged\b/i, /\btemperament rule\b/i, /\blogged\b/i, /\binvalidation\b/i];
