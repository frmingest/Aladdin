import { describe, expect, it } from "vitest";
import { isValidLei, normalizeLei } from "./lei";

describe("LEI", () => {
  it("accepts real LEIs with valid check digits", () => {
    // GLEIF's own LEI and a public ESEF filer on filings.xbrl.org.
    expect(isValidLei("506700GE1G29325QX363")).toBe(true);
    expect(isValidLei("549300OZ3GTYOIZ25011")).toBe(true);
  });

  it("normalises spacing and case", () => {
    expect(normalizeLei(" 549300oz3gtyoiz25011 ")).toBe("549300OZ3GTYOIZ25011");
    expect(isValidLei("549300 oz3g tyoi z25011")).toBe(true);
  });

  it("rejects a typo, a wrong length and letters in the check digits", () => {
    expect(isValidLei("549300OZ3GTYOIZ25012")).toBe(false);
    expect(isValidLei("549300OZ3GTYOIZ2501")).toBe(false);
    expect(isValidLei("549300OZ3GTYOIZ250AB")).toBe(false);
  });
});
