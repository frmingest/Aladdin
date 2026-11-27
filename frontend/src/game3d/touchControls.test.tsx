import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ActionPrompt from "./ActionPrompt";
import { DEFAULT_PANELS } from "./hudPanels";
import Toolbar from "./Toolbar";
import TouchControls from "./TouchControls";

const noop = () => {};

describe("TouchControls (#485)", () => {
  it("shows the seal with the prompt's word, named by the whole action", () => {
    const h = renderToStaticMarkup(<TouchControls side="left" prompt="Press E to talk to Barren Wuffet" onAct={noop} />);
    expect(h).toContain('data-testid="touch-seal"');
    expect(h).toContain('aria-label="Talk to Barren Wuffet"');
    expect(h).toMatch(/>Talk<\/span>/);
    // The stick is a named control too.
    expect(h).toContain('aria-label="Walk"');
  });

  it("shows no seal without a prompt, or for a prompt that is not an E action", () => {
    expect(renderToStaticMarkup(<TouchControls side="left" prompt={null} onAct={noop} />)).not.toContain("touch-seal");
    expect(renderToStaticMarkup(<TouchControls side="left" prompt="Pull a lever first, then STAMP" onAct={noop} />)).not.toContain("touch-seal");
  });

  it("puts the stick and the seal on opposite sides, and swaps them for a left hand", () => {
    const right = renderToStaticMarkup(<TouchControls side="left" prompt="Press E to read the signpost" onAct={noop} />);
    expect(right).toContain("g3d-stick-zone left");
    expect(right).toContain("g3d-seal right");
    const left = renderToStaticMarkup(<TouchControls side="right" prompt="Press E to read the signpost" onAct={noop} />);
    expect(left).toContain("g3d-stick-zone right");
    expect(left).toContain("g3d-seal left");
  });

  it("draws the controls 44 px or larger", () => {
    const h = renderToStaticMarkup(<TouchControls side="left" prompt="Press E to read the signpost" onAct={noop} />);
    expect(h).toContain("width:96px;height:96px");
    expect(h).toContain("width:64px;height:64px");
  });
});

describe("ActionPrompt on a touch screen", () => {
  it("is plain words: no key cap and no second button beside the seal", () => {
    const h = renderToStaticMarkup(<ActionPrompt text="Press E to talk to Barren Wuffet" touch />);
    expect(h).toContain("Talk to Barren Wuffet");
    expect(h).not.toContain("<button");
    expect(h).not.toContain("<kbd");
  });
  it("drops 'Press E' from a prompt worded another way", () => {
    expect(renderToStaticMarkup(<ActionPrompt text="Press E: look 3 years ahead" touch />)).toContain(">Look 3 years ahead<");
  });
  it("keeps the key cap and the button with a keyboard", () => {
    const h = renderToStaticMarkup(<ActionPrompt text="Press E to talk to Barren Wuffet" />);
    expect(h).toContain("<button");
    expect(h).toContain("<kbd");
  });
});

describe("Toolbar's swap-hands chip", () => {
  const html = (hands?: { side: "left" | "right"; onSwap: () => void }) =>
    renderToStaticMarkup(
      <Toolbar open={DEFAULT_PANELS} onToggle={noop} questsWaiting={0} towerCount={0} statsOn={false} statsLabel="" onToggleStats={noop} whereOpen={false} onToggleWhere={noop} hands={hands} />,
    );
  it("shows only on a touch screen, named for what it does", () => {
    expect(html()).not.toContain("Swap hands");
    expect(html({ side: "left", onSwap: noop })).toContain('aria-label="Swap hands: stick to the right"');
    expect(html({ side: "right", onSwap: noop })).toContain('aria-label="Swap hands: stick to the left"');
  });
});
