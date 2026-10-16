import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RoomBackdrop from "./RoomBackdrop";
import RoomProps from "./RoomProps";

describe("RoomProps stays behind the Settings switch", () => {
  it("draws nothing with art off, in every room", () => {
    for (const room of ["records", "chronicle", "council", "circle", "map", "siege", "market", "blindfold", "winter", "fortress"] as const) {
      expect(renderToStaticMarkup(<RoomProps room={room} />)).toBe("");
    }
  });
});

describe("RoomBackdrop stays behind the Settings switch", () => {
  it("draws nothing with art off (the default and the server render), whatever the room", () => {
    for (const room of ["records", "chronicle", "council", "circle", "map", "siege", "market", "blindfold", "winter", "fortress"] as const) {
      expect(renderToStaticMarkup(<RoomBackdrop room={room} />)).toBe("");
    }
  });
});
