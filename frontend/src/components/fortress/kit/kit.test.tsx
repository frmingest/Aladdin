import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Crest from "./Crest";
import FogPanel from "./FogPanel";
import SealMark from "./SealMark";
import TorchPair from "./TorchPair";

describe("page-scene kit", () => {
  it("SealMark prints its word and never relies on colour: shape, glyph and label differ", () => {
    const a = renderToStaticMarkup(<SealMark kind="alert" showLabel />);
    const n = renderToStaticMarkup(<SealMark kind="notice" showLabel />);
    const u = renderToStaticMarkup(<SealMark kind="unknown" showLabel />);
    expect(a).toContain("Warning");
    expect(n).toContain("Note");
    expect(u).toContain("Unknown");
    expect(a).toContain("<path");
    expect(n).toContain("<circle");
    expect(u).toContain("stroke-dasharray");
    expect(a).toContain(">!<");
    expect(u).toContain(">?<");
  });

  it("a seal without a printed label is named for screen readers", () => {
    expect(renderToStaticMarkup(<SealMark kind="alert" />)).toContain('aria-label="Warning"');
  });

  it("FogPanel shows one ? per unknown and nothing when there is nothing unknown", () => {
    const html = renderToStaticMarkup(<FogPanel title="Fog" lines={["a", "b"]} />);
    expect((html.match(/>\?</g) ?? []).length).toBe(2);
    expect(renderToStaticMarkup(<FogPanel title="Fog" lines={[]} />)).toBe("");
  });

  it("crest and torches are decorative (aria-hidden)", () => {
    expect(renderToStaticMarkup(<Crest kind="records" />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<TorchPair />)).toContain('aria-hidden="true"');
  });
});
