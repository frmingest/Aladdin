import { useId, useState } from "react";
import { dispatchCountHint, dispatchSealLabel } from "../../lib/dispatchSeal";
import "./dispatchSeal.css";

/** Game-mode Night Watch: the closed dispatch is a sealed raven letter with a gilded, button-sized
 * affordance. The wax seal is whole when closed and visibly cracked in two when open (shape, not
 * colour alone); the chevron flips too. Same behaviour as the shared Disclosure: a real button,
 * aria-expanded, content rendered only when open. */
export default function DispatchDisclosure({
  lineCount,
  children,
  className = "",
}: {
  /** Real number of detail lines inside, for the small hint. */
  lineCount: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const hint = dispatchCountHint(lineCount);
  return (
    <div className={`dispatch ${className}`} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="dispatch-btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <SealArt open={open} />
        <span className="dispatch-text">
          <span className="dispatch-label">{dispatchSealLabel(open)}</span>
          {hint && <span className="dispatch-hint">{hint}</span>}
        </span>
        <svg className="dispatch-chevron" viewBox="0 0 20 20" width="20" height="20" aria-hidden>
          <path
            d={open ? "M4 13 L10 7 L16 13" : "M4 7 L10 13 L16 7"}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div id={panelId} className="dispatch-panel">
          {children}
        </div>
      )}
    </div>
  );
}

/** Wax seal with a raven. Intact when closed; when open it is split along a jagged crack into two
 * halves that sit slightly apart. Gradients only (no SVG filters). */
function SealArt({ open }: { open: boolean }) {
  const id = useId().replace(/:/g, "");
  const disc = (
    <>
      <circle cx="24" cy="24" r="20" fill={`url(#wax${id})`} stroke="#3d0d08" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="14.5" fill="none" stroke="#e8a89a" strokeOpacity="0.55" strokeWidth="1.2" />
      {/* a small raven in profile, pressed into the wax */}
      <path
        d="M14 28 Q15 22 21 21 Q22 17 26 17 L31 19 L27 20.5 Q28 23 26 26 L33 31 Q27 30 23 29.5 L19 32 Z"
        fill="#3a0f0a"
        stroke="#f4d9d0"
        strokeOpacity="0.7"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <circle cx="26.6" cy="19.4" r="0.9" fill="#f4d9d0" />
    </>
  );
  return (
    <svg className="dispatch-seal" viewBox="0 0 48 48" width="56" height="56" aria-hidden data-state={open ? "broken" : "whole"}>
      <defs>
        <radialGradient id={`wax${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#c8402f" />
          <stop offset="0.6" stopColor="#8e1f14" />
          <stop offset="1" stopColor="#5e120b" />
        </radialGradient>
        <clipPath id={`l${id}`}>
          <path d="M0 0 H27 L22 12 L28 22 L21 33 L26 48 H0 Z" />
        </clipPath>
        <clipPath id={`r${id}`}>
          <path d="M48 0 H27 L22 12 L28 22 L21 33 L26 48 H48 Z" />
        </clipPath>
      </defs>
      {open ? (
        <>
          <g clipPath={`url(#l${id})`} transform="translate(-3 1) rotate(-6 24 24)">
            {disc}
          </g>
          <g clipPath={`url(#r${id})`} transform="translate(3 -1) rotate(6 24 24)">
            {disc}
          </g>
        </>
      ) : (
        <g className="dispatch-seal-whole">{disc}</g>
      )}
    </svg>
  );
}
