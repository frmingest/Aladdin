import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MagicLamp from "./MagicLamp";

describe("MagicLamp (embedded in the 3D desk)", () => {
  it("opens the Genie's dialog at once, with the three wishes and no corner lamp", () => {
    const h = renderToStaticMarkup(<MagicLamp embedded onClose={() => {}} />);
    expect(h).toContain("The Genie of the Lamp");
    expect(h).toContain("Your three wishes");
    expect(h).not.toContain("Rub the magic lamp");
  });

  it("is unchanged on the flat page: the corner lamp, and no dialog until it is rubbed", () => {
    const h = renderToStaticMarkup(<MagicLamp />);
    expect(h).toContain("Rub the magic lamp");
    expect(h).not.toContain("The Genie of the Lamp");
  });
});
