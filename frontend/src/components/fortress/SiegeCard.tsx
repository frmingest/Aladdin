import { Link } from "react-router-dom";
import { SIEGE_LABEL, formatShock } from "../../lib/fortress";
import { formatNok } from "../../lib/format";
import type { GameSiege } from "../../lib/types";
import { Card } from "../ui";

const LEVEL_TEXT = {
  calm: "No warning signs in the stored macro regime or stress scenario.",
  gathering: "Warning signs: the stored macro regime or stress scenario is uncomfortable.",
  besieged: "Danger: the stored macro regime is a crisis or the stress scenario is severe.",
  unsurveyed: "Nothing is stored yet, so the weather is not surveyed (not the same as calm).",
} as const;

const LEVEL_CLASS = {
  calm: "text-positive",
  gathering: "text-caution",
  besieged: "text-negative",
  unsurveyed: "text-ink-muted",
} as const;

/** The weather over the realm: macro regime plus the stored stress scenario,
 * and the shared weak walls. Everything is read from stored snapshots and
 * labelled with its age. It is a what-if, not a forecast. */
export default function SiegeCard({ siege }: { siege: GameSiege | null }) {
  if (siege === null) return null;
  return (
    <Card>
      <h2 className="section-title">The weather and the siege</h2>
      <p className={`text-base font-semibold ${LEVEL_CLASS[siege.level]}`}>{SIEGE_LABEL[siege.level]}</p>
      <p className="text-sm text-ink-muted">{LEVEL_TEXT[siege.level]}</p>
      {siege.reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
          {siege.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <dl className="tabular mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-ink-faint">Stress what-if, equity book</dt>
        <dd className="text-right text-ink">{formatShock(siege.portfolio_shock_pct)}</dd>
        <dt className="text-ink-faint">What-if loss</dt>
        <dd className="text-right text-ink">{formatNok(siege.portfolio_drawdown_nok)}</dd>
        <dt className="text-ink-faint">Risk snapshot</dt>
        <dd className={`text-right ${siege.risk_snapshot_stale ? "text-caution" : "text-ink"}`}>
          {siege.risk_snapshot_age_days === null
            ? "not stored"
            : `${siege.risk_snapshot_age_days} days old${siege.risk_snapshot_stale ? " (old)" : ""}`}
        </dd>
        <dt className="text-ink-faint">Land prices</dt>
        <dd className={`text-right ${siege.land_snapshot_stale ? "text-caution" : "text-ink"}`}>
          {siege.land_snapshot_age_days === null
            ? "not stored"
            : `${siege.land_snapshot_age_days} days old${siege.land_snapshot_stale ? " (old)" : ""}`}
        </dd>
        <dt className="text-ink-faint">Towers with a fired tripwire</dt>
        <dd className={`text-right ${siege.breached_count > 0 ? "font-semibold text-negative" : "text-ink"}`}>
          {siege.breached_count}
        </dd>
      </dl>
      {siege.shared_walls.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs uppercase tracking-wide text-ink-faint">Shared weak walls</h3>
          <ul className="mt-1 space-y-1 text-sm text-ink-muted">
            {siege.shared_walls.map((w) => (
              <li key={w.tickers.join("+")}>
                {w.names.join(" + ")}: moved together (correlation {Number(w.correlation).toFixed(2)}), about{" "}
                {Number(w.combined_weight_pct).toFixed(0)}% of the portfolio between them
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-faint">
        Read from the stored risk and margin-of-safety snapshots; refresh{" "}
        <Link to="/risk" className="text-accent hover:underline">
          Portfolio risk
        </Link>{" "}
        and{" "}
        <Link to="/margin-of-safety" className="text-accent hover:underline">
          Margin of safety
        </Link>{" "}
        to update them. A stored what-if, not a forecast.
      </p>
    </Card>
  );
}
