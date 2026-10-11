import type { CrestKind } from "./crest";
import { getObjectArt } from "./stitchArt";

/**
 * Object art for the Fortress rooms (Design Master Sprints 8 to 13). Pure id selection: which picture a
 * room or a seal may wear. A picture is decoration; every fact (seal state, ring, fog, gap day, due date)
 * is decided by code and drawn over it. Each lookup returns null unless the packed picture exists, so a
 * slot whose art has not been generated yet simply keeps its SVG or plain layout.
 */

/** Wide opaque scene behind a room's banner, one per room at most (pack mode `none`). */
const BACKDROP_OF: Partial<Record<CrestKind, string>> = {
  records: "backdrop-records",
  chronicle: "backdrop-chronicle",
};

/** The banner backdrop for a room, or null (no picture packed, or the room has none). */
export function roomBackdropId(room: CrestKind): string | null {
  const id = BACKDROP_OF[room];
  return id && getObjectArt(id) ? id : null;
}

/** The round crest picture for a room (`crest-<room>`), or null until the crest set is generated. */
export function roomCrestId(room: CrestKind): string | null {
  const id = `crest-${room}`;
  return getObjectArt(id) ? id : null;
}

export type SealState = "whole" | "broken";

/** The wax seal picture for a state (`seal-whole` / `seal-broken`), or null until it is generated. */
export function sealId(state: SealState): string | null {
  const id = state === "whole" ? "seal-whole" : "seal-broken";
  return getObjectArt(id) ? id : null;
}
