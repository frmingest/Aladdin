import ObjectArtImage from "../../ObjectArtImage";
import LampLogo from "../../LampLogo";
import { useArtMode } from "../../../lib/stitchArt";
import { pennantFor, type PennantShape } from "../../../lib/sectionScene";
import type { RealmLevel } from "../../../lib/realmVerdict";

const FLAG: Record<PennantShape, string> = {
  straight: "M2 2H24V16H2Z",
  swallow: "M2 2H24L18 9L24 16H2Z",
  torn: "M2 2H24L20 5L24 8L19 11L24 16H2Z",
  blank: "M2 2H24V16H2Z",
};

/** The Great Keep wearing the verdict on the whole fortress: the packed keep with a flag on its own pole beside it.
 * The flag's shape is the level (straight, swallowtail, torn, blank "?"), so colour is never alone; the words stay in the
 * card. Unknown fogs the keep. Game mode only: with pictures off the card keeps its lamp mark. */
export default function VerdictKeep({ level }: { level: RealmLevel }) {
  const art = useArtMode() === "stitch";
  const lamp = <LampLogo className="h-11 w-11 shrink-0" />;
  if (!art) return lamp;
  const p = pennantFor(level);
  const unknown = level === "unknown";
  return (
    <div className="flex shrink-0 items-end gap-1" data-testid="verdict-keep" data-level={level}>
      <span className={unknown ? "opacity-45" : ""}>
        <ObjectArtImage id="keep-granite" width={56} fallback={lamp} />
      </span>
      <svg viewBox="0 0 28 34" width="28" height="34" role="img" aria-label={`Flag: ${p.label}`} className={p.tone}>
        <path d="M2 2V33" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path
          d={FLAG[p.shape]}
          fill={p.shape === "blank" ? "none" : "currentColor"}
          fillOpacity={p.shape === "straight" ? 0.55 : 0.9}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray={p.shape === "blank" ? "2 2" : undefined}
          transform="translate(1 0)"
        />
        {p.shape === "blank" && (
          <text x="14" y="13.5" textAnchor="middle" fontSize="11" fill="currentColor">
            ?
          </text>
        )}
      </svg>
    </div>
  );
}
