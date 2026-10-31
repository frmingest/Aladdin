/**
 * Words and the one action for "look at the wire" (Standing 3, T2, 2026-10-31). Game voice: short, plain,
 * no advice. "Seen" means "I looked", never "I agree" and never "I did something": the button only marks a
 * wire seen through the acknowledge call the app already has. Hand-written; no model writes a word of it.
 * Once shown for real, change the words in a new file rather than editing this one.
 */
import type { Standing, StandingWire } from "../lib/types";

export const WIRE_TITLE = "Wires that fired";
export const WIRE_BUTTON = "I have looked";
export const WIRE_FAILED = "Could not mark it seen. It stays unseen.";
export const WIRE_SAMPLE = "Sample fortress: nothing to look at here.";

/** "A wire fired on AKRBP.OL. Look at it." (12 words or fewer, with or without a ticker). */
export function wireLine(w: StandingWire): string {
  const ticker = w.ticker.trim();
  return ticker ? `A wire fired on ${ticker}. Look at it.` : "A wire fired. Look at it.";
}

/** The wires to list. Nothing is listed for the sample fortress, while loading, or when it cannot be read. */
export function wiresToShow(s: Standing | null, failed: boolean): StandingWire[] {
  if (failed || s === null || s.demo) return [];
  return s.wires ?? [];
}

export type LookResult = { ok: true } | { ok: false; message: string };

/**
 * Mark one wire seen, then read the Standing again. Nothing is assumed: the sample fortress cannot mark
 * anything, a failed call leaves the wire unseen and says so, and a failed re-read still counts as marked
 * (the mark went through) while the card keeps the last Standing it had.
 */
export async function lookAtWire(
  wire: StandingWire,
  opts: { demo: boolean; acknowledge: (id: string) => Promise<unknown>; reread: () => Promise<void> },
): Promise<LookResult> {
  if (opts.demo) return { ok: false, message: WIRE_SAMPLE };
  try {
    await opts.acknowledge(wire.id);
  } catch {
    return { ok: false, message: WIRE_FAILED };
  }
  try {
    await opts.reread();
  } catch {
    // The wire is marked; the next read of the Standing will show it.
  }
  return { ok: true };
}
