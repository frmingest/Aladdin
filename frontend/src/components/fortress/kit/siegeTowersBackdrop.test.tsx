import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hasTowersBackdrop, towersBackdropFor, towersBackdropId } from "../../../lib/siegeBackdrop";
import SiegeTowersBackdrop from "./SiegeTowersBackdrop";

describe("SiegeTowersBackdrop", () => {
  it("names one picture per stage", () => {
    expect(towersBackdropId("calm")).toBe("backdrop-siege-towers-calm");
    expect(towersBackdropId("ruin")).toBe("backdrop-siege-towers-ruin");
  });

  it("is quiet and safe whether or not the Stitch pictures are packed yet", () => {
    const html = renderToStaticMarkup(<SiegeTowersBackdrop drop={0.3} />);
    if (hasTowersBackdrop()) {
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('alt=""');
      expect(towersBackdropFor("siege")).not.toBeNull();
    } else {
      expect(html).toBe("");
      expect(towersBackdropFor("siege")).toBeNull();
    }
  });
});
