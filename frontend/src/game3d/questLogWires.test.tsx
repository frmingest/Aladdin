import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { StandingWire } from "../lib/types";
import QuestLog from "./QuestLog";
import { WIRE_BUTTON, WIRE_TITLE } from "./wireWords";

const quest = { status: "open", total: 2, written: 1, missing: [] } as unknown as Parameters<typeof QuestLog>[0]["quest"];
const reviews = { status: "clear" } as unknown as Parameters<typeof QuestLog>[0]["reviews"];
const wires: StandingWire[] = [
  { id: "w1", ticker: "AKRBP.OL", label: "Margin below 10%" },
  { id: "w2", ticker: "", label: "pe" },
];

function html(props: Partial<Parameters<typeof QuestLog>[0]> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <QuestLog quest={quest} reviews={reviews} demo={false} {...props} />
    </MemoryRouter>,
  );
}

describe("Quest log: wires that fired", () => {
  it("names each fired, unseen wire with one button each", () => {
    const h = html({ wires, onLook: async () => ({ ok: true }) });
    expect(h).toContain(WIRE_TITLE);
    expect(h).toContain("A wire fired on AKRBP.OL. Look at it.");
    expect(h).toContain("A wire fired. Look at it.");
    expect(h).toContain("Margin below 10%");
    expect(h.split(WIRE_BUTTON).length - 1).toBe(2);
  });

  it("draws no card when there are no wires, and the quests stay as they were", () => {
    for (const h of [html(), html({ wires: [] })]) {
      expect(h).not.toContain(WIRE_TITLE);
      expect(h).toContain("Quests");
    }
  });

  it("lists without a button when it cannot mark anything", () => {
    const h = html({ wires });
    expect(h).toContain("A wire fired on AKRBP.OL. Look at it.");
    expect(h).not.toContain(WIRE_BUTTON);
  });
});
