import type { Mood } from "../../lib/salesRep";

/**
 * Sal, the Sales Rep: a generic, invented stall-barker in a loud waistcoat,
 * headset and megaphone. Not anyone's likeness. Painted with fixed colours like
 * the rest of the Marketplace art; every fact he conveys is also in the text
 * beside him. The mood changes his brows, mouth and arms.
 */

const SKIN = "#e7b88c";
const INK = "#2a1a0a";

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "pitch": // shouting through the megaphone: open and round
      return (
        <g>
          <ellipse cx="64" cy="76" rx="7" ry="8" fill="#5a1410" stroke={INK} strokeWidth="1.2" />
          <path d="M58 72 H70" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "cheer": // huge grin
      return (
        <g>
          <path d="M50 70 Q66 90 82 70 Z" fill="#5a1410" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M53 71.5 H79" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M58 82 Q66 78 74 82" stroke="#d8665a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case "think": // lopsided, unsure
      return <path d="M54 76 Q62 72 70 77 Q75 79 79 75" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
    case "oops": // wobbly grimace
      return (
        <g>
          <path d="M52 78 Q57 72 62 78 Q67 84 72 78 Q76 73 80 78" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function Brows({ mood }: { mood: Mood }) {
  const p =
    mood === "cheer"
      ? ["M46 47 Q54 40 62 47", "M70 47 Q78 40 86 47"]
      : mood === "think"
        ? ["M46 49 L62 46", "M70 42 Q78 38 86 44"]
        : mood === "oops"
          ? ["M46 44 Q54 50 62 46", "M70 46 Q78 50 86 44"]
          : ["M46 46 L62 49", "M70 49 L86 46"];
  return (
    <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
      <path d={p[0]} />
      <path d={p[1]} />
    </g>
  );
}

function Megaphone() {
  return (
    <g transform="translate(94 56) rotate(-12)">
      <path d="M0 6 L34 -8 V32 L0 20 Z" fill="#d6483c" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M0 6 L34 -8 L34 -2 L0 11 Z" fill="#f1e3c4" opacity="0.85" />
      <ellipse cx="34" cy="12" rx="5" ry="20" fill="#f1e3c4" stroke={INK} strokeWidth="1.5" />
      <ellipse cx="34" cy="12" rx="2.6" ry="14" fill="#7a2a22" />
      <rect x="-8" y="8" width="10" height="10" rx="2" fill="#4a3a2a" stroke={INK} strokeWidth="1.2" />
    </g>
  );
}

export function SalesRep({ mood = "pitch", size = 150, className = "" }: { mood?: Mood; size?: number; className?: string }) {
  const armsUp = mood === "cheer";
  return (
    <svg width={size} height={(size * 170) / 150} viewBox="0 0 150 170" role="img" aria-label="Sal, the sales rep" className={className}>
      <ellipse cx="66" cy="164" rx="40" ry="5" fill="#000" opacity="0.32" />

      {/* legs */}
      <path d="M48 128 L46 160 H60 L66 132 Z" fill="#2c3a5a" stroke={INK} />
      <path d="M84 128 L88 160 H74 L66 132 Z" fill="#2c3a5a" stroke={INK} />
      <path d="M44 160 H62 V164 H42 Z M72 160 H90 V164 H74 Z" fill="#3a2614" stroke={INK} />

      {/* back arm (behind the body) */}
      {armsUp ? (
        <path d="M44 104 Q26 92 24 62" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
      ) : mood === "oops" ? (
        <path d="M44 104 Q30 90 44 74" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
      ) : mood === "think" ? (
        <path d="M44 106 Q32 98 36 88" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M44 106 Q30 118 34 132" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
      )}

      {/* body: shirt and loud waistcoat */}
      <path d="M40 86 Q66 76 92 86 L98 134 Q66 142 34 134 Z" fill="#f1e3c4" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M40 86 L56 84 L66 128 L36 132 Z" fill="#2f7a4a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M92 86 L76 84 L66 128 L96 132 Z" fill="#2f7a4a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M44 92 L40 130 M50 90 L48 130 M88 92 L92 130 M82 90 L84 130" stroke="#f2d16b" strokeWidth="1.6" opacity="0.7" />
      {[100, 110, 120].map((y) => (
        <circle key={y} cx="66" cy={y} r="2.2" fill="#f2d16b" stroke={INK} strokeWidth=".6" />
      ))}
      {/* the tie, flapping */}
      <path d="M62 86 L70 86 L72 104 L66 114 L60 104 Z" fill="#d6483c" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M58 82 L66 90 L74 82 L70 80 L66 84 L62 80 Z" fill="#fff" stroke={INK} strokeWidth=".8" />

      {/* neck and head */}
      <rect x="58" y="74" width="16" height="12" fill="#d3a07a" />
      <ellipse cx="66" cy="58" rx="25" ry="26" fill={SKIN} stroke={INK} strokeWidth="1.4" />
      <ellipse cx="41" cy="60" rx="4" ry="6" fill={SKIN} stroke={INK} strokeWidth="1" />
      <ellipse cx="91" cy="60" rx="4" ry="6" fill={SKIN} stroke={INK} strokeWidth="1" />
      <ellipse cx="56" cy="62" rx="4" ry="2.4" fill="#e58a7a" opacity="0.45" />
      <ellipse cx="78" cy="62" rx="4" ry="2.4" fill="#e58a7a" opacity="0.45" />

      {/* wild ginger hair */}
      <path
        d="M40 52 Q34 30 50 26 Q52 12 66 18 Q76 6 86 22 Q100 24 92 50 Q84 34 66 34 Q48 34 40 52 Z"
        fill="#b5532a"
        stroke="#5e2410"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M52 28 L48 16 M66 22 L68 8 M80 24 L88 12" stroke="#b5532a" strokeWidth="5" strokeLinecap="round" />

      {/* headset: band over the hair, ear cup, mic boom */}
      <path d="M41 56 Q40 28 66 24 Q90 28 91 56" stroke="#4a4f5c" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <rect x="36" y="52" width="8" height="14" rx="3" fill="#6b7384" stroke={INK} strokeWidth="1" />
      <path d="M39 66 Q42 78 54 82" stroke="#4a4f5c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="55" cy="82" r="3" fill="#e8e8e8" stroke={INK} strokeWidth="1" />

      {/* eyes, brows and mouth */}
      <circle cx="54" cy="56" r={mood === "oops" ? 4.6 : 3.4} fill="#fff" stroke={INK} strokeWidth="1" />
      <circle cx="78" cy="56" r={mood === "oops" ? 4.6 : 3.4} fill="#fff" stroke={INK} strokeWidth="1" />
      <circle cx="54.5" cy="56.5" r="1.7" fill={INK} />
      <circle cx="78.5" cy="56.5" r="1.7" fill={INK} />
      <Brows mood={mood} />
      <Mouth mood={mood} />

      {/* front arm and props */}
      {mood === "pitch" && (
        <>
          <path d="M88 104 Q104 96 104 70" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="104" cy="66" r="7" fill={SKIN} stroke={INK} strokeWidth="1" />
          <Megaphone />
        </>
      )}
      {mood === "cheer" && (
        <>
          <path d="M88 104 Q108 92 110 62" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="24" cy="58" r="7" fill={SKIN} stroke={INK} strokeWidth="1" />
          <circle cx="110" cy="58" r="7" fill={SKIN} stroke={INK} strokeWidth="1" />
          {[
            [22, 36],
            [112, 34],
            [124, 60],
            [10, 52],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} className="sal-twinkle">
              <circle cx={x} cy={y} r="5" fill="#f2c94c" stroke="#8a6a1c" strokeWidth="1" />
              <path d={`M${x! - 2} ${y}h4`} stroke="#8a6a1c" strokeWidth="1" />
            </g>
          ))}
        </>
      )}
      {mood === "think" && (
        <>
          <path d="M88 104 Q96 96 84 80" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="82" cy="80" r="6.5" fill={SKIN} stroke={INK} strokeWidth="1" />
          <circle cx="36" cy="86" r="6.5" fill={SKIN} stroke={INK} strokeWidth="1" />
          <path d="M100 30 q4 -10 12 -4 q8 -6 8 6 q8 2 2 10 q-2 8 -10 4 q-8 4 -10 -4 q-8 -4 -2 -12 z" fill="#f4f1e6" stroke={INK} strokeWidth="1" opacity="0.95" />
          <text x="106" y="44" fontSize="14" fontWeight="700" fill={INK} fontFamily="Georgia, serif">
            ?
          </text>
        </>
      )}
      {mood === "oops" && (
        <>
          <path d="M88 104 Q102 90 88 74" stroke="#f1e3c4" strokeWidth="13" strokeLinecap="round" fill="none" />
          <circle cx="86" cy="72" r="6.5" fill={SKIN} stroke={INK} strokeWidth="1" />
          <circle cx="44" cy="72" r="6.5" fill={SKIN} stroke={INK} strokeWidth="1" />
          <path d="M96 40 q-5 9 0 13 q5 -4 0 -13 z" fill="#8ec9f0" stroke="#2f6d9a" strokeWidth="1" />
          <path d="M30 34 q-5 9 0 13 q5 -4 0 -13 z" fill="#8ec9f0" stroke="#2f6d9a" strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

const COINS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const r = 70 + (i % 3) * 26;
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 0.8 - 30), delay: (i % 5) * 40 };
});

/** One-off burst of coins (a flourish, not a reward). Hidden under reduced motion by CSS. */
export function CoinBurst() {
  return (
    <div className="sal-burst" aria-hidden>
      {COINS.map((c, i) => (
        <span key={i} className="sal-coin" style={{ ["--dx" as string]: `${c.dx}px`, ["--dy" as string]: `${c.dy}px`, animationDelay: `${c.delay}ms` }} />
      ))}
    </div>
  );
}

/** The runners on their way from the fortress to the Newsweb desk. Decorative. */
export function RunnerStrip() {
  return (
    <svg viewBox="0 0 320 54" className="sal-runner-strip" aria-hidden>
      <path d="M44 40 H276" stroke="#a07b3a" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
      {/* the fortress */}
      <g>
        <rect x="8" y="16" width="30" height="26" fill="#8d8f99" stroke={INK} />
        <path d="M8 16 h6 v-5 h6 v5 h4 v-5 h6 v5 h6 v-5 h0" stroke={INK} fill="#8d8f99" />
        <rect x="19" y="28" width="8" height="14" rx="4" fill="#3a2614" />
      </g>
      {/* the news desk */}
      <g>
        <rect x="282" y="18" width="30" height="24" fill="#d9c9a0" stroke={INK} />
        <path d="M278 18 L297 6 L316 18 Z" fill="#b8672a" stroke={INK} />
        <rect x="290" y="26" width="14" height="9" fill="#f6ecc6" stroke={INK} strokeWidth=".8" />
        <path d="M292 29 h10 M292 32 h7" stroke={INK} strokeWidth=".8" />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} className="sal-runner" style={{ animationDelay: `${i * 0.9}s` }}>
          <circle cx="50" cy="31" r="4" fill="#e7b88c" stroke={INK} strokeWidth=".8" />
          <rect x="46.5" y="35" width="7" height="8" rx="2" fill={["#2f7a4a", "#d6483c", "#2f4a82"][i]} stroke={INK} strokeWidth=".8" />
          <rect x="54" y="36" width="5" height="5" fill="#d9c9a0" stroke={INK} strokeWidth=".7" />
        </g>
      ))}
    </svg>
  );
}
