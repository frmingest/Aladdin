import { describe, expect, it } from "vitest";
import {
  addedLine,
  addedMood,
  allSalLines,
  boothLine,
  captureMood,
  checkTicker,
  hintText,
  normalizeTicker,
  rowHasPrice,
  suggestOsloTicker,
  summariseCapture,
  type CaptureSummary,
} from "./salesRep";
import type { NewswebAnnualReports, WatchlistRow } from "./types";

describe("tickers", () => {
  it("normalises case and spaces", () => {
    expect(normalizeTicker("  eqnr .ol ")).toBe("EQNR.OL");
  });

  it("recognises an Oslo Børs symbol and implies NOK", () => {
    const c = checkTicker("eqnr.ol");
    expect(c).toMatchObject({ ticker: "EQNR.OL", kind: "oslo", valid: true, oslo: true, currency: "NOK" });
  });

  it.each([
    ["EQNR.OSL", "EQNR.OL"],
    ["eqnr.no", "EQNR.OL"],
    ["EQNR:OL", "EQNR.OL"],
    ["EQNR-OL", "EQNR.OL"],
    ["OSE:EQNR", "EQNR.OL"],
    ["osl:dnb", "DNB.OL"],
  ])("corrects %s to the Yahoo form", (raw, fixed) => {
    expect(suggestOsloTicker(raw)).toBe(fixed);
    const c = checkTicker(raw);
    expect(c.kind).toBe("fix_oslo");
    expect(c.suggestion).toBe(fixed);
    expect(c.valid).toBe(false); // must be accepted by the user first
    expect(hintText(c)).toContain(fixed);
  });

  it("leaves a correct Oslo symbol alone", () => {
    expect(suggestOsloTicker("EQNR.OL")).toBeNull();
  });

  it("warns on a bare symbol (Yahoo reads it as US) but allows it", () => {
    const c = checkTicker("KO");
    expect(c).toMatchObject({ kind: "no_suffix", valid: true, oslo: false, currency: "USD" });
    expect(hintText(c)).toContain(".OL");
  });

  it("knows other exchanges and their currency", () => {
    expect(checkTicker("VOLV-B.ST")).toMatchObject({ kind: "other_exchange", valid: true, oslo: false, currency: "SEK" });
    expect(checkTicker("NOVO-B.CO").currency).toBe("DKK");
    expect(checkTicker("SAP.DE").currency).toBe("EUR");
    // London quotes in pence, so no guess.
    expect(checkTicker("SHEL.L").currency).toBeNull();
    // Unknown suffix: allowed, no currency guess.
    expect(checkTicker("0700.HK")).toMatchObject({ kind: "other_exchange", valid: true, currency: null });
  });

  it("rejects characters Yahoo symbols do not use", () => {
    expect(checkTicker("EQ NR!")).toMatchObject({ kind: "invalid", valid: false });
    expect(checkTicker("")).toMatchObject({ kind: "empty", valid: false });
  });

  it("always has an Oslo tip before anything is typed", () => {
    expect(hintText(checkTicker(""))).toMatch(/\.OL/);
    expect(hintText(checkTicker(""))).toMatch(/yahoo/i);
  });
});

function reports(over: Partial<NewswebAnnualReports> = {}, n = 0): NewswebAnnualReports {
  return {
    holding_id: "h1",
    history_since: "2022-01-01",
    reports: Array.from({ length: n }, (_, i) => ({ message_id: i })) as unknown as NewswebAnnualReports["reports"],
    newly_imported_this_run: 0,
    already_on_file_this_run: [],
    no_esef_file_this_run: [],
    failed_this_run: [],
    ...over,
  };
}
const ok = (v: NewswebAnnualReports): PromiseSettledResult<NewswebAnnualReports> => ({ status: "fulfilled", value: v });
const bad = (m: string): PromiseSettledResult<NewswebAnnualReports> => ({ status: "rejected", reason: new Error(m) });

describe("summariseCapture", () => {
  it("captured: counts both kinds and the new ones", () => {
    const s = summariseCapture(ok(reports({ newly_imported_this_run: 3 }, 4)), ok(reports({ newly_imported_this_run: 2 }, 3)));
    expect(s).toMatchObject({ outcome: "captured", annualCount: 4, halfYearCount: 3, newlyImported: 5 });
  });

  it("up to date: reports exist but nothing new", () => {
    const s = summariseCapture(ok(reports({ already_on_file_this_run: ["2024"] }, 2)), ok(reports({}, 1)));
    expect(s.outcome).toBe("up_to_date");
    expect(s.alreadyOnFile).toBe(1);
  });

  it("one call failing while the other works is a note, not a failed run", () => {
    const s = summariseCapture(ok(reports({ newly_imported_this_run: 1 }, 1)), bad("no HALF YEAR FINANCIAL REPORT announcement with an attachment found on Newsweb for EQNR"));
    expect(s.outcome).toBe("captured");
    expect(s.notes.join(" ")).toContain("Half-year");
  });

  it("keeps per-report failures and missing attachments as notes", () => {
    const s = summariseCapture(ok(reports({ failed_this_run: ["2023: parse error"], no_esef_file_this_run: ["2022"] }, 1)), ok(reports()));
    expect(s.notes).toEqual(["Annual: 2023: parse error", "Annual: no usable attachment on Newsweb for 2022"]);
  });

  it("empty: both calls worked but nothing exists", () => {
    expect(summariseCapture(ok(reports()), ok(reports())).outcome).toBe("empty");
  });

  it("classifies a failed run from the backend message", () => {
    const off = "the Newsweb annual-report fetch is switched off (NEWSWEB_FILING_PROVIDER)";
    expect(summariseCapture(bad(off), bad(off)).outcome).toBe("switched_off");
    expect(summariseCapture(bad("Newsweb covers Oslo Børs issuers only (.OL ticker or NOK) — this holding doesn't look like one"), bad("x")).outcome).toBe("not_oslo");
    expect(summariseCapture(bad("no ANNUAL FINANCIAL REPORT announcement with an attachment found on Newsweb for ZZZZ"), bad("no HALF YEAR ... found on Newsweb")).outcome).toBe("not_found");
    const s = summariseCapture(bad("network down"), bad("network down"));
    expect(s.outcome).toBe("failed");
    expect(s.detail).toBe("network down");
  });

  it("a switched-off message outranks a not-found one", () => {
    const s = summariseCapture(bad("found on Newsweb"), bad("switched off"));
    expect(s.outcome).toBe("switched_off");
    expect(s.detail).toBe("switched off");
  });

  it("moods follow the outcome", () => {
    expect(captureMood("captured")).toBe("cheer");
    expect(captureMood("up_to_date")).toBe("cheer");
    expect(captureMood("not_found")).toBe("think");
    expect(captureMood("failed")).toBe("oops");
  });
});

describe("price check", () => {
  const base = { price: "100", status: "no_target" } as unknown as WatchlistRow;
  it("reads Yahoo's answer from the stored row", () => {
    expect(rowHasPrice(base)).toBe(true);
    expect(rowHasPrice({ ...base, price: null })).toBe(false);
    expect(rowHasPrice({ ...base, status: "no_price" })).toBe(false);
    expect(rowHasPrice(undefined)).toBeNull();
  });

  it("Sal is worried, not cheerful, when there is no price, and says why", () => {
    const f = { name: "Acme", ticker: "ACME.OL", owned: false, hasPrice: false, oslo: true };
    expect(addedMood(f)).toBe("think");
    expect(addedLine(f)).toContain("no price for ACME.OL");
    expect(addedMood({ ...f, hasPrice: true })).toBe("cheer");
    expect(addedMood({ ...f, hasPrice: null })).toBe("cheer");
  });

  it("only offers the Newsweb runners for Oslo Børs symbols", () => {
    const f = { name: "Acme", ticker: "ACME", owned: false, hasPrice: null, oslo: false };
    expect(addedLine({ ...f, oslo: true })).toContain("Newsweb to haul back");
    expect(addedLine(f)).toContain("no report runners");
  });
});

describe("Sal's wording", () => {
  const FORBIDDEN = /\b(buy|buying|sell|selling|purchase|invest|investing|investment|guarantee|guaranteed|can't lose|moon|sure thing|winner|trim|rally|crash)\b/i;
  it("never gives advice, hype about returns, or talks of trades", () => {
    for (const line of allSalLines()) expect(line, line).not.toMatch(FORBIDDEN);
  });

  it("is not a real person's name or catchphrase", () => {
    for (const line of allSalLines()) expect(line, line).not.toMatch(/cramer|booyah|mad money/i);
  });

  it("has no empty line and every booth line is selectable", () => {
    for (const line of allSalLines()) expect(line.trim().length).toBeGreaterThan(5);
    expect(new Set([0, 1, 2, 3, 4, 5].map(boothLine)).size).toBe(4);
  });

  it("always says what Newsweb will and will not do", () => {
    const captured: CaptureSummary = { outcome: "captured", annualCount: 2, halfYearCount: 1, newlyImported: 3, alreadyOnFile: 0, notes: [], detail: null };
    // Rule 1 of the app: half-year PDFs add no numbers; Sal must not oversell them.
    expect(allSalLines().some((l) => /half-year reports are reading material only/i.test(l))).toBe(true);
    expect(captured.outcome).toBe("captured");
  });
});
