import type { StandingWire } from "../lib/types";

/**
 * Standing 3 T2, "Face the wire": the words and the one action for a wire that fired and has not been
 * marked seen. "Seen" means "I looked", never "I agree" and never "I did something": the only write is
 * the existing acknowledge call, and the level is read fresh from the Standing afterwards.
 */
export const WIRES_TITLE = "Wires to look at";
export const LOOKED_BUTTON = "I have looked";
export const WIRES_SAMPLE = "Sample fortress, not yours. Nothing to mark.";
export const WIRE_FAILED = "Couldn't save that. The wire is still unseen.";

/** "A wire fired on <name>. Look at it." (12 words or fewer for a normal name). */
export function wireLine(w: Pick<StandingWire, "name">): string {
  return `A wire fired on ${w.name}. Look at it.`;
}

/** The wires worth listing: never the sample's, never when the Standing could not be read. */
export function wiresToShow(wires: readonly StandingWire[] | undefined, demo: boolean): StandingWire[] {
  return demo || !wires ? [] : [...wires];
}

export type LookResult = { ok: true } | { ok: false; message: string };

/**
 * Mark one wire seen, then read the Standing again. A failed mark changes nothing and says so; a
 * failed re-read after a good mark is not an error here (the wire IS seen), the next load shows it.
 */
export async function lookAtWire(
  id: string,
  acknowledge: (id: string) => Promise<unknown>,
  refresh: () => Promise<unknown>,
): Promise<LookResult> {
  try {
    await acknowledge(id);
  } catch {
    return { ok: false, message: WIRE_FAILED };
  }
  try {
    await refresh();
  } catch {
    /* the mark went through; the list updates on the next read */
  }
  return { ok: true };
}
