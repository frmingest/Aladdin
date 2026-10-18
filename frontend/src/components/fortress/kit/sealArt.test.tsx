import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "../../../lib/artManifest";
import { sealArtFor } from "../../../lib/roomArt";
import { SealPicture } from "./SealArt";

describe("Seal art (Design Master Sprint 9)", () => {
  it("tells a note from a warning by the shape of the seal, and the glyph and word stay", () => {
    const note = sealArtFor("notice");
    const warning = sealArtFor("alert");
    expect(note).toMatchObject({ id: "seal-whole", glyph: "i", label: "Note" });
    expect(warning).toMatchObject({ id: "seal-broken", glyph: "!", label: "Warning" });
    for (const l of [note, warning]) expect(Object.keys(ART_MANIFEST)).toContain(l!.id);
  });

  it("gives unknown and none no picture: their dashed ring and ? stay SVG, never a faded known seal", () => {
    expect(sealArtFor("unknown")).toBeNull();
    expect(sealArtFor("none")).toBeNull();
  });

  it("draws the seal picture with its glyph over it and an accessible name, and nothing for unknown", () => {
    const warning = renderToStaticMarkup(<SealPicture kind="alert" long={33} />);
    expect(warning).toContain('aria-label="Warning"');
    expect(warning).toContain(">!<");
    expect(warning).toContain('alt=""');
    const note = renderToStaticMarkup(<SealPicture kind="notice" long={33} />);
    expect(note).toContain('aria-label="Note"');
    expect(note).toContain(">i<");
    expect(renderToStaticMarkup(<SealPicture kind="unknown" long={33} />)).toBe("");
    // beside a printed tone word the picture is decoration, so the word is not read twice
    const beside = renderToStaticMarkup(<SealPicture kind="alert" long={27} decorative />);
    expect(beside).toContain('aria-hidden="true"');
    expect(beside).not.toContain("aria-label");
  });
});
