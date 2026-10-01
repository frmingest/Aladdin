import { useId } from "react";

/**
 * The Aladdin mark: a golden magic lamp with a curl of blue genie smoke
 * (2026-10-01, replacing the genie-bottle silhouette). Colours are fixed on
 * purpose: it is an illustration, so it reads the same in dark and light
 * themes. Gradient ids are made unique per instance because the logo is
 * rendered several times on one page (sidebar, mobile bar, drawer).
 *
 * `simple` drops the glow, sparkles and filigree so the lamp still reads at
 * 20-28 px; the full version is for 32 px and up.
 */
export default function LampLogo({
  className = "h-8 w-8",
  simple = false,
  x,
  y,
  width,
  height,
}: {
  className?: string;
  simple?: boolean;
  /** Only when the logo is placed inside another <svg> (the Great Keep's medallion). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const p = `lamp${useId().replace(/:/g, "")}`;
  return (
    <svg aria-hidden viewBox="-2 -4 104 100" className={className} x={x} y={y} width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>

        <linearGradient id={`${p}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3b0"/>
        <stop offset="0.28" stopColor="#f6c744"/>
        <stop offset="0.62" stopColor="#d8962a"/>
        <stop offset="1" stopColor="#8a5412"/>
        </linearGradient>
        <linearGradient id={`${p}-goldH`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8a5412"/>
        <stop offset="0.25" stopColor="#f2bd3c"/>
        <stop offset="0.45" stopColor="#fff0a0"/>
        <stop offset="0.7" stopColor="#e0a232"/>
        <stop offset="1" stopColor="#7a4610"/>
        </linearGradient>
        <linearGradient id={`${p}-smoke`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#2f7fe0" stopOpacity="0.95"/>
        <stop offset="1" stopColor="#8fe0ff" stopOpacity="0.55"/>
        </linearGradient>
        <radialGradient id={`${p}-ruby`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#ffb3b3"/>
        <stop offset="0.35" stopColor="#e0243a"/>
        <stop offset="1" stopColor="#6a0a1c"/>
        </radialGradient>
        <radialGradient id={`${p}-teal`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#c8fff4"/>
        <stop offset="0.4" stopColor="#18c0b0"/>
        <stop offset="1" stopColor="#075a68"/>
        </radialGradient>
        <radialGradient id={`${p}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffe9a0" stopOpacity="0.55"/>
        <stop offset="1" stopColor="#ffe9a0" stopOpacity="0"/>
        </radialGradient>

      </defs>
      {simple ? (
        <g>



          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 38 C-3 30 17 28 11 18 C5 9 22 9 20 3" stroke="#2f7fe0" strokeOpacity="0.35" strokeWidth="12"/>
          <path d="M9 38 C-3 30 17 28 11 18 C5 9 22 9 20 3" stroke={`url(#${p}-smoke)`} strokeWidth="7.5"/>
          <path d="M9 38 C-3 30 17 28 11 18 C5 9 22 9 20 3" stroke="#e6f9ff" strokeOpacity="0.85" strokeWidth="2"/>
          <path d="M20 3 C27 -2 35 4 30 10 C26 14 21 10 25 7" stroke="#8fe0ff" strokeOpacity="0.9" strokeWidth="3.2"/>
          </g>


          <path d="M20 66 C8 64 3 50 3 37 L12 36 C14 47 22 53 32 55 Z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.2" strokeLinejoin="round"/>
          <ellipse cx="7.5" cy="36" rx="6" ry="2.6" transform="rotate(-8 7.5 36)" fill={`url(#${p}-gold)`} stroke="#6a3c0a" strokeWidth="1.2"/>
          <ellipse cx="7.5" cy="35.6" rx="3.6" ry="1.2" transform="rotate(-8 7.5 36)" fill="#4a2606"/>


          <path d="M81 58 C98 60 100 40 89 34 C84 31 79 36 84 39" fill="none" stroke="#6a3c0a" strokeWidth="6.4" strokeLinecap="round"/>
          <path d="M81 58 C98 60 100 40 89 34 C84 31 79 36 84 39" fill="none" stroke={`url(#${p}-gold)`} strokeWidth="4.2" strokeLinecap="round"/>
          <path d="M86 40 C93 44 92 54 82 56" fill="none" stroke="#fff6c0" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round"/>


          <path d="M36 88 h28 l-3 -8 h-22 z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M42 80 h16 v-5 h-16 z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1"/>


          <path d="M15 54 C15 73 31 82 50 82 C69 82 85 73 85 54 Z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M15 54 C15 73 31 82 50 82 C69 82 85 73 85 54 Z" fill={`url(#${p}-gold)`} opacity="0.5"/>

          <circle cx="50" cy="69" r="5.2" fill={`url(#${p}-ruby)`} stroke="#7a4610" strokeWidth="1.2"/>
          <circle cx="48.4" cy="67.2" r="1.3" fill="#fff" opacity="0.85"/>
          <circle cx="35" cy="66" r="2.8" fill={`url(#${p}-teal)`} stroke="#7a4610" strokeWidth="0.9"/>
          <circle cx="65" cy="66" r="2.8" fill={`url(#${p}-teal)`} stroke="#7a4610" strokeWidth="0.9"/>

          <path d="M21 58 C22 68 30 75 40 78" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round"/>


          <ellipse cx="50" cy="54" rx="35" ry="6.5" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.4"/>
          <ellipse cx="50" cy="53.2" rx="31" ry="4.2" fill="#8a5412" opacity="0.55"/>


          <path d="M29 53 C29 42 37 37 50 37 C63 37 71 42 71 53 C62 56 38 56 29 53 Z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M34 47 C38 41 44 40 50 40" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round"/>

          <path d="M45.5 39 C44 31 52 30 49.5 20 C58 25 57 33 54.5 39 Z" fill={`url(#${p}-gold)`} stroke="#6a3c0a" strokeWidth="1.2" strokeLinejoin="round"/>
          <circle cx="50" cy="19.5" r="2.2" fill={`url(#${p}-ruby)`} stroke="#6a3c0a" strokeWidth="0.8"/>





        </g>
      ) : (
        <g>



          <ellipse cx="52" cy="62" rx="46" ry="30" fill={`url(#${p}-glow)`}/>


          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 38 C-3 30 17 28 11 18 C5 9 22 9 20 3" stroke="#2f7fe0" strokeOpacity="0.35" strokeWidth="12"/>
          <path d="M9 38 C-3 30 17 28 11 18 C5 9 22 9 20 3" stroke={`url(#${p}-smoke)`} strokeWidth="7.5"/>
          <path d="M9 38 C-3 30 17 28 11 18 C5 9 22 9 20 3" stroke="#e6f9ff" strokeOpacity="0.85" strokeWidth="2"/>
          <path d="M20 3 C27 -2 35 4 30 10 C26 14 21 10 25 7" stroke="#8fe0ff" strokeOpacity="0.9" strokeWidth="3.2"/>
          </g>


          <path d="M20 66 C8 64 3 50 3 37 L12 36 C14 47 22 53 32 55 Z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.2" strokeLinejoin="round"/>
          <ellipse cx="7.5" cy="36" rx="6" ry="2.6" transform="rotate(-8 7.5 36)" fill={`url(#${p}-gold)`} stroke="#6a3c0a" strokeWidth="1.2"/>
          <ellipse cx="7.5" cy="35.6" rx="3.6" ry="1.2" transform="rotate(-8 7.5 36)" fill="#4a2606"/>


          <path d="M81 58 C98 60 100 40 89 34 C84 31 79 36 84 39" fill="none" stroke="#6a3c0a" strokeWidth="6.4" strokeLinecap="round"/>
          <path d="M81 58 C98 60 100 40 89 34 C84 31 79 36 84 39" fill="none" stroke={`url(#${p}-gold)`} strokeWidth="4.2" strokeLinecap="round"/>
          <path d="M86 40 C93 44 92 54 82 56" fill="none" stroke="#fff6c0" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round"/>


          <path d="M36 88 h28 l-3 -8 h-22 z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.2" strokeLinejoin="round"/>
          <path d="M42 80 h16 v-5 h-16 z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1"/>


          <path d="M15 54 C15 73 31 82 50 82 C69 82 85 73 85 54 Z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M15 54 C15 73 31 82 50 82 C69 82 85 73 85 54 Z" fill={`url(#${p}-gold)`} opacity="0.5"/>

          <path d="M22 60 C32 71 68 71 78 60" fill="none" stroke="#7a4610" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M26 56.5 C36 66 64 66 74 56.5" fill="none" stroke="#fff3b0" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round"/>

          <circle cx="50" cy="69" r="5.2" fill={`url(#${p}-ruby)`} stroke="#7a4610" strokeWidth="1.2"/>
          <circle cx="48.4" cy="67.2" r="1.3" fill="#fff" opacity="0.85"/>
          <circle cx="35" cy="66" r="2.8" fill={`url(#${p}-teal)`} stroke="#7a4610" strokeWidth="0.9"/>
          <circle cx="65" cy="66" r="2.8" fill={`url(#${p}-teal)`} stroke="#7a4610" strokeWidth="0.9"/>

          <path d="M21 58 C22 68 30 75 40 78" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round"/>


          <ellipse cx="50" cy="54" rx="35" ry="6.5" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.4"/>
          <ellipse cx="50" cy="53.2" rx="31" ry="4.2" fill="#8a5412" opacity="0.55"/>


          <path d="M29 53 C29 42 37 37 50 37 C63 37 71 42 71 53 C62 56 38 56 29 53 Z" fill={`url(#${p}-goldH)`} stroke="#6a3c0a" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M34 47 C38 41 44 40 50 40" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round"/>

          <path d="M45.5 39 C44 31 52 30 49.5 20 C58 25 57 33 54.5 39 Z" fill={`url(#${p}-gold)`} stroke="#6a3c0a" strokeWidth="1.2" strokeLinejoin="round"/>
          <circle cx="50" cy="19.5" r="2.2" fill={`url(#${p}-ruby)`} stroke="#6a3c0a" strokeWidth="0.8"/>


          <g fill="#fffbe0">
          <path d="M31 15 l1.6 5 l5 1.6 l-5 1.6 l-1.6 5 l-1.6 -5 l-5 -1.6 l5 -1.6 Z"/>
          <path d="M84 16 l1.2 3.6 l3.6 1.2 l-3.6 1.2 l-1.2 3.6 l-1.2 -3.6 l-3.6 -1.2 l3.6 -1.2 Z"/>
          <path d="M70 8 l0.9 2.6 l2.6 0.9 l-2.6 0.9 l-0.9 2.6 l-0.9 -2.6 l-2.6 -0.9 l2.6 -0.9 Z"/>
          </g>


        </g>
      )}
    </svg>
  );
}
