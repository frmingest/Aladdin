/** Shared by lib/api.ts and lib/errors.ts (kept apart so neither imports the other). */

/** The longest server `detail` we will print as is. Longer text is a dump, not a message. */
const MAX_DETAIL = 200;

function looksLikeMarkup(text: string): boolean {
  return /^\s*<(!doctype|html|head|body|\?xml)/i.test(text) || /<\/?[a-z][\s\S]*>/i.test(text.slice(0, 400));
}

/** A server-written detail that is safe and short enough to show, else null. */
export function readableDetail(message: string): string | null {
  const text = message.trim();
  if (!text || text.length > MAX_DETAIL || looksLikeMarkup(text)) return null;
  if (/^request failed with status \d+$/i.test(text)) return null;
  if (/traceback \(most recent call last\)/i.test(text)) return null;
  return text;
}
