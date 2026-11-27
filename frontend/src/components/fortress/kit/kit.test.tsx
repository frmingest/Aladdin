import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Crest from "./Crest";
import TorchPair from "./TorchPair";

describe("page-scene kit", () => {
  it("crest and torches are decorative (aria-hidden)", () => {
    expect(renderToStaticMarkup(<Crest kind="records" />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<TorchPair />)).toContain('aria-hidden="true"');
  });
});
