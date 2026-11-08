import { describe, expect, it } from "vitest";
import { promptParts } from "./actionPrompt";

describe("promptParts", () => {
  it("splits the key from the action and capitalises it", () => {
    expect(promptParts("Press E to read the signpost")).toEqual({ key: "E", action: "Read the signpost" });
    expect(promptParts("Press E to talk to Sal: open a new stall")).toEqual({ key: "E", action: "Talk to Sal: open a new stall" });
  });

  it("leaves other strings as plain words", () => {
    expect(promptParts("Lantern: Analysis fresh (read 2 days ago)")).toEqual({ key: null, action: "Lantern: Analysis fresh (read 2 days ago)" });
  });

  it("only treats a leading Press X to as a key", () => {
    expect(promptParts("Do not Press E to anything")).toEqual({ key: null, action: "Do not Press E to anything" });
  });
});
