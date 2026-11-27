import type { ReactNode } from "react";

/**
 * The bottom-centre HUD stack (#524): the action prompt on top, the controls hint under it. They used to be placed apart
 * (prompt 4 rem up, hint 1 rem up), so on a phone the hint wrapped to three lines and grew up under the prompt. Stacked, a tall
 * hint pushes the prompt up instead. The hint slot keeps at least 3 rem, so on a desktop, where the hint is one line, and when
 * there is no hint at all, the prompt sits exactly where it always did (4 rem up).
 *
 * On a touch screen (#485) the stack keeps clear of the thumb stick and the action seal: held upright it lifts above them;
 * held sideways it stays low and narrows to the gap between them (`.g3d-hud-lift`).
 */
export default function HudBottomStack({ prompt, hint, lift = false }: { prompt: ReactNode; hint: ReactNode; lift?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 flex flex-col items-center ${lift ? "g3d-hud-lift" : "bottom-4"}`}
      data-testid="hud-bottom-stack"
    >
      {prompt}
      <div className="flex min-h-[3rem] w-full flex-col items-center justify-end">{hint}</div>
    </div>
  );
}
