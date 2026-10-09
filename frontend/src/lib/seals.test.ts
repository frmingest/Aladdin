import { describe, expect, it } from "vitest";
import { SEAL_LOOK, sealForTone, sealSignature, type SealKind } from "./seals";

describe("seals", () => {
  const kinds = Object.keys(SEAL_LOOK) as SealKind[];

  it("every seal differs from every other by shape, glyph and printed word (never colour alone)", () => {
    for (const a of kinds) {
      for (const b of kinds) {
        if (a === b) continue;
        expect(SEAL_LOOK[a].shape).not.toBe(SEAL_LOOK[b].shape);
        expect(SEAL_LOOK[a].label).not.toBe(SEAL_LOOK[b].label);
        expect(sealSignature(a)).not.toBe(sealSignature(b));
      }
    }
  });

  it("maps council tones: warning is an alert, everything else a plain note", () => {
    expect(sealForTone("warning")).toBe("alert");
    expect(sealForTone("note")).toBe("notice");
    expect(sealForTone("calm")).toBe("notice");
  });

  it("uses no wording that promises or praises", () => {
    for (const k of kinds) expect(SEAL_LOOK[k].label).not.toMatch(/\b(good|great|safe|all clear|well|win|score|reward)\b/i);
  });
});
