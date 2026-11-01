/**
 * Words for a tower's signboard (game3d, 2026-11-01). Pure, no three.js and no React.
 * The sign shows the holding's name in at most two lines; an unsurveyed tower adds a small second note.
 * Nothing here decides a fact: the name and the gap label come from the TowerView as they are.
 */

export const SIGN_MAX_LINES = 2;
export const SIGN_LINE_CHARS = 16;

export interface SignWords {
  /** Name lines, at most SIGN_MAX_LINES. A name that does not fit ends in an ellipsis. */
  lines: string[];
  /** Small note under the name; empty when the tower is surveyed. */
  note: string;
}

/** Break a name on spaces into at most `maxLines` lines of at most `perLine` characters. */
export function wrapName(name: string, perLine = SIGN_LINE_CHARS, maxLines = SIGN_MAX_LINES): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let cur = "";
  let i = 0;
  for (; i < words.length; i++) {
    let w = words[i];
    if (w.length > perLine) w = w.slice(0, perLine - 1) + "…";
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= perLine) {
      cur = next;
      continue;
    }
    lines.push(cur);
    cur = w;
    if (lines.length === maxLines - 1) {
      // Last line takes everything that is left, cut with an ellipsis if it is too long.
      const rest = [w, ...words.slice(i + 1)].join(" ");
      return [...lines, rest.length <= perLine ? rest : rest.slice(0, perLine - 1).trimEnd() + "…"];
    }
  }
  lines.push(cur);
  return lines;
}

export function signWords(name: string, fog: boolean, gap?: string | null): SignWords {
  return {
    lines: wrapName(name),
    note: fog ? (gap ? `not surveyed: ${gap}` : "not surveyed") : "",
  };
}
