import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StarterCheckCard from "./StarterCheckCard";
import { SETTLE_MS, choiceForKey } from "./checkCardLogic";
import type { CheckChoice } from "./checkCardLogic";

const CARD: CheckChoice[] = [
  { id: "timber", label: "Timber", tried: true },
  { id: "granite", label: "Granite" },
  { id: "rotted", label: "Rotted" },
];
const calm = { repeat: false, now: 1000, settledAt: 0 };

describe("check card slots (#494 review: a double tap must not win)", () => {
  it("digit n is always slot n: after a miss on slot 1, pressing 1 again picks nothing", () => {
    expect(choiceForKey(CARD, "Digit1", calm)).toBeNull();
    expect(choiceForKey(CARD, "Digit2", calm)?.id).toBe("granite");
    expect(choiceForKey(CARD, "Numpad3", calm)?.id).toBe("rotted");
    expect(choiceForKey(CARD, "Digit4", calm)).toBeNull();
  });

  it("a held key's repeat and a pick before the card settles after a miss pick nothing", () => {
    expect(choiceForKey(CARD, "Digit2", { ...calm, repeat: true })).toBeNull();
    expect(choiceForKey(CARD, "Digit2", { repeat: false, now: 100, settledAt: 100 + SETTLE_MS })).toBeNull();
    expect(choiceForKey(CARD, "Digit2", { repeat: false, now: 100 + SETTLE_MS, settledAt: 100 + SETTLE_MS })?.id).toBe("granite");
  });

  it("a tried slot keeps its place, blank: no words, no button, hidden from screen readers", () => {
    const html = renderToStaticMarkup(
      <StarterCheckCard title="Knock on the walls. Which walls?" line={{ who: "marlie", text: "Look again." }} missed choices={CARD} onPick={() => {}} onClose={() => {}} />,
    );
    expect(html).not.toContain("Timber");
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toMatch(/<li aria-hidden="true"[^>]*><\/li>/);
    // The others keep their own key numbers (2 and 3), not 1 and 2.
    expect(html).toMatch(/Granite<\/span><kbd[^>]*>2<\/kbd>/);
    expect(html).toMatch(/Rotted<\/span><kbd[^>]*>3<\/kbd>/);
  });
});
