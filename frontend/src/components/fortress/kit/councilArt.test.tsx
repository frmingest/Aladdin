import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "../../../lib/artManifest";
import { candleTops, councilFurniture, roomPropIds, sealArtFor } from "../../../lib/roomArt";
import { councilSeats } from "../../../lib/councilSeats";
import ChamberFurniture from "./ChamberFurniture";
import CouncilChamber from "./CouncilChamber";
import { SealPicture } from "./SealArt";

describe("Council art (Design Master Sprint 9)", () => {
  it("stands the inkwell and the agenda scroll in the Council banner; the gavel is not used (nothing is decided here)", () => {
    expect(roomPropIds("council")).toEqual(["room-inkwell", "room-scroll"]);
    expect(Object.keys(ART_MANIFEST).some((id) => id.includes("gavel"))).toBe(false);
  });

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
    // beside a printed tone word (the agenda bubbles) the picture is decoration, so the word is not read twice
    const beside = renderToStaticMarkup(<SealPicture kind="alert" long={27} decorative />);
    expect(beside).toContain('aria-hidden="true"');
    expect(beside).not.toContain("aria-label");
  });

  it("packs every furniture picture and puts a candle on each of the three holders", () => {
    expect(councilFurniture()).toEqual({ table: "council-table", chair: "council-chair", candles: "council-candles" });
    expect(candleTops()).toHaveLength(3);
    for (const [x, y] of candleTops()) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(0.5);
    }
  });

  it("builds the furniture as decoration only: a table, the two advisors seated on chairs, two candle stands, constant flames, no words", () => {
    const html = renderToStaticMarkup(<ChamberFurniture oracle={<i>O</i>} partner={<i>P</i>} />);
    expect((html.match(/<img /g) ?? []).length).toBe(5); // table, two seated advisers (chair included), two candle stands
    expect((html.match(/<svg /g) ?? []).length).toBe(6); // three flames on each stand
    expect(html).toContain("chamber-art-sit-left");
    expect(html).toContain("chamber-art-sit-right");
    expect(html).not.toMatch(/<(button|a)\b/);
    expect(html).not.toMatch(/animation|animate|flicker/i);
    expect(html.replace(/<[^>]+>/g, "").trim()).toBe(""); // no words: the advisers are in the pictures
  });

  it("leaves the chamber exactly as it was with Object art off (the default): no picture, the painted table, the same seats", () => {
    const html = renderToStaticMarkup(
      <CouncilChamber
        seats={councilSeats({ items: [{ kind: "review_due", tone: "warning", title: "t", detail: "d", holdings: [], more: 0 }] as never })}
        onJump={() => {}}
      />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("<ellipse");
    expect(html).toContain("<button");
  });
});
