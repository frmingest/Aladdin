import type { CapsuleState } from "./capsules";
import type { FortressSiegeLevel } from "./types";
import type { CrestKind } from "./crest";
import { SEAL_LOOK, type SealKind } from "./seals";
import { getObjectArt, type ObjectArtId } from "./stitchArt";

/**
 * Object art for the Fortress rooms (Design Master Sprints 8 to 13). Pure id selection: which picture a
 * room or a seal may wear. A picture is decoration; every fact (seal state, ring, fog, gap day, due date)
 * is decided by code and drawn over it. Each lookup returns null unless the packed picture exists, so a
 * slot whose art has not been generated yet simply keeps its SVG or plain layout.
 */

/** Wide opaque scene behind a room's banner, one per room at most (pack mode `none`). */
const BACKDROP_OF: Partial<Record<CrestKind, string>> = {
  records: "backdrop-records",
  circle: "backdrop-circle",
  map: "backdrop-map",
};

/**
 * Which band of a wide backdrop the banner strip shows (CSS object-position). Circle shows the
 * standing stones on the horizon; Map shows the instruments on the desk.
 */
const BACKDROP_POSITION: Partial<Record<CrestKind, string>> = {
  circle: "50% 45%",
  map: "50% 22%",
};

/** The CSS object-position for a room's backdrop (centred when the room has no override). */
export function roomBackdropPosition(room: CrestKind): string {
  return BACKDROP_POSITION[room] ?? "50% 50%";
}

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

/** Furniture and tools that stand in a room's banner (Sprints 10 to 13), in the order they are drawn. */
const PROPS_OF: Partial<Record<CrestKind, readonly string[]>> = {
  records: ["room-bookshelf", "room-lectern"],
  journal: ["room-inkwell", "room-scroll"],
};

/** The banner props for a room: only pictures that are really packed. */
export function roomPropIds(room: CrestKind): string[] {
  return (PROPS_OF[room] ?? []).filter((id) => getObjectArt(id) !== null);
}

/**
 * The time-capsule picture for a review (Records, Sprint 10): sealed = a closed casket, owed = a closed
 * casket that code draws a cracked seal on (`broken`), written = an open casket. Null when not packed.
 */
export function capsuleArt(state: CapsuleState): { id: string; broken: boolean } | null {
  const look = state === "opened" ? { id: "casket-open", broken: false } : { id: "casket-closed", broken: state === "unsealed" };
  return getObjectArt(look.id) ? look : null;
}

export type SealState = "whole" | "broken";

/** The wax seal picture for a state (`seal-whole` / `seal-broken`), or null until it is generated. */
export function sealId(state: SealState): string | null {
  const id = state === "whole" ? "seal-whole" : "seal-broken";
  return getObjectArt(id) ? id : null;
}

/**
 * The picture and printed mark for a seal kind (Sprint 9). A note is a whole seal, a warning is a
 * broken one: the shape carries the tone, and the glyph and word of the page's own seal (lib/seals.ts) are
 * drawn over it by code, so colour is never the only signal. Unknown and none have no picture: their
 * dashed ring and "?" stay SVG so unknown never looks like a smaller known state.
 */
export function sealArtFor(kind: SealKind): { id: string; glyph: string; label: string } | null {
  if (kind !== "alert" && kind !== "notice") return null;
  const id = sealId(kind === "alert" ? "broken" : "whole");
  return id ? { id, glyph: SEAL_LOOK[kind].glyph, label: SEAL_LOOK[kind].label } : null;
}

/** A picture standing on the Circle map: its base point and width, in percent of the map's width. */
export interface RingPiece {
  id: string;
  left: number;
  top: number;
  width: number;
}

/** The brazier at the centre of the circle: always there, never lit by data. Null unless packed. */
export function circleBrazier(): RingPiece | null {
  return getObjectArt("circle-brazier") ? { id: "circle-brazier", left: 50, top: 50, width: 9 } : null;
}

/** The fog stake that stands beside the "No sector set" marker (only drawn when holdings have no sector). */
export function fogStakeId(): string | null {
  return getObjectArt("circle-stake") ? "circle-stake" : null;
}

/**
 * The sky badge beside the weather word in the top bar. Calm is the sun, gathering is clouds, besieged is
 * smoke over a wall. "Not surveyed" has NO picture: an unknown sky must never look like a known one, so it
 * keeps the plain drawn icon. The word beside the badge always says the level.
 */
const SKY_BADGE: Partial<Record<FortressSiegeLevel, ObjectArtId>> = {
  calm: "sky-calm",
  gathering: "sky-clouds",
  besieged: "sky-smoke",
};

export function skyBadgeId(level: FortressSiegeLevel): ObjectArtId | null {
  const id = SKY_BADGE[level];
  return id && getObjectArt(id) ? id : null;
}

/** The open empty chest for "nothing yet" messages. It carries no amount: it is not the Vault. */
export function emptyChestId(): ObjectArtId | null {
  return getObjectArt("empty-chest") ? "empty-chest" : null;
}
