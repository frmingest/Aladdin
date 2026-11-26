import { describe, expect, it } from "vitest";
import { REGISTER } from "./parity3d";
import {
  ARCHIVE,
  ARCHIVE_DOOR,
  ARCHIVE_SPAWN,
  BOOK,
  BOOKCASE,
  BOOKCASE_BACK_FRONT_Z,
  BOOKCASE_PANEL,
  BOOKCASE_SIDE_FRONT_Z,
  BOOKCASE_XS,
  ROW_YS,
  CAPACITY,
  RECORDS_ROUTE,
  SHELF_RANGE,
  SHELF_SPOT,
  archiveExit,
  bookPlans,
  bookSlot,
  dustSheets,
  nearArchiveDoor,
  nearShelves,
  shelfFacts,
  BOOKCASE_SHELF_FRONT_Z,
  DUST_SHEET_T,
  shelfLook,
  shelfPlate,
  SEAL_SHAPE_OF,
} from "./recordsHallRoomLogic";
import { RECORDS_HALL_NOT_READ, RECORDS_HALL_READ_FAILED } from "./recordsHallWordsV1";
import { BUILDINGS, DOOR_LEAVE_RANGE, DOOR_RANGE, doorSpot, nearestBuilding } from "./townPlan";
import { SEAL_LOOK, tomeFor } from "../lib/hall";
import type { DecisionRecord, RecordReviewState } from "../lib/types";

const BUY_SELL = /\b(buy|sell|trade|invest)\b/i;

function rec(n: number, over: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: `r${n}`,
    holding_id: null,
    ticker: `T${n}`,
    company_name: `Company ${n}`,
    action: ["buy", "add", "trim", "sell", "hold", "pass"][n % 6],
    decided_on: "2026-01-01",
    days_since: 100 + n,
    thesis: "t",
    invalidation: null,
    confidence: null,
    verdict_then: null,
    verdict_now: null,
    price_then: null,
    price_now: null,
    price_now_at: null,
    currency: null,
    price_change_pct: null,
    price_note: null,
    review_6m: "pending" as RecordReviewState,
    review_12m: "pending" as RecordReviewState,
    review_6m_text: null,
    review_12m_text: null,
    ...over,
  } as DecisionRecord;
}

describe("the Hall of Records inside", () => {
  it("opens the Records page, which is a Town door in the register", () => {
    const row = REGISTER.find((d) => d.route === RECORDS_ROUTE);
    expect(row?.place).toBe("town");
  });

  it("is entered at the Hall of Records building's door, and steps out a few steps from it, out of its reach", () => {
    const b = BUILDINGS.find((x) => x.id === "records");
    expect(b).toBeDefined();
    const out = archiveExit();
    expect(nearestBuilding(doorSpot(b!), BUILDINGS, DOOR_RANGE)).toBe("records");
    expect(nearestBuilding(out, BUILDINGS, DOOR_LEAVE_RANGE)).toBeNull();
  });

  it("keeps the spawn, the shelf spot and the door inside the room, the spawn clear of the door and the shelves", () => {
    expect(ARCHIVE_SPAWN.x).toBeGreaterThan(ARCHIVE.minX);
    expect(ARCHIVE_SPAWN.z).toBeLessThan(ARCHIVE.maxZ);
    expect(nearArchiveDoor(ARCHIVE_SPAWN)).toBe(false);
    expect(nearShelves(ARCHIVE_SPAWN)).toBe(false);
    expect(nearShelves(SHELF_SPOT)).toBe(true);
    expect(nearArchiveDoor({ x: ARCHIVE_DOOR.x, z: ARCHIVE_DOOR.z - 1 })).toBe(true);
    expect(SHELF_SPOT.z).toBeLessThan(ARCHIVE.maxZ);
    // The shelf spot is not inside a bookcase (the front of a case is at its z plus half its depth).
    expect(SHELF_SPOT.z).toBeGreaterThan(BOOKCASE.z + BOOKCASE.d / 2);
  });

  it("holds every slot on a bookcase, without two books overlapping, in the room", () => {
    const slots = Array.from({ length: CAPACITY }, (_, i) => bookSlot(i));
    for (const s of slots) {
      expect(s.y - BOOK.h / 2).toBeGreaterThan(0);
      expect(s.x).toBeGreaterThan(ARCHIVE.minX);
      expect(s.x).toBeLessThan(ARCHIVE.maxX);
    }
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const sameRow = slots[i].y === slots[j].y;
        const gap = Math.abs(slots[i].x - slots[j].x);
        if (sameRow) expect(gap, `${i} and ${j}`).toBeGreaterThanOrEqual(BOOK.w);
      }
    }
    for (const c of BOOKCASE_XS) {
      const inCase = slots.filter((s) => Math.abs(s.x - c) < BOOKCASE.w / 2);
      expect(inCase.length).toBeGreaterThan(0);
      for (const s of inCase) {
        expect(s.x - BOOK.w / 2).toBeGreaterThanOrEqual(c - BOOKCASE.w / 2);
        expect(s.x + BOOK.w / 2).toBeLessThanOrEqual(c + BOOKCASE.w / 2);
      }
    }
  });

  it("draws one same-size book per record, in the record order, up to the shelf capacity", () => {
    const records = Array.from({ length: 5 }, (_, i) => rec(i));
    const plans = bookPlans(records);
    expect(plans.map((p) => p.id)).toEqual(records.map((r) => r.id));
    const many = Array.from({ length: CAPACITY + 7 }, (_, i) => rec(i));
    expect(bookPlans(many)).toHaveLength(CAPACITY);
    expect(bookPlans([])).toEqual([]);
  });

  it("takes each book's leather, letter and ribbon from the flat Hall's own mapping", () => {
    const records = [rec(0), rec(1, { review_6m: "due" }), rec(2, { review_12m: "written" })];
    const plans = bookPlans(records);
    plans.forEach((p, i) => expect(p.tome).toEqual(tomeFor(records[i])));
    expect(plans.map((p) => p.tome.owed)).toEqual([false, true, false]);
  });

  it("does not draw a book better or worse for its outcome", () => {
    const a = bookPlans([rec(4, { price_change_pct: "42.0", verdict_now: "strong" })])[0];
    const b = bookPlans([rec(4, { price_change_pct: "-60.0", verdict_now: "weak" })])[0];
    expect(a).toEqual(b);
  });

  it("tells the seals apart by shape, the same three states the flat Hall prints", () => {
    expect(new Set(Object.values(SEAL_SHAPE_OF)).size).toBe(3);
    expect(SEAL_SHAPE_OF.sealed).toBe("disc");
    expect(SEAL_SHAPE_OF.unsealed).toBe("split");
    expect(SEAL_SHAPE_OF.opened).toBe("ring");
    expect(Object.keys(SEAL_SHAPE_OF).sort()).toEqual(Object.keys(SEAL_LOOK).sort());
  });

  it("counts the decisions, the ribbons and the ones that did not fit, exactly", () => {
    const records = Array.from({ length: CAPACITY + 3 }, (_, i) => rec(i, i === 0 || i === 1 ? { review_6m: "due" } : {}));
    const f = shelfFacts(records);
    expect(f).toEqual({ total: CAPACITY + 3, shown: CAPACITY, more: 3, owed: 2 });
    expect(shelfFacts([])).toEqual({ total: 0, shown: 0, more: 0, owed: 0 });
  });

  it("keeps the plate in short plain words, with no buy or sell words and no picture characters", () => {
    const states = [null, shelfFacts([]), shelfFacts([rec(0)]), shelfFacts([rec(0, { review_12m: "due" }), rec(1)]), shelfFacts(Array.from({ length: CAPACITY + 1 }, (_, i) => rec(i)))];
    for (const f of states) {
      const text = shelfPlate(f).join("\n");
      expect(text).not.toMatch(BUY_SELL);
      expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{25A0}-\u{25FF}]/u);
    }
    expect(shelfPlate(null)).toEqual(["The Hall of Records", "Not read yet."]);
    expect(shelfPlate(shelfFacts([rec(0)]))[1]).toBe("1 decision on the shelves");
    expect(shelfPlate(shelfFacts([rec(0, { review_6m: "due" }), rec(1)])).join("|")).toContain("1 book wears a ribbon");
    expect(shelfPlate(shelfFacts(Array.from({ length: CAPACITY + 2 }, (_, i) => rec(i)))).join("|")).toContain("2 more in the page");
  });

  it("leaves the door's reach narrower than the shelves' reach so the two prompts never overlap at the spawn", () => {
    expect(SHELF_RANGE).toBeGreaterThan(0);
    expect(nearArchiveDoor(SHELF_SPOT)).toBe(false);
  });
});

describe("the hollow bookcase (#502)", () => {
  it("keeps every book in front of the back panel, no further out than the sides, and standing on a shelf", () => {
    for (let i = 0; i < CAPACITY; i++) {
      const s = bookSlot(i);
      expect(s.z - BOOK.d / 2).toBeGreaterThan(BOOKCASE_BACK_FRONT_Z);
      expect(s.z + BOOK.d / 2).toBeLessThanOrEqual(BOOKCASE_SIDE_FRONT_Z);
      const bottom = s.y - BOOK.h / 2;
      expect(ROW_YS.some((y) => Math.abs(y - bottom) < 1e-9)).toBe(true);
    }
  });

  it("keeps the books' depth within the shelf boards' depth", () => {
    const localBookZ = bookSlot(0).z - BOOKCASE.z;
    const { shelfZ, shelfD } = BOOKCASE_PANEL;
    expect(localBookZ - BOOK.d / 2).toBeGreaterThanOrEqual(shelfZ - shelfD / 2);
    expect(localBookZ + BOOK.d / 2).toBeLessThanOrEqual(shelfZ + shelfD / 2);
  });
});

describe("unknown shelves are fog, not bare (#505)", () => {
  it("tells loading or a failed read apart from an empty journal", () => {
    expect(shelfLook(undefined)).toBe("fog");
    expect(shelfLook(null)).toBe("fog");
    expect(shelfLook([])).toBe("bare");
    expect(shelfLook([rec(0)])).toBe("books");
  });

  it("puts no number on the not-read plate, and a different line from the empty journal", () => {
    const fog = shelfPlate(null);
    const failed = shelfPlate(null, true);
    for (const plate of [fog, failed]) {
      expect(plate.join(" ")).not.toMatch(/\d/);
      expect(plate).not.toEqual(shelfPlate(shelfFacts([])));
    }
    expect(fog[1]).toBe(RECORDS_HALL_NOT_READ);
    expect(failed[1]).toBe(RECORDS_HALL_READ_FAILED);
    // A failed flag never hides a journal that was read.
    expect(shelfPlate(shelfFacts([rec(0)]), true)[1]).toBe("1 decision on the shelves");
  });

  it("hangs one dust sheet over each bookcase's open front, covering both rows of books", () => {
    const sheets = dustSheets();
    expect(sheets.map((s) => s.x)).toEqual([...BOOKCASE_XS]);
    for (const s of sheets) {
      // The sheet's back face hangs clear of the side boards and the shelf boards (which stand out further; #505 review).
      const back = s.z - DUST_SHEET_T / 2;
      expect(back).toBeGreaterThan(BOOKCASE_SIDE_FRONT_Z + 0.02);
      expect(back).toBeGreaterThan(BOOKCASE_SHELF_FRONT_Z + 0.02);
      // The fold rests on the case top and reaches back no further than the case.
      expect(s.y + s.h / 2).toBeCloseTo(BOOKCASE.h);
      expect(s.foldD).toBeLessThanOrEqual(BOOKCASE.d);
      expect(s.w).toBeGreaterThanOrEqual(BOOKCASE.w);
      expect(s.y - s.h / 2).toBeLessThanOrEqual(ROW_YS[0]);
      expect(s.y + s.h / 2).toBeGreaterThanOrEqual(ROW_YS[ROW_YS.length - 1] + BOOK.h);
    }
  });
});
