import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import type { AreaId } from "./areas";
import { DESK } from "./desk";
import { LAND_GATE } from "./holdingLand";
import { NO_NEARS, NO_SPOT_WORLD, SPOTS, pickNear, spotsOf, standingAt, watchSpots } from "./near";
import type { NearTarget, Nears, SpotWorld } from "./near";
import { NPCS } from "./npcs";
import { ARCHIVE_DOOR } from "./recordsHallRoom";
import { HALL_DOOR } from "./townHallRoom";
import { TOWER_DOOR } from "./weatherTowerRoom";

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
    expect(standingAt(court, nears({ tower: "h1", desk: true }))).toEqual({ kind: "tower", id: "h1" });
  });
  it("follows the order E always used for the rest", () => {
    const order: (keyof Nears)[] = ["desk", "drill", "siegeGate", "quarterGate", "sign", "booth", "building", "vault", "watch", "perch", "realm"];
    const val = (k: keyof Nears) => (k === "booth" ? "sal" : k === "building" ? "archive" : true);
    const kinds = order;
    order.forEach((k, i) => {
      const rest = order.slice(i).reduce((acc, key) => ({ ...acc, [key]: val(key) }), {} as Partial<Nears>);
      expect(standingAt(court, nears(rest)).kind).toBe(kinds[i]);
    });
  });
  it("reads a lantern after the shelf and the table but before the gate, in a holding's land", () => {
    const land = { id: "holding", holdingId: "h1" } as const;
    expect(standingAt(land, nears({ lantern: "analysis", landGate: true }))).toEqual({ kind: "lantern", id: "analysis" });
    expect(standingAt(land, nears({ lantern: "analysis", table: true })).kind).toBe("table");
    expect(standingAt({ id: "courtyard" }, nears({ lantern: "analysis" }))).toEqual({ kind: "none" });
  });

  it("reads the shelf before the table, and the table before the gate, in a holding's land", () => {
    const lib = { id: "holding", holdingId: "h1" } as const;
    expect(standingAt(lib, nears({ shelf: "wall" as never, table: true, landGate: true })).kind).toBe("shelf");
    expect(standingAt(lib, nears({ table: true, landGate: true })).kind).toBe("table");
    expect(standingAt(lib, nears({ landGate: true })).kind).toBe("leave");
  });
  it("ignores courtyard spots while inside, and inside spots while outside", () => {
    expect(standingAt({ id: "holding", holdingId: "h1" }, nears({ desk: true, landGate: true }))).toEqual({ kind: "leave" });
    expect(standingAt(court, nears({ shelves: true, table: true, hallDoor: true }))).toEqual({ kind: "none" });
  });
  it("covers the Town doors on the meadow, the Town Hall and the Hall of Records", () => {
    expect(standingAt(court, nears({ building: "townhall" }))).toEqual({ kind: "building", id: "townhall" });
    expect(standingAt(court, nears({ building: "archive", desk: true }))).toEqual({ kind: "desk" });
    expect(standingAt({ id: "townhall" }, nears({ board: "ledger" as never, hallDoor: true })).kind).toBe("board");
    expect(standingAt({ id: "townhall" }, nears({ hallDoor: true }))).toEqual({ kind: "leave" });
    expect(standingAt({ id: "records" }, nears({ shelves: true, archiveDoor: true })).kind).toBe("shelves");
    expect(standingAt({ id: "records" }, nears({ archiveDoor: true }))).toEqual({ kind: "leave" });
  });
});

describe("SPOTS: the one list of things you can walk up to", () => {
  it("has one entry per field of Nears, no more and no fewer", () => {
    expect(SPOTS.map((s) => s.key).sort()).toEqual(Object.keys(NO_NEARS).sort());
  });
  it("puts every spot in a place that exists, and gives every place but the courtyard exactly one way back out, last", () => {
    for (const s of SPOTS) expect(s.area in AREAS).toBe(true);
    for (const id of Object.keys(AREAS) as AreaId[]) {
      const kinds = spotsOf(id).map((s) => s.kind);
      const leaves = kinds.filter((k) => k === "leave");
      if (id === "courtyard") expect(leaves).toEqual([]);
      else {
        expect(leaves).toEqual(["leave"]);
        expect(kinds[kinds.length - 1]).toBe("leave");
      }
    }
  });
  it("keeps the courtyard's order: a person, a door, the desk, and on down to the Realm post", () => {
    expect(spotsOf("courtyard").map((s) => s.key)).toEqual([
      "npc", "tower", "desk", "drill", "siegeGate", "quarterGate", "sign", "booth", "building", "vault", "watch", "perch", "realm",
    ]);
  });
});

describe("watchSpots: one watcher for every place", () => {
  const far = { x: 500, z: 500 };
  it("reports nothing while nothing changes", () => {
    expect(watchSpots("courtyard", far, NO_NEARS, NO_SPOT_WORLD)).toBeNull();
  });
  it("reports the desk on walking up to it, then nothing more, then that it is gone", () => {
    const arrive = watchSpots("courtyard", DESK, NO_NEARS, NO_SPOT_WORLD);
    expect(arrive?.desk).toBe(true);
    const held = { ...NO_NEARS, ...arrive };
    expect(watchSpots("courtyard", DESK, held, NO_SPOT_WORLD)).toBeNull();
    expect(watchSpots("courtyard", far, held, NO_SPOT_WORLD)).toMatchObject({ desk: false });
  });
  it("only asks the spots of the place you are in", () => {
    // The Town Hall, the Hall of Records and the Weather Tower all have their door near the same local point.
    expect(Object.keys(watchSpots("townhall", HALL_DOOR, NO_NEARS, NO_SPOT_WORLD) ?? {})).toEqual(["hallDoor"]);
    expect(Object.keys(watchSpots("records", ARCHIVE_DOOR, NO_NEARS, NO_SPOT_WORLD) ?? {})).toEqual(["archiveDoor"]);
    expect(Object.keys(watchSpots("weather", TOWER_DOOR, NO_NEARS, NO_SPOT_WORLD) ?? {})).toEqual(["weatherDoor"]);
    expect(Object.keys(watchSpots("holding", LAND_GATE, NO_NEARS, NO_SPOT_WORLD) ?? {})).toEqual(["landGate"]);
  });
  it("finds a person by name and holds them out to the leave range", () => {
    const npc = NPCS[0];
    const got = watchSpots("courtyard", npc, NO_NEARS, NO_SPOT_WORLD);
    expect(got?.npc).toBe(npc.id);
  });
  it("reads the towers, the stalls and the lanterns from the world it is given", () => {
    const world: SpotWorld = {
      towers: [{ holdingId: "h1", spot: { x: 200, z: 200 }, radius: 2 }],
      stalls: [{ holdingId: "s1", x: 300, z: 300 }],
      lanterns: [{ check: "analysis", x: 400, z: 400 }],
    };
    expect(watchSpots("courtyard", { x: 200, z: 203 }, NO_NEARS, world)).toMatchObject({ tower: "h1" });
    expect(watchSpots("quarter", { x: 300, z: 300 }, NO_NEARS, world)).toMatchObject({ stall: "s1" });
    expect(watchSpots("holding", { x: 400, z: 400 }, NO_NEARS, world)).toMatchObject({ lantern: "analysis" });
    expect(watchSpots("courtyard", { x: 200, z: 203 }, NO_NEARS, NO_SPOT_WORLD)).toBeNull();
  });
  it("gives the page the same answer the watcher found", () => {
    const got = watchSpots("records", ARCHIVE_DOOR, NO_NEARS, NO_SPOT_WORLD);
    expect(standingAt({ id: "records" }, { ...NO_NEARS, ...got })).toEqual({ kind: "leave" });
  });
});
