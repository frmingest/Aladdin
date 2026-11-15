import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ levers: [], holdings: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("the Printer calls", () => {
  it("asks for the lever book with a plain GET", async () => {
    const calls = stubFetch();
    await api.getPrinterLedger();
    expect(calls[0]).toMatch(/\/game\/printer\/ledger$/);
  });

  it("sends each pull as a repeated lever:size:variant and the span as the horizon", async () => {
    const calls = stubFetch();
    await api.getPrinter(
      [
        { lever: "toll_gate", size: "-1.5", variant: "default" },
        { lever: "harbour_guard", size: "2.5", variant: "sterilised" },
      ],
      3,
    );
    const url = new URL(calls[0], "http://x");
    expect(url.pathname.endsWith("/game/printer")).toBe(true);
    expect(url.searchParams.getAll("pull")).toEqual(["toll_gate:-1.5:default", "harbour_guard:2.5:sterilised"]);
    expect(url.searchParams.get("horizon")).toBe("3");
  });
});
