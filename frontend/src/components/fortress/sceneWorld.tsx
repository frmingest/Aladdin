import { ROW_HEIGHT, SCENE_TOP, SCENE_WIDTH, type FortressLayout, type SiegeSky } from "../../lib/fortress";
import { HORIZON, type WorldPalette } from "../../lib/fortressArt";

/**
 * The world around the towers (F33, G7 art pass): sky, light, mountains,
 * terraced ground, weather and ambient life. Pure decoration — every fact in
 * the scene comes from the towers, signs and marks drawn by FortressScene.
 * Fixed colours on purpose: the scene is a painting in a frame and reads the
 * same in the dark and light themes.
 */

export function SceneDefs({ palette }: { palette: WorldPalette }) {
  return (
    <defs>
      {/* ---- sky and light ---- */}
      <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.sky[0]} />
        <stop offset="0.62" stopColor={palette.sky[1]} />
        <stop offset="1" stopColor={palette.sky[2]} />
      </linearGradient>
      <radialGradient id="fs-sun">
        <stop offset="0" stopColor={palette.sun.core} stopOpacity="1" />
        <stop offset="0.08" stopColor={palette.sun.color} stopOpacity="0.9" />
        <stop offset="0.4" stopColor={palette.sun.color} stopOpacity="0.25" />
        <stop offset="1" stopColor={palette.sun.color} stopOpacity="0" />
      </radialGradient>
      <linearGradient id="fs-haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.sky[2]} stopOpacity="0" />
        <stop offset="1" stopColor={palette.sky[2]} stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id="fs-mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#dbe4f2" stopOpacity="0" />
        <stop offset="0.5" stopColor="#dbe4f2" stopOpacity="0.26" />
        <stop offset="1" stopColor="#dbe4f2" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="fs-vignette" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>

      {/* ---- ground ---- */}
      <linearGradient id="fs-land" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.grass[0]} />
        <stop offset="1" stopColor={palette.grass[1]} />
      </linearGradient>
      <linearGradient id="fs-terrace" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.grass[0]} />
        <stop offset="0.75" stopColor={palette.grass[0]} stopOpacity="0.85" />
        <stop offset="1" stopColor={palette.grass[1]} />
      </linearGradient>
      <linearGradient id="fs-cliff" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7a6a58" />
        <stop offset="0.3" stopColor="#56493c" />
        <stop offset="1" stopColor="#241d17" />
      </linearGradient>
      <linearGradient id="fs-mud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5b4a33" />
        <stop offset="1" stopColor="#33291c" />
      </linearGradient>

      {/* ---- water ---- */}
      <linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5fb4e0" />
        <stop offset="0.45" stopColor="#2c7cb4" />
        <stop offset="1" stopColor="#163f68" />
      </linearGradient>

      {/* ---- light on buildings ---- */}
      {/* Flat walls: lit from the left, shadowed on the right, darker at the foot. */}
      <linearGradient id="fs-shade-flat" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
        <stop offset="0.12" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="0.86" stopColor="#000" stopOpacity="0.28" />
        <stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </linearGradient>
      {/* Round towers: a highlight band left of centre. */}
      <linearGradient id="fs-shade-round" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.45" />
        <stop offset="0.22" stopColor="#fff" stopOpacity="0.16" />
        <stop offset="0.38" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0.22" />
        <stop offset="1" stopColor="#000" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="fs-ao" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id="fs-rim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={palette.rim} stopOpacity={palette.rimOpacity * 3} />
        <stop offset="0.18" stopColor={palette.rim} stopOpacity="0" />
      </linearGradient>

      {/* ---- roofs ---- */}
      <linearGradient id="fs-roof-slate" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5d8fe6" />
        <stop offset="0.35" stopColor="#3461b8" />
        <stop offset="1" stopColor="#14275a" />
      </linearGradient>
      <linearGradient id="fs-roof-wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#b07a42" />
        <stop offset="0.4" stopColor="#7f5228" />
        <stop offset="1" stopColor="#3e2510" />
      </linearGradient>
      <linearGradient id="fs-roof-rot" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#6e6142" />
        <stop offset="0.45" stopColor="#4c4029" />
        <stop offset="1" stopColor="#241d12" />
      </linearGradient>
      <linearGradient id="fs-roof-ally" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5fbf6a" />
        <stop offset="0.38" stopColor="#2f8a42" />
        <stop offset="1" stopColor="#123d1e" />
      </linearGradient>
      <linearGradient id="fs-roof-thatch" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#e6c46a" />
        <stop offset="0.4" stopColor="#b98d3a" />
        <stop offset="1" stopColor="#5e4318" />
      </linearGradient>
      <linearGradient id="fs-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff1b0" />
        <stop offset="0.35" stopColor="#f2c94c" />
        <stop offset="1" stopColor="#a8741a" />
      </linearGradient>
      <linearGradient id="fs-rock" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8d8273" />
        <stop offset="0.5" stopColor="#5c5247" />
        <stop offset="1" stopColor="#2b251f" />
      </linearGradient>
      <radialGradient id="fs-window">
        <stop offset="0" stopColor="#fff4c8" />
        <stop offset="0.6" stopColor="#ffc05a" />
        <stop offset="1" stopColor="#d9782a" />
      </radialGradient>
      <radialGradient id="fs-glow">
        <stop offset="0" stopColor="#ffc46a" stopOpacity="0.75" />
        <stop offset="1" stopColor="#ffc46a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fs-fire-glow">
        <stop offset="0" stopColor="#ff7a2e" stopOpacity="0.8" />
        <stop offset="1" stopColor="#ff7a2e" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fs-mine-glow">
        <stop offset="0" stopColor="#ffd75e" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffd75e" stopOpacity="0" />
      </radialGradient>

      {/* ---- masonry ---- */}
      <pattern id="fs-basalt" width="28" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 .5H28M0 8.5H28M14 .5V8.5M0 8.5V16M28 8.5V16" stroke="#000" strokeOpacity=".5" fill="none" />
        <path d="M1 1.5H13M15 1.5H27M1 9.5H27" stroke="#9fb3d1" strokeOpacity=".16" fill="none" />
      </pattern>
      <pattern id="fs-granite" width="20" height="12" patternUnits="userSpaceOnUse">
        <path d="M0 .5H20M0 6.5H20M10 .5V6.5M0 6.5V12M20 6.5V12" stroke="#2a2d33" strokeOpacity=".55" fill="none" />
        <path d="M1 1.5H9M11 1.5H19M1 7.5H19" stroke="#fff" strokeOpacity=".16" fill="none" />
        <circle cx="5" cy="4" r=".7" fill="#000" fillOpacity=".25" />
        <circle cx="15" cy="9.5" r=".6" fill="#000" fillOpacity=".22" />
        <circle cx="13" cy="3" r=".5" fill="#fff" fillOpacity=".25" />
      </pattern>
      <pattern id="fs-brick" width="12" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 .5H12M0 4H12M6 .5V4M0 4V7M12 4V7" stroke="#e8c9a4" strokeOpacity=".38" fill="none" />
        <path d="M1 1.4H5M7 1.4H11M1 4.9H11" stroke="#ffb08a" strokeOpacity=".18" fill="none" />
      </pattern>
      <pattern id="fs-planks" width="10" height="40" patternUnits="userSpaceOnUse">
        <path d="M.5 0V40" stroke="#2a1708" strokeOpacity=".7" fill="none" />
        <path d="M2 0V40" stroke="#e0b07a" strokeOpacity=".16" fill="none" />
        <path d="M5 6q1 6 0 12M7 22q-1 6 0 12" stroke="#2a1708" strokeOpacity=".28" fill="none" />
        <circle cx="5" cy="3" r=".9" fill="#1a0f05" fillOpacity=".7" />
      </pattern>
      <pattern id="fs-rot" width="11" height="34" patternUnits="userSpaceOnUse">
        <path d="M.5 0V34" stroke="#120c06" strokeWidth="1.6" strokeOpacity=".85" fill="none" />
        <path d="M5 4q2 8 -1 14M8 20q-2 5 0 10" stroke="#120c06" strokeOpacity=".4" fill="none" />
        <ellipse cx="4" cy="28" rx="3" ry="2" fill="#4f6b2c" fillOpacity=".55" />
      </pattern>
      <pattern id="fs-tiles" width="8" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 5.5Q2 3 4 5.5T8 5.5" stroke="#000" strokeOpacity=".28" fill="none" />
      </pattern>
      <pattern id="fs-straw" width="5" height="9" patternUnits="userSpaceOnUse">
        <path d="M1 0L2 9M3.5 0L4 9" stroke="#3e2a0c" strokeOpacity=".3" fill="none" />
      </pattern>

      {/* ---- filters ---- */}
      <filter id="fs-blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
      <filter id="fs-blur-lg" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <filter id="fs-bloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Painterly grain: a little dark noise inside the shape, so flat fills
          read as stone, wood and earth. */}
      <filter id="fs-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 0.95"
          result="speck"
        />
        <feComposite in="speck" in2="SourceAlpha" operator="in" result="specks" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="specks" />
        </feMerge>
      </filter>
      <filter id="fs-grain-soft" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.18" numOctaves="3" seed="2" result="noise" />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.62"
          result="speck"
        />
        <feComposite in="speck" in2="SourceAlpha" operator="in" result="specks" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="specks" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** A jagged range from a fixed list of peaks, so the picture is stable. */
function ridge(peaks: [number, number][], base: number): string {
  const pts = peaks.map(([x, y]) => `L${x} ${y}`).join(" ");
  return `M0 ${base} ${pts} L${SCENE_WIDTH} ${base} V${base + 400} H0 Z`;
}

const FAR_PEAKS: [number, number][] = [
  [0, HORIZON - 52], [60, HORIZON - 78], [110, HORIZON - 60], [170, HORIZON - 104], [215, HORIZON - 84],
  [262, HORIZON - 96], [330, HORIZON - 58], [400, HORIZON - 74], [470, HORIZON - 122], [520, HORIZON - 92],
  [570, HORIZON - 100], [640, HORIZON - 62], [700, HORIZON - 80], [760, HORIZON - 112], [812, HORIZON - 86],
  [880, HORIZON - 98], [940, HORIZON - 66], [1000, HORIZON - 82],
];
const NEAR_PEAKS: [number, number][] = [
  [0, HORIZON - 22], [80, HORIZON - 44], [150, HORIZON - 28], [240, HORIZON - 52], [310, HORIZON - 30],
  [380, HORIZON - 40], [450, HORIZON - 24], [560, HORIZON - 46], [640, HORIZON - 26], [720, HORIZON - 38],
  [800, HORIZON - 24], [880, HORIZON - 48], [960, HORIZON - 30], [1000, HORIZON - 36],
];

/** Snow on the tallest far peaks: a small cap under each summit. */
function SnowCaps({ color }: { color: string }) {
  return (
    <g fill={color} opacity={0.75}>
      {FAR_PEAKS.filter(([, y]) => y < HORIZON - 90).map(([x, y]) => (
        <path key={x} d={`M${x - 14} ${y + 16} L${x} ${y} L${x + 13} ${y + 15} L${x + 6} ${y + 12} L${x + 1} ${y + 17} L${x - 6} ${y + 12} Z`} />
      ))}
    </g>
  );
}

/** A band of pines along the horizon. */
function Treeline({ color, y }: { color: string; y: number }) {
  const trees: string[] = [];
  for (let i = 0; i < 64; i += 1) {
    const x = i * 16 + ((i * 7) % 9);
    const h = 16 + ((i * 13) % 11);
    trees.push(`M${x - 6} ${y} L${x} ${y - h} L${x + 6} ${y} Z`);
  }
  return (
    <g fill={color}>
      <path d={trees.join(" ")} />
      <rect x={0} y={y - 2} width={SCENE_WIDTH} height={8} />
    </g>
  );
}

/** Painted clouds with a lit underside; denser when the weather is bad. */
function Clouds({ opacity, light }: { opacity: number; light: string }) {
  const banks: [number, number, number][] = [
    [90, 46, 1.1], [290, 30, 1.4], [500, 54, 1.2], [700, 34, 1.5], [900, 50, 1.1],
  ];
  return (
    <g aria-hidden opacity={opacity}>
      {banks.map(([cx, cy, s]) => (
        <g key={cx} transform={`translate(${cx} ${cy}) scale(${s})`}>
          <ellipse cx={0} cy={6} rx={92} ry={20} fill="#0c0f17" opacity={0.85} />
          <ellipse cx={-34} cy={-2} rx={44} ry={20} fill="#161b26" />
          <ellipse cx={22} cy={-6} rx={52} ry={24} fill="#1b2130" />
          <ellipse cx={60} cy={4} rx={36} ry={16} fill="#151a25" />
          <path d="M-90 14 Q-30 26 30 18 T96 12" stroke={light} strokeOpacity={0.22} strokeWidth={3} fill="none" />
        </g>
      ))}
    </g>
  );
}

/** Long thin evening clouds lit from below (calm weather only). */
function Streaks({ light }: { light: string }) {
  return (
    <g aria-hidden opacity={0.55}>
      <path d="M40 72 Q200 60 380 70 T720 66" stroke={light} strokeOpacity={0.35} strokeWidth={5} strokeLinecap="round" fill="none" filter="url(#fs-blur)" />
      <path d="M520 42 Q680 34 860 44 T990 40" stroke={light} strokeOpacity={0.25} strokeWidth={4} strokeLinecap="round" fill="none" filter="url(#fs-blur)" />
      <path d="M120 100 Q260 92 420 98" stroke={light} strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" fill="none" filter="url(#fs-blur)" />
    </g>
  );
}

/** Enemy camps on the far hills while the realm is besieged. */
function SiegeFires({ count, y }: { count: number; y: number }) {
  if (count <= 0) return null;
  const xs = [58, 262, 508, 742, 948].slice(0, count);
  return (
    <g aria-hidden>
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x + 8} cy={y} r={26} fill="url(#fs-fire-glow)" />
          <path d={`M${x - 22} ${y + 4} L${x - 11} ${y - 14} L${x} ${y + 4} Z`} fill="#2a1414" />
          <path d={`M${x - 11} ${y - 14} V${y - 26} l7 3 l-7 3`} stroke="#2a1414" fill="#7a1f1f" />
          <g className="fortress-flicker" style={{ animationDelay: `${i * 160}ms` }}>
            <path d={`M${x + 8} ${y + 3} q-8 -10 -2 -19 q2 7 6 3 q4 7 -4 16 Z`} fill="#ff8a2a" />
            <path d={`M${x + 8} ${y + 3} q-3 -5 0 -10 q3 5 0 10 Z`} fill="#ffe08a" />
          </g>
          <path
            className="fortress-smoke"
            style={{ animationDelay: `${i * 400}ms` }}
            d={`M${x + 8} ${y - 18} q-6 -10 2 -20 q8 -10 0 -22`}
            stroke="#1a1214"
            strokeOpacity={0.5}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
            filter="url(#fs-blur)"
          />
        </g>
      ))}
    </g>
  );
}

/** Each row of towers stands on its own terrace; the lip and cliff face in
 * front of it step the hillside down towards the viewer. */
function Terrace({ groundY, index }: { groundY: number; index: number }) {
  const lip = groundY + 70;
  const drop = 26;
  const wobble = (i: number) => ((i * 37 + index * 11) % 9) - 4;
  const pts: string[] = [];
  for (let x = 0; x <= SCENE_WIDTH; x += 40) pts.push(`L${x} ${lip + wobble(x / 40)}`);
  const top = `M0 ${lip} ${pts.join(" ")}`;
  const cliff = `${top} L${SCENE_WIDTH} ${lip + drop} ${Array.from({ length: 26 }, (_, i) => `L${SCENE_WIDTH - i * 40} ${lip + drop + wobble(i + 3) * 1.5}`).join(" ")} Z`;
  return (
    <g>
      {/* The worn ground the towers stand on. */}
      <ellipse cx={SCENE_WIDTH / 2} cy={groundY + 10} rx={SCENE_WIDTH * 0.48} ry={44} fill="#000" opacity={0.1} filter="url(#fs-blur-lg)" />
      <path d={cliff} fill="url(#fs-cliff)" filter="url(#fs-grain)" />
      {Array.from({ length: 24 }, (_, i) => {
        const x = 20 + i * 42 + ((i * 17) % 13);
        return <path key={i} d={`M${x} ${lip + 6} l3 ${10 + (i % 3) * 3}`} stroke="#1e1712" strokeOpacity={0.6} strokeWidth={1.2} />;
      })}
      <path d={top} stroke="#a0a65a" strokeOpacity={0.35} strokeWidth={2} fill="none" />
    </g>
  );
}

/** Grass tufts and stones scattered on the terraces, to give the ground scale. */
function Tufts({ layout }: { layout: FortressLayout }) {
  const rows = Math.max(1, layout.rows);
  const out: JSX.Element[] = [];
  for (let r = 0; r < rows; r += 1) {
    const gy = SCENE_TOP + r * ROW_HEIGHT + 170;
    for (let i = 0; i < 22; i += 1) {
      const x = 14 + i * 46 + ((i * 29 + r * 13) % 21);
      const y = gy + 52 + ((i * 11) % 14);
      out.push(
        i % 4 === 0 ? (
          <ellipse key={`${r}-${i}`} cx={x} cy={y} rx={4} ry={2.4} fill="#6f6a5e" opacity={0.7} />
        ) : (
          <path key={`${r}-${i}`} d={`M${x - 3} ${y} l1 -6 M${x} ${y} l0 -8 M${x + 3} ${y} l-1 -6`} stroke="#9aa54e" strokeOpacity={0.5} strokeLinecap="round" />
        ),
      );
    }
  }
  return <g aria-hidden>{out}</g>;
}

/** A pine at the edge of each terrace, framing the scene. */
function EdgePines({ layout, color }: { layout: FortressLayout; color: string }) {
  const rows = Math.max(1, layout.rows);
  return (
    <g aria-hidden>
      {Array.from({ length: rows }, (_, r) => {
        const gy = SCENE_TOP + r * ROW_HEIGHT + 170 + 40;
        return [12, SCENE_WIDTH - 14].map((x, side) => (
          <g key={`${r}-${side}`}>
            <ellipse cx={x + 6} cy={gy + 2} rx={18} ry={5} fill="#000" opacity={0.35} filter="url(#fs-blur)" />
            <rect x={x - 2} y={gy - 14} width={4} height={16} fill="#3a2614" />
            {[0, 1, 2, 3].map((k) => (
              <path
                key={k}
                d={`M${x - 22 + k * 4} ${gy - 10 - k * 18} L${x} ${gy - 46 - k * 18} L${x + 22 - k * 4} ${gy - 10 - k * 18} Z`}
                fill={color}
                stroke="#000"
                strokeOpacity={0.25}
              />
            ))}
            <path d={`M${x - 14} ${gy - 30} L${x} ${gy - 62} L${x - 2} ${gy - 30} Z`} fill="#fff" opacity={0.06} />
          </g>
        ));
      })}
    </g>
  );
}

export function SceneBackdrop({
  layout,
  sky,
  palette,
  height,
}: {
  layout: FortressLayout;
  sky: SiegeSky;
  palette: WorldPalette;
  height: number;
}) {
  const rows = Math.max(1, layout.rows);
  const stars: [number, number][] = [
    [70, 30], [180, 58], [320, 24], [470, 48], [610, 22], [760, 52], [900, 30], [540, 66], [120, 74], [690, 14], [410, 12],
  ];
  const starOpacity = sky.clouds > 0 ? 0 : palette.motes === "fireflies" ? 0.35 : 0.7;
  return (
    <g aria-hidden>
      <rect width={SCENE_WIDTH} height={height} fill="url(#fs-sky)" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="#f3f6ff" opacity={starOpacity} />
      ))}
      <circle cx={palette.sun.x} cy={palette.sun.y} r={palette.sun.r} fill="url(#fs-sun)" opacity={palette.sun.opacity} />
      {palette.motes === "fireflies" && <Streaks light={palette.sun.color} />}
      <Clouds opacity={sky.clouds} light={palette.sun.color} />

      <path d={ridge(FAR_PEAKS, HORIZON)} fill={palette.farHills} />
      <SnowCaps color={palette.snow} />
      <rect x={0} y={HORIZON - 130} width={SCENE_WIDTH} height={140} fill="url(#fs-haze)" />
      <path d={ridge(NEAR_PEAKS, HORIZON + 4)} fill={palette.nearHills} />
      <SiegeFires count={sky.fires} y={HORIZON - 26} />
      <Treeline color={palette.forest} y={HORIZON + 10} />

      <rect x={0} y={HORIZON + 14} width={SCENE_WIDTH} height={height - HORIZON} fill="url(#fs-land)" filter="url(#fs-grain-soft)" />
      {Array.from({ length: rows }, (_, r) => (
        <Terrace key={r} groundY={SCENE_TOP + r * ROW_HEIGHT + 170} index={r} />
      ))}
      <Tufts layout={layout} />
      <EdgePines layout={layout} color={palette.forest} />
      {sky.mist && (
        <g>
          <rect x={0} y={HORIZON - 60} width={SCENE_WIDTH} height={120} fill="url(#fs-mist)" />
          <rect x={0} y={HORIZON + 140} width={SCENE_WIDTH} height={100} fill="url(#fs-mist)" opacity={0.7} />
        </g>
      )}
    </g>
  );
}

/** Slow ambient life: fireflies at dusk, embers in a siege, rain in a storm.
 * Off entirely for people who ask for reduced motion (CSS). */
export function SceneAmbience({ palette, height }: { palette: WorldPalette; height: number }) {
  if (palette.motes === "none") return null;
  if (palette.motes === "rain") {
    return (
      <g aria-hidden className="fortress-rain" stroke="#c9d6e8" strokeOpacity={0.22} strokeWidth={1}>
        {Array.from({ length: 70 }, (_, i) => {
          const x = (i * 97) % SCENE_WIDTH;
          const y = (i * 53) % height;
          return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 16} />;
        })}
      </g>
    );
  }
  const embers = palette.motes === "embers";
  return (
    <g aria-hidden filter="url(#fs-bloom)">
      {Array.from({ length: 16 }, (_, i) => {
        const x = 40 + ((i * 131) % (SCENE_WIDTH - 80));
        const y = HORIZON + 40 + ((i * 89) % Math.max(60, height - HORIZON - 80));
        return (
          <circle
            key={i}
            className={embers ? "fortress-ember" : "fortress-firefly"}
            style={{ animationDelay: `${(i * 730) % 5000}ms` }}
            cx={x}
            cy={y}
            r={embers ? 1.6 : 1.4}
            fill={embers ? "#ffb15a" : "#f4f7a0"}
          />
        );
      })}
    </g>
  );
}

export function SceneVignette({ height }: { height: number }) {
  return <rect aria-hidden width={SCENE_WIDTH} height={height} fill="url(#fs-vignette)" pointerEvents="none" />;
}
