/** Wording for the game-mode Night Watch dispatch seal (pure). The count is the real number of
 * detail lines the card holds; nothing is estimated. */

export function dispatchSealLabel(open: boolean): string {
  return open ? "Seal broken: dispatch details" : "Break the seal: dispatch details";
}

export function dispatchCountHint(lines: number): string | null {
  if (!Number.isFinite(lines) || lines <= 0) return null;
  return lines === 1 ? "1 line" : `${Math.floor(lines)} lines`;
}
