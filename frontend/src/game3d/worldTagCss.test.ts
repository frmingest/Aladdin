import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * #439: a wrapping world tag (`wrap` + maxWidth) sat in drei's narrow Html wrapper and broke one word per line.
 * jsdom does no layout, so this pins the rule that fixes it rather than measuring a width.
 */
describe("world tag wrap rule", () => {
  const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
  const rule = css.split("\n").find((l) => l.startsWith(".g3d-worldtag.wrap {")) ?? "";

  it("lets text wrap", () => {
    expect(rule).toContain("white-space: normal");
  });

  it("sizes the tag to its text, so maxWidth is the only limit", () => {
    expect(rule).toContain("width: max-content");
  });
});
