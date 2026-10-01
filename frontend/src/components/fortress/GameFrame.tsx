import { SIEGE_LABEL, TEMPERAMENT_LABEL, VAULT_LABEL } from "../../lib/fortress";
import { formatNok } from "../../lib/format";
import type { GameState } from "../../lib/types";

/**
 * The frame around the Fortress painting and the resource bar above it
 * (F33, G7 art pass). The bar shows real figures from GET /game/state — the
 * realm's value, the vault, the tower count, the weather and temperament —
 * in the place a strategy game shows its resources. They are facts, never
 * points: nothing here goes up because you opened the app or traded.
 */

function Corner({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 30 30" className={`game-frame-corner ${className}`} aria-hidden>
      <defs>
        <linearGradient id="gf-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.45" stopColor="#d9a93e" />
          <stop offset="1" stopColor="#6e4a12" />
        </linearGradient>
      </defs>
      <path d="M1 1 H22 L16 7 H7 V16 L1 22 Z" fill="url(#gf-gold)" stroke="#2a1a06" strokeWidth="1" />
      <path d="M5 5 L13 13" stroke="#2a1a06" strokeWidth="1.2" />
      <circle cx="9.5" cy="9.5" r="3.4" fill="#7a1d18" stroke="#2a1a06" />
      <circle cx="8.6" cy="8.6" r="1.1" fill="#ffb3a8" opacity="0.8" />
    </svg>
  );
}

export function GameFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-frame">
      <Corner className="tl" />
      <Corner className="tr" />
      <Corner className="bl" />
      <Corner className="br" />
      {children}
    </div>
  );
}

type IconKind = "coin" | "chest" | "tower" | "sky" | "scales";

function HudIcon({ kind }: { kind: IconKind }) {
  const common = { width: 22, height: 22, viewBox: "0 0 22 22", "aria-hidden": true } as const;
  switch (kind) {
    case "coin":
      return (
        <svg {...common}>
          <ellipse cx="11" cy="14" rx="8" ry="4" fill="#9a6c18" />
          <ellipse cx="11" cy="12" rx="8" ry="4" fill="#e9b949" stroke="#6e4a12" />
          <ellipse cx="11" cy="9" rx="8" ry="4" fill="#f6d77a" stroke="#6e4a12" />
          <path d="M8 9h6" stroke="#8a5e14" strokeWidth="1.2" />
        </svg>
      );
    case "chest":
      return (
        <svg {...common}>
          <path d="M3 9 Q11 2 19 9 Z" fill="#8a5a2a" stroke="#2a1a08" />
          <rect x="3" y="9" width="16" height="9" fill="#7a4e22" stroke="#2a1a08" />
          <rect x="3" y="9" width="16" height="2" fill="#d9a93e" />
          <rect x="9.5" y="10" width="3" height="4" fill="#f6d77a" stroke="#2a1a08" strokeWidth=".6" />
        </svg>
      );
    case "tower":
      return (
        <svg {...common}>
          <path d="M11 1 L16 8 H6 Z" fill="#3461b8" stroke="#14275a" />
          <rect x="7" y="8" width="8" height="12" fill="#8d929b" stroke="#3b3f45" />
          <path d="M9.5 20 v-4 a1.5 1.5 0 0 1 3 0 v4" fill="#3a2614" />
        </svg>
      );
    case "sky":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4" fill="#f6c25a" />
          <ellipse cx="13" cy="13" rx="7" ry="4" fill="#9aa4b8" />
          <ellipse cx="10" cy="12" rx="4" ry="3.2" fill="#c3cad8" />
        </svg>
      );
    case "scales":
      return (
        <svg {...common}>
          <path d="M11 3 V18 M5 6 H17 M7 19 H15" stroke="#d9a93e" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 6 L2.5 12 H7.5 Z M17 6 L14.5 12 H19.5 Z" fill="#f6d77a" stroke="#6e4a12" strokeWidth=".8" />
        </svg>
      );
  }
}

const WEATHER_TONE = {
  calm: "#f3e4bf",
  gathering: "#f2c14e",
  besieged: "#ff7a6a",
  unsurveyed: "#b9c4d6",
} as const;

export function GameHud({ state }: { state: GameState }) {
  const level = state.siege?.level ?? "unsurveyed";
  const items: { kind: IconKind; label: string; value: string; color?: string }[] = [
    { kind: "coin", label: "Realm value", value: formatNok(state.total_value_nok) },
    {
      kind: "chest",
      label: "Vault",
      value: state.vault.cash_nok === null ? VAULT_LABEL.unsurveyed : formatNok(state.vault.cash_nok),
    },
    { kind: "tower", label: "Towers", value: String(state.towers.length) },
    { kind: "sky", label: "Weather", value: SIEGE_LABEL[level], color: WEATHER_TONE[level] },
  ];
  if (state.temperament) {
    items.push({ kind: "scales", label: "Temperament", value: TEMPERAMENT_LABEL[state.temperament.level] });
  }
  return (
    <dl className="game-hud" aria-label="Realm at a glance">
      {items.map((i) => (
        <div key={i.label} className="game-hud-item">
          <HudIcon kind={i.kind} />
          <div className="min-w-0">
            <dt className="game-hud-label">{i.label}</dt>
            <dd className="game-hud-value tabular" style={i.color ? { color: i.color } : undefined}>
              {i.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
