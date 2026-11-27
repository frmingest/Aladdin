import type { ReactNode } from "react";

/**
 * The bottom-centre HUD stack (#524): the action prompt on top, the controls hint under it. They used to be placed apart
 * (prompt 4 rem up, hint 1 rem up), so on a phone the hint wrapped to three lines and grew up under the prompt. Stacked, a tall
 * hint pushes the prompt up instead. The hint slot keeps at least 3 rem, so on a desktop, where the hint is one line, and when
 * there is no hint at all, the prompt sits exactly where it always did (4 rem up).
 */
export default function HudBottomStack({ prompt, hint }: { prompt: ReactNode; hint: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center" data-testid="hud-bottom-stack">
      {prompt}
      <div className="flex min-h-[3rem] w-full flex-col items-center justify-end">{hint}</div>
    </div>
  );
}
