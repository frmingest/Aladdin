import { ADVISOR_NAME } from "../../../lib/fortress";
import type { GameAdvisorName } from "../../../lib/types";
import type { SealKind } from "../../../lib/seals";
import { Portrait } from "../AdvisorsCard";
import SealMark from "./SealMark";

/** A character with a speech bubble (page-scene kit): the portrait beside a bubble whose tail points
 * at it. The tone is a seal glyph plus a printed word on the bubble. The bubble carries the same hand-
 * written, rule-chosen text as before; nothing is added and none of it is a quotation. */
export default function Speaker({
  who,
  seal,
  toneLabel,
  side = "left",
  children,
}: {
  who: GameAdvisorName;
  seal: SealKind;
  /** The printed tone word (Warning, Note, Calm). */
  toneLabel: string;
  side?: "left" | "right";
  children: React.ReactNode;
}) {
  const right = side === "right";
  return (
    <li className={`flex items-start gap-3 py-2 ${right ? "flex-row-reverse" : ""}`}>
      <Portrait who={who} />
      <div className={`market-bubble min-w-0 flex-1 text-sm ${right ? "market-bubble-right" : ""}`}>
        <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
          <span>{ADVISOR_NAME[who]}</span>
          <SealMark kind={seal} size={18} />
          <span className="rounded-full border border-current px-2 py-0.5">{toneLabel}</span>
        </p>
        {children}
      </div>
    </li>
  );
}
