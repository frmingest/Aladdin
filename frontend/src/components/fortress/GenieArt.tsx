import { useId } from "react";
import type { Wish } from "../../lib/genie";

/** Hand-drawn SVG for the Genie of the Lamp (G11). An invented, generic genie: no likeness of any
 * film or TV character. Fixed colours on purpose, like the lamp logo and the other painted pieces. */

export function GenieFigure({ mood = "happy", className = "h-44 w-36" }: { mood?: "happy" | "wow" | "sorry"; className?: string }) {
  const p = `gn${useId().replace(/:/g, "")}`;
  return (
    <svg aria-hidden viewBox="0 0 140 180" className={`genie-figure ${className}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${p}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fd2ff" />
          <stop offset="0.55" stopColor="#2f7fe0" />
          <stop offset="1" stopColor="#1b3f9a" />
        </linearGradient>
        <linearGradient id={`${p}-tail`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7fe0" />
          <stop offset="1" stopColor="#2f7fe0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${p}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.5" stopColor="#e0a232" />
          <stop offset="1" stopColor="#8a5412" />
        </linearGradient>
        <radialGradient id={`${p}-ruby`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffb3b3" />
          <stop offset="0.4" stopColor="#e0243a" />
          <stop offset="1" stopColor="#6a0a1c" />
        </radialGradient>
      </defs>
      {/* the curling smoke tail */}
      <path
        d="M70 118 C44 128 40 146 62 154 C86 162 92 172 70 180 L96 180 C122 168 114 150 92 142 C78 136 84 126 96 120 Z"
        fill={`url(#${p}-tail)`}
      />
      {/* torso and arms */}
      <path d="M38 112 C34 82 52 70 70 70 C88 70 106 82 102 112 C98 130 84 136 70 136 C56 136 42 130 38 112 Z" fill={`url(#${p}-body)`} stroke="#14275a" strokeWidth="1.6" />
      <path d="M40 98 C58 110 82 110 100 98 L104 108 C84 124 56 124 36 108 Z" fill="#2a66c4" stroke="#14275a" strokeWidth="1.2" />
      <rect x="31" y="100" width="12" height="7" rx="3" fill={`url(#${p}-gold)`} stroke="#6e4a12" transform="rotate(-18 37 103)" />
      <rect x="97" y="100" width="12" height="7" rx="3" fill={`url(#${p}-gold)`} stroke="#6e4a12" transform="rotate(18 103 103)" />
      {/* sash */}
      <path d="M44 116 C60 126 80 126 96 116 L94 124 C80 134 60 134 46 124 Z" fill="#c8323a" stroke="#6a0a1c" strokeWidth="1" />
      {/* head */}
      <circle cx="70" cy="50" r="24" fill="#4a97ec" stroke="#14275a" strokeWidth="1.6" />
      <ellipse cx="62" cy="40" rx="9" ry="6" fill="#bfe6ff" opacity="0.35" />
      {/* turban */}
      <path d="M44 42 C46 20 94 20 96 42 C84 34 56 34 44 42 Z" fill={`url(#${p}-gold)`} stroke="#6e4a12" strokeWidth="1.4" />
      <path d="M48 34 C62 28 80 28 92 34" stroke="#6e4a12" strokeWidth="1" fill="none" opacity="0.6" />
      <circle cx="70" cy="30" r="5" fill={`url(#${p}-ruby)`} stroke="#4a0a14" />
      <path d="M70 25 C68 16 76 12 78 6 C76 14 82 16 70 25 Z" fill="#f6d77a" stroke="#6e4a12" strokeWidth=".8" />
      {/* eyes */}
      {mood === "sorry" ? (
        <>
          <path d="M55 50 q5 -4 10 0 M75 50 q5 -4 10 0" stroke="#10204a" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="60" cy="50" rx={mood === "wow" ? 5 : 4} ry={mood === "wow" ? 6 : 5} fill="#fff" />
          <ellipse cx="80" cy="50" rx={mood === "wow" ? 5 : 4} ry={mood === "wow" ? 6 : 5} fill="#fff" />
          <circle className="genie-pupil" cx="61" cy="51" r="2.2" fill="#10204a" />
          <circle className="genie-pupil" cx="81" cy="51" r="2.2" fill="#10204a" />
        </>
      )}
      <path d="M52 43 q8 -6 15 -1 M73 42 q8 -5 15 1" stroke="#10204a" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* moustache, mouth, goatee */}
      <path d="M56 62 C62 56 68 60 70 62 C72 60 78 56 84 62 C78 66 72 64 70 63 C68 64 62 66 56 62 Z" fill="#10204a" />
      {mood === "sorry" ? (
        <path d="M63 70 q7 -5 14 0" stroke="#10204a" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M62 67 q8 9 16 0 q-8 3 -16 0 Z" fill="#10204a" />
      )}
      <path d="M64 72 C66 84 74 84 76 72 C74 78 66 78 64 72 Z" fill="#10204a" />
      {/* sparkles */}
      <g className="genie-twinkle" fill="#fff3b0">
        <path d="M18 40 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 Z" />
        <path d="M120 24 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 Z" />
      </g>
    </svg>
  );
}

export function WishIcon({ kind }: { kind: Wish["icon"] }) {
  const common = { width: 38, height: 38, viewBox: "0 0 38 38", "aria-hidden": true } as const;
  if (kind === "tower") {
    return (
      <svg {...common}>
        <path d="M19 3 L28 13 H10 Z" fill="#3461b8" stroke="#14275a" />
        <rect x="11" y="13" width="16" height="20" fill="#8d929b" stroke="#3b3f45" />
        <rect x="8" y="10" width="22" height="4" fill="#a3a8b1" stroke="#3b3f45" />
        <path d="M16 33 v-7 a3 3 0 0 1 6 0 v7" fill="#3a2614" />
        <rect x="17" y="17" width="4" height="5" rx="1.6" fill="#ffd978" />
      </svg>
    );
  }
  if (kind === "scroll") {
    return (
      <svg {...common}>
        <circle cx="19" cy="17" r="11" fill="#cfe9ff" fillOpacity="0.55" stroke="#8fe0ff" strokeWidth="1.6" />
        <circle cx="15" cy="13" r="3" fill="#fff" opacity="0.7" />
        <path d="M10 31 H28 L25 26 H13 Z" fill="#c98f2e" stroke="#6e4a12" />
        <path d="M13 18 q3 -4 6 0 t6 0" stroke="#2f7fe0" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M19 3 l3.6 9 9 3.6 -9 3.6 -3.6 9 -3.6 -9 -9 -3.6 9 -3.6 Z" fill="#f6d77a" stroke="#6e4a12" strokeWidth="1.2" />
      <path d="M31 24 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="#8fe0ff" stroke="#2f7fe0" strokeWidth=".8" />
      <path d="M6 24 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill="#ffb3b3" stroke="#a02030" strokeWidth=".8" />
    </svg>
  );
}
