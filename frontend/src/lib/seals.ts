/** Wax-seal status marks for the game pages (page-scene kit). Pure, so it is unit-tested. A status is
 * always carried by shape + glyph + a printed word, never by colour alone (game UI standard 2). Colours
 * here are decoration on top of those three; nothing is green, so no seal reads as "good". */

export type SealKind = "alert" | "notice" | "unknown" | "none";

export interface SealLook {
  kind: SealKind;
  shape: "triangle" | "circle" | "dashed-circle" | "ring";
  glyph: string;
  /** Printed next to the seal and used as its accessible name. */
  label: string;
}

export const SEAL_LOOK: Record<SealKind, SealLook> = {
  alert: { kind: "alert", shape: "triangle", glyph: "!", label: "Warning" },
  notice: { kind: "notice", shape: "circle", glyph: "i", label: "Note" },
  unknown: { kind: "unknown", shape: "dashed-circle", glyph: "?", label: "Unknown" },
  none: { kind: "none", shape: "ring", glyph: "", label: "None found" },
};

/** Council tone ("warning" | "note") to a seal. Anything else is a plain note, never a calm look. */
export function sealForTone(tone: string): SealKind {
  return tone === "warning" ? "alert" : "notice";
}

/** The five distinguishing features must differ pairwise, so no two states can be mistaken for each other. */
export function sealSignature(kind: SealKind): string {
  const l = SEAL_LOOK[kind];
  return `${l.shape}|${l.glyph}|${l.label}`;
}
