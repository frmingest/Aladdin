/** Helpers that make the model's long narrative text easier to read
 * (2026-09-25). They only re-flow and mark up plain text; nothing is
 * interpreted as HTML (CLAUDE.md Rule 5). */

// A sentence ends at . ! or ? followed by whitespace and a capital letter,
// digit, quote or bracket. "88.8%" or "e.g. the" don't split.
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-ZÆØÅ0-9"“(])/u;

export function splitSentences(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((block) => block.replace(/\s+/g, " ").trim().split(SENTENCE_BOUNDARY))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Group sentences into short paragraphs (default 2 per paragraph). */
export function paragraphs(sentences: string[], perParagraph = 2): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) out.push(sentences.slice(i, i + perParagraph));
  return out;
}

// A figure: optional sign, digits with thousands separators and decimals,
// optional unit. Not part of a word or an ID (EV-007, qwen3, Q4).
const FIGURE =
  /(?<![\p{L}\p{N}_-])[-−+]?\d+(?:[,\u00A0\u202F]\d{3})*(?:[.,]\d+)?(?:\s?(?:%|x\b|×|pp\b|bps\b|bn\b|m\b|NOK\b|USD\b|EUR\b))?(?![\p{L}\p{N}_])/gu;

const YEAR = /^(?:19|20)\d{2}$/;

export type Segment = { text: string; figure: boolean };

/** Split text into plain runs and figures, so figures can be typeset. */
export function segmentFigures(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(FIGURE)) {
    if (YEAR.test(match[0])) continue; // "in 2025" is context, not a figure
    const start = match.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start), figure: false });
    out.push({ text: match[0], figure: true });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), figure: false });
  return out;
}

// Phrases the analysis uses when it says it had no data for something.
const DATA_GAP =
  /\b(lack of (?:data|information)|not possible|no (?:available|data)|not available|unavailable|insufficient|not clear from|limits? (?:a|the|our) (?:more )?(?:comprehensive )?assessment|missing)\b/i;

export function mentionsDataGap(sentence: string): boolean {
  return DATA_GAP.test(sentence);
}

/** How many sentences in a narrative say data was missing. */
export function dataGapCount(text: string): number {
  return splitSentences(text).filter(mentionsDataGap).length;
}
