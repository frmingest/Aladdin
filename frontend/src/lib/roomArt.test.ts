import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "./artManifest";
import { capsuleArt, emptyChestId, roomBackdropId, roomCrestId, roomPropIds, sealId, skyBadgeId } from "./roomArt";

describe("Records art (Sprint 10)", () => {
  it("tells the three review states apart by picture and seal, and they are all packed", () => {
    const sealed = capsuleArt("sealed");
    const owed = capsuleArt("unsealed");
    const written = capsuleArt("opened");
    expect(sealed).toEqual({ id: "casket-closed", broken: false });
    expect(owed).toEqual({ id: "casket-closed", broken: true });
    expect(written).toEqual({ id: "casket-open", broken: false });
    for (const l of [sealed, owed, written]) expect(Object.keys(ART_MANIFEST)).toContain(l!.id);
  });

  it("stands the bookshelf and lectern in the Records banner only", () => {
    expect(roomPropIds("records")).toEqual(["room-bookshelf", "room-lectern"]);
    expect(roomPropIds("circle")).toEqual([]);
    expect(roomPropIds("fortress")).toEqual([]);
  });
});

describe("room art ids", () => {
  it("gives Records, Circle and Map a banner backdrop that is really packed", () => {
    for (const room of ["records", "circle", "map"] as const) {
      const id = roomBackdropId(room);
      expect(id).not.toBeNull();
      expect(Object.keys(ART_MANIFEST)).toContain(id);
    }
  });

  it("gives no backdrop to rooms that have none", () => {
    for (const room of ["siege", "market", "fortress"] as const) {
      expect(roomBackdropId(room)).toBeNull();
    }
  });

  it("gives each room its own crest picture", () => {
    const rooms = ["records", "circle", "map", "siege", "market", "fortress", "journal"] as const;
    const ids = rooms.map((r) => roomCrestId(r));
    expect(ids).toEqual(rooms.map((r) => `crest-${r}`));
  });

  it("returns null for a crest or seal whose picture is not packed (never a broken id)", () => {
    const packed = Object.keys(ART_MANIFEST);
    for (const room of ["records", "circle", "map", "siege", "market", "fortress", "journal"] as const) {
      const id = roomCrestId(room);
      if (id !== null) expect(packed).toContain(id);
    }
    for (const state of ["whole", "broken"] as const) {
      const id = sealId(state);
      if (id !== null) expect(packed).toContain(id);
    }
  });

  it("gives calm, gathering and besieged a sky badge and 'not surveyed' none (unknown never looks known)", () => {
    expect(skyBadgeId("calm")).toBe("sky-calm");
    expect(skyBadgeId("gathering")).toBe("sky-clouds");
    expect(skyBadgeId("besieged")).toBe("sky-smoke");
    expect(skyBadgeId("unsurveyed")).toBeNull();
  });

  it("packs the empty chest", () => {
    expect(emptyChestId()).toBe("empty-chest");
  });
});
