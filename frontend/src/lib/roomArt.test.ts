import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "./artManifest";
import { roomBackdropId, roomCrestId, sealId } from "./roomArt";

describe("room art ids", () => {
  it("gives Records and Chronicle a banner backdrop that is really packed", () => {
    for (const room of ["records", "chronicle"] as const) {
      const id = roomBackdropId(room);
      expect(id).not.toBeNull();
      expect(Object.keys(ART_MANIFEST)).toContain(id);
    }
  });

  it("gives no backdrop to rooms that have none", () => {
    for (const room of ["council", "circle", "map", "siege", "market", "fortress"] as const) {
      expect(roomBackdropId(room)).toBeNull();
    }
  });

  it("returns null for a crest or seal whose picture is not packed (never a broken id)", () => {
    const packed = Object.keys(ART_MANIFEST);
    for (const room of ["council", "records", "circle", "chronicle", "map"] as const) {
      const id = roomCrestId(room);
      if (id !== null) expect(packed).toContain(id);
    }
    for (const state of ["whole", "broken"] as const) {
      const id = sealId(state);
      if (id !== null) expect(packed).toContain(id);
    }
  });
});
