import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatNok } from "../lib/format";
import { WALL_LABEL, formatShock, isFundCode, shortLabel } from "../lib/fortress";
import {
  SIEGE_SIM_RULES,
  SIM_EXPOSURE_LABEL,
  SIM_LEVEL_LABEL,
  SIM_LIMITS,
  clampDrop,
  coverageLine,
  damageWidth,
  formatDrop,
  headline,
  holdingLine,
  betaSourceLine,
  presetDrop,
} from "../lib/siege";
import type { SiegeSim, SiegeSimExposure, SiegeSimHolding } from "../lib/types";
import { Card, EmptyState, PageHeader } from "../components/ui";
import GameFooter from "../components/fortress/GameFooter";

/** The Siege Simulator (game mode, G13): pick how far the market falls and watch it reach each
 * tower. A what-if over stored data: each holding's beta scales the fall, and the result is
 * read with the same storm and siege lines the Fortress already uses. Read-only; it never trades,
 * scores or forecasts anything. */

const LEVEL_CLASS = { calm: "text-positive", gathering: "text-caution", besieged: "text-negative", unsurveyed: "text-ink-muted" } as const;
const BAR_CLASS: Record<SiegeSimExposure, string> = {
  sheltered: "bg-positive/70",
  exposed: "bg-caution",
  breach_risk: "bg-negative",
  unmodelled: "bg-border",
};
const FILL: Record<SiegeSimExposure, string> = { sheltered: "#4f9d6b", exposed: "#d8a13a", breach_risk: "#c8473c", unmodelled: "#6b6458" };

/** A row of small keeps, one per holding, the damage rising from the foot of each wall as the fall deepens. */
function SiegeStrip({ rows }: { rows: SiegeSimHolding[] }) {
  const shown = rows.slice(0, 18);
  const w = 46;
  const gap = 10;
  const height = 120;
  const width = shown.length * (w + gap) + gap;
  return (
    <svg
      viewBox={`0 0 ${Math.max(width, 120)} ${height + 22}`}
      className="h-auto w-full max-w-3xl"
      role="img"
      aria-label="Each tower with the share of its wall lost in this what-if"
    >
      {shown.map((h, i) => {
        const x = gap + i * (w + gap);
        const dmg = h.modelled ? damageWidth(h.shock_pct) : 0;
        const dmgH = (dmg / 100) * (height - 26);
        return (
          <g key={h.holding_id}>
            <rect x={x} y={26} width={w} height={height - 26} rx={3} fill="#3a342b" stroke="#6b5a3d" />
            <path d={`M${x} 26 v-10 h8 v6 h8 v-6 h8 v6 h8 v-6 h6 v10 z`} fill="#4a4235" stroke="#6b5a3d" />
            {h.modelled ? (
              <rect x={x + 1} y={height - dmgH} width={w - 2} height={dmgH} fill={FILL[h.exposure]} opacity={0.85}>
                <title>{`${h.ticker}: ${holdingLine(h)}`}</title>
              </rect>
            ) : (
              <text x={x + w / 2} y={height / 2 + 10} textAnchor="middle" fontSize="16" fill="#a8977a">
                ?
              </text>
            )}
            <text x={x + w / 2} y={height + 14} textAnchor="middle" fontSize="8.5" fill="#cdbb97">
              {shortLabel(h.name, h.ticker, 7)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Row({ h, benchmark }: { h: SiegeSimHolding; benchmark: string }) {
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-border-subtle py-3 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center">
      <div className="min-w-0">
        <Link to={`/holdings/${h.holding_id}`} className="font-medium text-ink hover:underline">
          {h.name}
        </Link>
        <p className="truncate text-xs text-ink-faint">
          {isFundCode(h.ticker) ? "Fund" : h.ticker} · {WALL_LABEL[h.wall]}
          {h.weight_pct ? ` · ${Number(h.weight_pct).toFixed(1)}% of the book` : ""}
        </p>
      </div>
      <div className="min-w-0">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-border-subtle" aria-hidden>
          <div className={`h-full rounded-full transition-[width] duration-300 ${BAR_CLASS[h.exposure]}`} style={{ width: `${damageWidth(h.shock_pct)}%` }} />
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          {holdingLine(h)}
          {h.modelled && h.beta !== null && ` ${betaSourceLine(h, benchmark)}`}
          {h.modelled && h.stored_shock_pct !== null && ` The Fortress's own stress case for it: ${formatShock(h.stored_shock_pct)}.`}
        </p>
      </div>
      <div className="tabular text-right text-sm">
        <p className={h.modelled ? "font-semibold text-ink" : "text-ink-faint"}>{h.modelled ? formatShock(h.shock_pct) : "?"}</p>
        <p className="text-xs text-ink-faint">{h.modelled ? formatNok(h.loss_nok) : SIM_EXPOSURE_LABEL.unmodelled}</p>
      </div>
    </li>
  );
}

export default function SiegeSimulatorPage() {
  const [sim, setSim] = useState<SiegeSim | null>(null);
  const [drop, setDrop] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  // First load uses the file's default fall; after that the slider drives it (debounced, newest answer wins).
  useEffect(() => {
    document.title = "Siege Simulator · Aladdin";
    const id = ++latest.current;
    const wait = drop === null ? 0 : 250;
    const t = window.setTimeout(() => {
      setLoading(true);
      api
        .getSiegeSim(drop ?? undefined)
        .then((s) => {
          if (id !== latest.current) return;
          setSim(s);
          setError(null);
          if (drop === null) setDrop(Number(s.market_drop));
        })
        .catch((e: unknown) => {
          if (id === latest.current) setError(e instanceof ApiError ? e.message : "Could not run the siege.");
        })
        .finally(() => {
          if (id === latest.current) setLoading(false);
        });
    }, wait);
    return () => window.clearTimeout(t);
  }, [drop]);

  const min = sim ? Number(sim.drop_min) : 0.05;
  const max = sim ? Number(sim.drop_max) : 0.6;
  const step = sim ? Number(sim.drop_step) : 0.05;
  const toStorm = useMemo(() => (sim ? presetDrop(sim.drop_to_gathering, min, max) : null), [sim, min, max]);
  const toSiege = useMemo(() => (sim ? presetDrop(sim.drop_to_besieged, min, max) : null), [sim, min, max]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <nav aria-label="Where you are" className="mb-3 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/fortress" className="hover:text-ink">Fortress</Link>
        <span aria-hidden>›</span>
        <span className="text-ink">Siege Simulator</span>
      </nav>
      <PageHeader
        title="The Siege Simulator"
        subtitle="Choose how far the market falls and see which towers it reaches first. Each holding moves by its own beta; the result is read with the same storm and siege lines as the Fortress. A what-if over stored data: nothing here is a forecast, and nothing is bought or sold."
        actions={sim?.demo ? <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-ink">Demo data</span> : null}
      />

      {error && <Card className="mb-4 border-negative/40 bg-negative-subtle text-sm text-negative">{error}</Card>}
      {!sim && loading && <EmptyState>Raising the siege engines…</EmptyState>}

      {sim && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Market falls by</p>
                <p className="tabular font-display text-4xl text-ink" aria-live="polite">{formatDrop(drop ?? sim.market_drop)}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {toStorm !== null && (
                  <button type="button" className="rounded-md border border-border px-3 py-1 text-ink-muted hover:text-ink" onClick={() => setDrop(toStorm)} title={sim.reach_note_gathering}>
                    Reach the storm line: {formatDrop(toStorm)}
                  </button>
                )}
                {toSiege !== null && (
                  <button type="button" className="rounded-md border border-border px-3 py-1 text-ink-muted hover:text-ink" onClick={() => setDrop(toSiege)} title={sim.reach_note_besieged}>
                    Reach the siege line: {formatDrop(toSiege)}
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              className="mt-4 w-full accent-[var(--color-accent,#c9a227)]"
              min={min}
              max={max}
              step={step}
              value={drop ?? Number(sim.market_drop)}
              onChange={(e) => setDrop(clampDrop(Number(e.target.value), min, max))}
              aria-label="Size of the market fall"
              aria-valuetext={formatDrop(drop ?? sim.market_drop)}
            />
            <div className="tabular mt-1 flex justify-between text-xs text-ink-faint">
              <span>{formatDrop(min)}</span>
              <span>{formatDrop(max)}</span>
            </div>
          </Card>

          <Card>
            <h2 className="section-title">What it does to the realm</h2>
            <p className={`text-base font-semibold ${LEVEL_CLASS[sim.level]}`}>{SIM_LEVEL_LABEL[sim.level]}</p>
            <p className="text-sm text-ink-muted">{headline(sim)}</p>
            {sim.level_reason && <p className="mt-1 text-xs text-ink-faint">{sim.level_reason}</p>}
            {sim.portfolio_shock_pct !== null && (
            <dl className="tabular mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-ink-faint">Modelled book</dt><dd className="text-ink">{formatShock(sim.portfolio_shock_pct)}</dd></div>
              <div><dt className="text-ink-faint">What-if loss</dt><dd className="text-ink">{formatNok(sim.portfolio_loss_nok)}</dd></div>
              <div><dt className="text-ink-faint">Weighted beta</dt><dd className="text-ink">{sim.weighted_beta ?? "—"}</dd></div>
              <div><dt className="text-ink-faint">Coverage</dt><dd className="text-ink">{sim.coverage === null ? "—" : `${(Number(sim.coverage) * 100).toFixed(0)}%`}</dd></div>
            </dl>
            )}
            {sim.portfolio_shock_pct !== null && <p className="mt-2 text-xs text-ink-faint">{coverageLine(sim)}</p>}
            {sim.level !== "unsurveyed" && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
                <li>{sim.reach_note_gathering}</li>
                <li>{sim.reach_note_besieged}</li>
              </ul>
            )}
          </Card>

          {sim.holdings.length > 0 && (
            <Card>
              <h2 className="section-title">The towers under attack</h2>
              <div className="mb-2 overflow-x-auto rounded-md bg-[#1c1812] p-3">
                <SiegeStrip rows={sim.holdings} />
              </div>
              <p className="mb-1 text-xs text-ink-faint">
                The filled part of each wall is the share lost in this what-if. Grey with a question mark: not modelled.
                {sim.holdings.length > 18 ? ` Showing the 18 worst-hit of ${sim.holdings.length}.` : ""}
              </p>
              <ul>{sim.holdings.filter((h) => h.modelled).map((h) => <Row key={h.holding_id} h={h} benchmark={sim.benchmark_ticker} />)}</ul>
              {sim.holdings.some((h) => !h.modelled) && (
                <div className="mt-3 text-sm text-ink-muted">
                  <p className="font-medium text-ink">
                    Not modelled ({sim.holdings.filter((h) => !h.modelled).length}): no usable beta, so they are left out of
                    the total, not given a default.
                  </p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {sim.holdings
                      .filter((h) => !h.modelled)
                      .map((h) => (
                        <li key={h.holding_id}>
                          <Link to={`/holdings/${h.holding_id}`} className="text-accent hover:underline">
                            {h.name}
                          </Link>
                          {h.reason ? `: ${h.reason}` : ""}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {sim.holdings.length === 0 && <EmptyState>No holdings to put under siege yet.</EmptyState>}

          <Card className="text-sm text-ink-muted">
            <p>{SIM_LIMITS}</p>
            {sim.notes
              .filter((n) => !n.startsWith("This is a what-if") && !n.startsWith("Not modelled"))
              .map((n) => (
                <p key={n} className="mt-1">{n}</p>
              ))}
          </Card>
          <GameFooter
            rules={`Lines: storm at ${formatShock(sim.gathering_line)}, siege at ${formatShock(sim.besieged_line)} for the book (Fortress mapping ${sim.mapping_version}). Slider range and coverage floor: scenarios ${sim.scenarios_version}. Reading rules ${SIEGE_SIM_RULES}.${sim.oldest_beta_at ? ` Oldest beta stored ${sim.oldest_beta_at.slice(0, 10)}.` : ""}`}
          />
        </div>
      )}
    </div>
  );
}
