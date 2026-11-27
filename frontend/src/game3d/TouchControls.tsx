import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CompassRose, RoseKnob, WaxSealDisc } from "../components/fortress/kit/TouchControlsArt";
import { STICK_RADIUS, STICK_SIZE, knobOffset, releaseStick, sealLabel, sealWord, setStick, stickCentre, stickInput } from "./touchInput";
import type { StickSide } from "./touchInput";
import { TOUCH_TOKENS } from "./gameTokens";
import { TOUCH_WORDS } from "./touchWordsV1";

const KNOB = 44;
const SEAL = 64;

/**
 * The touch controls (#485), shown on a touch screen only: a brass compass rose to walk (bottom-left, or bottom-right for a
 * left hand) and a wax seal to act (the other corner). The page mounts them only while nothing covers the world.
 *
 * - The rose floats: it rests in its corner and jumps to where the thumb lands in its zone. Push to walk, to the rim to run,
 *   let go to stop. It writes the shared stick value the hero reads every frame (no React state per frame).
 * - The seal shows only while the prompt names an E action, with the prompt's first word ("Talk", "Read", "Pull"), and a tap
 *   does what E does (the page's own E handler). No prompt, no seal; it never shows a guess.
 * - Nothing moves unless the thumb moves it; there is no animation of its own, so reduced motion needs nothing more.
 */
export default function TouchControls({ side, prompt, onAct }: { side: StickSide; prompt: string | null; onAct: () => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const rose = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const finger = useRef<{ id: number; cx: number; cy: number } | null>(null);
  const [active, setActive] = useState(false);

  // Unmounting (a panel opened, the page left) or the page hiding lets go, as a key release does, and the rose goes back
  // to its corner.
  useEffect(() => {
    const letGo = () => {
      finger.current = null;
      releaseStick();
      setActive(false);
      const r = rose.current;
      if (r) r.style.left = r.style.top = r.style.right = r.style.bottom = "";
      const k = knob.current;
      if (k) k.style.transform = "";
    };
    const onHide = () => {
      if (document.hidden) letGo();
    };
    window.addEventListener("blur", letGo);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", letGo);
      document.removeEventListener("visibilitychange", onHide);
      releaseStick();
    };
  }, []);

  const place = (cx: number | null, cy: number | null, kx: number, ky: number) => {
    // At rest the stylesheet puts the rose in its corner; while a thumb is down it sits on the thumb.
    const r = rose.current;
    if (r) {
      const held = cx !== null && cy !== null;
      r.style.left = held ? `${cx - STICK_RADIUS}px` : "";
      r.style.top = held ? `${cy - STICK_RADIUS}px` : "";
      r.style.right = held ? "auto" : "";
      r.style.bottom = held ? "auto" : "";
    }
    const k = knob.current;
    if (k) k.style.transform = `translate(${kx}px, ${ky}px)`;
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (finger.current || !zone.current) return;
    e.preventDefault();
    const box = zone.current.getBoundingClientRect();
    const c = stickCentre(e.clientX - box.left, e.clientY - box.top, box.width, box.height);
    finger.current = { id: e.pointerId, cx: c.x, cy: c.y };
    try {
      zone.current.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic pointer cannot be captured; the zone still hears it while it stays inside */
    }
    setActive(true);
    // The thumb may land off the centre the rose was moved to (near an edge): that offset is already a push.
    const dx = e.clientX - box.left - c.x;
    const dy = e.clientY - box.top - c.y;
    const k = knobOffset(dx, dy);
    place(c.x, c.y, k.x, k.y);
    setStick(stickInput(dx, dy));
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const f = finger.current;
    if (!f || f.id !== e.pointerId || !zone.current) return;
    const box = zone.current.getBoundingClientRect();
    const dx = e.clientX - box.left - f.cx;
    const dy = e.clientY - box.top - f.cy;
    const k = knobOffset(dx, dy);
    place(f.cx, f.cy, k.x, k.y);
    setStick(stickInput(dx, dy));
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const f = finger.current;
    if (!f || f.id !== e.pointerId) return;
    finger.current = null;
    releaseStick();
    place(null, null, 0, 0);
    setActive(false);
  };

  const word = sealWord(prompt);
  return (
    <>
      <div
        ref={zone}
        role="group"
        aria-label={TOUCH_WORDS.stick}
        aria-roledescription="thumb stick"
        data-testid="touch-stick"
        data-active={active || undefined}
        className={`g3d-stick-zone ${side === "left" ? "left" : "right"}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      >
        <div ref={rose} className="g3d-stick-rose" style={{ width: STICK_SIZE, height: STICK_SIZE }}>
          <CompassRose size={STICK_SIZE} />
          <div ref={knob} className="g3d-stick-knob" style={{ width: KNOB, height: KNOB, left: STICK_RADIUS - KNOB / 2, top: STICK_RADIUS - KNOB / 2 }}>
            <RoseKnob size={KNOB} />
          </div>
        </div>
      </div>
      {word && prompt && (
        <button
          type="button"
          data-testid="touch-seal"
          className={`g3d-seal ${side === "left" ? "right" : "left"}`}
          // The word's ink and the focus ring come from the tokens (CSS cannot read them).
          style={{ width: SEAL, height: SEAL, color: TOUCH_TOKENS.waxInk, ["--seal-focus" as string]: TOUCH_TOKENS.brassLight }}
          aria-label={sealLabel(prompt)}
          onClick={onAct}
        >
          <WaxSealDisc size={SEAL} />
          <span aria-hidden className={`g3d-seal-word${word.length > 5 ? " long" : ""}`}>
            {word}
          </span>
        </button>
      )}
    </>
  );
}
