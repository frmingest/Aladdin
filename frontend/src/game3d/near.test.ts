import { describe, expect, it } from "vitest";
import { NO_NEARS, pickNear, standingAt } from "./near";
import type { NearTarget, Nears } from "./near";

const T = (id: string, x: number, z = 0): NearTarget<string> => ({ id, x, z, range: 3, leaveRange: 4.5 });
const at = (x: number) => ({ x, z: 0 });
const nears = (p: Partial<Nears>): Nears => ({ ...NO_NEARS, ...p });

describe("pickNear", () => {
  it("picks nothing when nothing is in reach", () => {
    expect(pickNear(at(10), [T("a", 0)], null)).toBeNull();
    expect(pickNear(at(0), [], null)).toBeNull();
  });
  it("arrives at range and leaves at the wider range", () => {
    const ts = [T("a", 0)];
    expect(pickNear(at(3.5), ts, null)).toBeNull();
    expect(pickNear(at(3.5), ts, "a")).toBe("a");
    expect(pickNear(at(4.6), ts, "a")).toBeNull();
  });
  it("does not flicker on the edge: in at 2.9, held at 4, out at 4.6, not back in at 4", () => {
    const ts = [T("a", 0)];
    let last: string | null = null;
    const walk = (x: number) => (last = pickNear(at(x), ts, last));
    expect(walk(2.9)).toBe("a");
    expect(walk(4)).toBe("a");
    expect(walk(4.6)).toBeNull();
    expect(walk(4)).toBeNull();
  });
  it("gives the nearest of several, and the earlier one on an exact tie", () => {
    expect(pickNear(at(1), [T("a", 0), T("b", 2.5)], null)).toBe("a");
    expect(pickNear(at(2), [T("a", 0), T("b", 2.5)], null)).toBe("b");
    expect(pickNear(at(1), [T("a", 0), T("b", 2)], null)).toBe("a");
  });
  it("keeps the held target only in its own wider reach, not the others'", () => {
    // b is at 4 from the hero: held, it counts; a stranger at the same distance does not.
    expect(pickNear(at(0), [T("b", 4)], "b")).toBe("b");
    expect(pickNear(at(0), [T("b", 4)], "a")).toBeNull();
  });
});

describe("standingAt: the one answer for E and for the prompt", () => {
  const court = { id: "courtyard" } as const;
  it("is none with nothing near", () => {
    expect(standingAt(court, NO_NEARS)).toEqual({ kind: "none" });
  });
  it("lets a person beat a tower door, and a tower door beat the desk", () => {
    expect(standingAt(court, nears({ npc: "oracle" as never, tower: "h1", desk: true }))).toEqual({ kind: "npc", id: "oracle" });
    expect(standingAt(court, nears({ tower: "h1", desk: true }))).toEqual({ kind: "tower", holdingId: "h1" });
  });
  it("follows the order E always used for the rest", () => {
    const order: (keyof Nears)[] = ["desk", "drill", "sign", "booth", "stall", "gate", "vault", "watch", "perch", "realm"];
    const val = (k: keyof Nears) => (k === "booth" ? "sal" : k === "stall" ? "h9" : true);
    const kinds = ["desk", "drill", "sign", "booth", "stall", "gate", "vault", "watch", "perch", "realm"];
    order.forEach((k, i) => {
      const rest = order.slice(i).reduce((acc, key) => ({ ...acc, [key]: val(key) }), {} as Partial<Nears>);
      expect(standingAt(court, nears(rest)).kind).toBe(kinds[i]);
    });
  });
  it("reads the shelf before the table, and the table before the door, in a library", () => {
    const lib = { id: "library", holdingId: "h1" } as const;
    expect(standingAt(lib, nears({ shelf: "wall" as never, table: true, libraryDoor: true })).kind).toBe("shelf");
    expect(standingAt(lib, nears({ table: true, libraryDoor: true })).kind).toBe("table");
    expect(standingAt(lib, nears({ libraryDoor: true })).kind).toBe("leave");
  });
  it("ignores courtyard spots while inside, and inside spots while outside", () => {
    expect(standingAt({ id: "library", holdingId: "h1" }, nears({ desk: true, gate: true }))).toEqual({ kind: "none" });
    expect(standingAt(court, nears({ shelves: true, table: true, hallDoor: true }))).toEqual({ kind: "none" });
  });
  it("covers the Town, the Town Hall and the Hall of Records", () => {
    expect(standingAt({ id: "town" }, nears({ building: "townhall", townExit: true }))).toEqual({ kind: "building", id: "townhall" });
    expect(standingAt({ id: "town" }, nears({ townExit: true }))).toEqual({ kind: "leave" });
    expect(standingAt({ id: "townhall" }, nears({ board: "ledger" as never, hallDoor: true })).kind).toBe("board");
    expect(standingAt({ id: "townhall" }, nears({ hallDoor: true }))).toEqual({ kind: "leave" });
    expect(standingAt({ id: "records" }, nears({ shelves: true, archiveDoor: true })).kind).toBe("shelves");
    expect(standingAt({ id: "records" }, nears({ archiveDoor: true }))).toEqual({ kind: "leave" });
  });
});
