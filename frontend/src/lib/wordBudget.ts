/** Text budget guardrail (UX noise audit, principle 7). A page's default view
 * should stay short; a test renders the pieces that decide it and fails when
 * one grows past its budget, so noise cannot creep back unseen. */

export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(html: string): number {
  const text = visibleText(html);
  return text ? text.split(" ").length : 0;
}

/** Budgets in words, for the default (nothing opened) view of each piece. */
export const WORD_BUDGET = {
  sidebarDefault: 30,
  fortressTabs: 12,
  keyNumbers: 30,
  warningStack: 60,
  fortressReportsBar: 12,
} as const;
