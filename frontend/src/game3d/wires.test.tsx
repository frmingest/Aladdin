import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { StandingWire } from "../lib/types";
import QuestLog from "./QuestLog";
import WireList from "./WireList";
import { LOOKED_BUTTON, WIRE_FAILED, lookAtWire, wireLine, wiresToShow } from "./wires";

const wire = (o: Partial<StandingWire> = {}): StandingWire => ({
  tripwire_id: "w1", ticker: "EQNR.OL", name: "Equinor", label: "ROIC under 10%", ...o,
});
const noop = async () => {};

describe("wire words", () => {
  it("name the holding, stay short and never say what to do about it", () => {
    const line = wireLine(wire());
    expect(line).toBe("A wire fired on Equinor. Look at it.");
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(`${line} ${LOOKED_BUTTON}`).not.toMatch(/\b(buy|sell|trim|add|act|decide|agree)\b/i);
    expect(LOOKED_BUTTON.split(/\s+/)).toHaveLength(3);
  });

  it("lists nothing for the sample fortress or when the Standing could not be read", () => {
    expect(wiresToShow([wire()], true)).toEqual([]);
    expect(wiresToShow(undefined, false)).toEqual([]);
    expect(wiresToShow([wire()], false)).toHaveLength(1);
  });
});

describe("looking at a wire", () => {
  it("marks it seen, then reads the Standing again", async () => {
    const calls: string[] = [];
    const r = await lookAtWire("w1", async (id) => { calls.push(`ack ${id}`); }, async () => { calls.push("refresh"); });
    expect(r).toEqual({ ok: true });
    expect(calls).toEqual(["ack w1", "refresh"]);
  });

  it("on a failed save the wire stays unseen: says so and does not re-read as if it worked", async () => {
    const refresh = vi.fn(async () => {});
    const r = await lookAtWire("w1", async () => { throw new Error("500"); }, refresh);
    expect(r).toEqual({ ok: false, message: WIRE_FAILED });
    expect(WIRE_FAILED).toMatch(/still unseen/);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a good mark followed by a failed re-read is still a success (the wire is seen)", async () => {
    const r = await lookAtWire("w1", async () => {}, async () => { throw new Error("down"); });
    expect(r).toEqual({ ok: true });
  });
});

describe("WireList", () => {
  const html = (wires: StandingWire[], demo = false) =>
    renderToStaticMarkup(<WireList wires={wires} demo={demo} onLook={noop} onRefresh={noop} />);

  it("shows one line and one button per fired wire", () => {
    const h = html([wire(), wire({ tripwire_id: "w2", name: "Orkla", label: null })]);
    expect(h).toContain("Wires to look at");
    expect(h).toContain("A wire fired on Equinor. Look at it.");
    expect(h).toContain("A wire fired on Orkla. Look at it.");
    expect(h).toContain("ROIC under 10%");
    expect(h.match(/I have looked/g)).toHaveLength(2);
  });

  it("shows nothing when no wire waits", () => {
    expect(html([])).toBe("");
  });

  it("on the sample fortress says so and offers no button", () => {
    const h = html([wire()], true);
    expect(h).toContain("Sample fortress, not yours");
    expect(h).not.toContain(LOOKED_BUTTON);
    expect(h).not.toContain("Equinor");
  });
});

describe("Quest log wire card", () => {
  const quest = { status: "empty", total: 0, written: 0, missing: [] } as never;
  const reviews = { status: "empty", due: [] } as never;
  const render = (extra: Partial<Parameters<typeof QuestLog>[0]>) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <QuestLog quest={quest} reviews={reviews} demo={false} {...extra} />
      </MemoryRouter>,
    );

  it("looks as it did before when no wires are passed", () => {
    expect(render({})).not.toContain("Wires to look at");
  });

  it("shows the card when wires wait, with the existing calls wired in", () => {
    const h = render({ wires: [wire()], onLookAtWire: noop, onRefreshStanding: noop });
    expect(h).toContain("Wires to look at");
    expect(h).toContain("Equinor");
  });

  it("shows no card when the list is empty", () => {
    expect(render({ wires: [], onLookAtWire: noop, onRefreshStanding: noop })).not.toContain("Wires to look at");
  });
});
