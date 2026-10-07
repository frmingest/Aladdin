import { useState } from "react";
import { VAULT_LABEL } from "../../lib/fortress";
import { formatDate, formatNok, formatPct100 } from "../../lib/format";
import type { FortressVaultLevel, GameVault } from "../../lib/types";
import { Button, Card } from "../ui";
import VaultEditor from "./VaultEditor";

/** How full the vault picture is drawn. Chosen by the backend's level, never
 * by this file. */
const FILL: Record<FortressVaultLevel, number> = {
  deep: 1,
  stocked: 0.66,
  thin: 0.33,
  empty: 0.04,
  unsurveyed: 0,
};

function VaultPicture({ level }: { level: FortressVaultLevel }) {
  const fill = FILL[level];
  const innerH = 70;
  return (
    <svg viewBox="0 0 120 110" className="h-28 w-32 shrink-0" role="img" aria-label={VAULT_LABEL[level]}>
      <defs>
        <linearGradient id="vc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d365" />
          <stop offset="1" stopColor="#c99a2e" />
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="100" height="84" rx="6" fill="#2f3947" stroke="#000" strokeOpacity=".4" />
      <path d="M10 20 L60 4 L110 20 Z" fill="#4f5a6c" />
      <rect x="24" y="30" width="72" height={innerH + 8} rx="4" fill="#161a22" />
      {level === "unsurveyed" ? (
        <text x="60" y="78" textAnchor="middle" fontSize="28" fill="#8b95a5">
          ?
        </text>
      ) : (
        <path
          d={`M24 ${30 + innerH + 8} V${30 + innerH + 8 - innerH * fill} Q60 ${30 + innerH + 8 - innerH * fill - 14 * fill} 96 ${30 + innerH + 8 - innerH * fill} V${30 + innerH + 8} Z`}
          fill="url(#vc-gold)"
        />
      )}
    </svg>
  );
}

export default function VaultCard({
  vault,
  demo = false,
  onChanged,
}: {
  vault: GameVault;
  demo?: boolean;
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const gold = Number(vault.gold_oz);
  const silver = Number(vault.silver_oz);
  return (
    <Card>
      <h2 className="section-title">Vault</h2>
      <div className="flex items-center gap-4">
        <VaultPicture level={vault.level} />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">{VAULT_LABEL[vault.level]}</p>
          {vault.cash_nok === null ? (
            <p className="mt-1 text-ink-muted">
              Not entered yet. Enter your cash below and the vault fills from your own figure.
            </p>
          ) : (
            <p className="mt-1 text-ink-muted">
              <span className="tabular text-ink">{formatNok(vault.cash_nok)}</span> in cash
              {vault.cash_share_pct !== null && (
                <>
                  , <span className="tabular">{formatPct100(vault.cash_share_pct)}</span> of cash plus portfolio
                </>
              )}
              .
            </p>
          )}
          {vault.accounts_with_cash > 0 && (
            <p className="mt-1 text-xs text-ink-faint">
              {vault.accounts_with_cash} of {vault.accounts_total} accounts have a cash figure
              {vault.cash_oldest_as_of ? `; oldest entered ${formatDate(vault.cash_oldest_as_of)}` : ""}.
            </p>
          )}
          {vault.cash_stale && (
            <p className="mt-1 text-xs text-caution">
              Some cash figures are more than a month old. Update them so the vault is not drawn from an old number.
            </p>
          )}
          {(gold > 0 || silver > 0) && (
            <p className="mt-1 text-xs text-ink-muted">
              Physical coins: {gold > 0 ? `${gold} oz gold` : ""}
              {gold > 0 && silver > 0 ? ", " : ""}
              {silver > 0 ? `${silver} oz silver` : ""} (ounces only; not valued here).
            </p>
          )}
        </div>
      </div>
      {demo ? (
        <p className="mt-3 text-xs text-ink-faint">Demo data: cash cannot be edited while demo mode is on.</p>
      ) : (
        onChanged &&
        vault.accounts.length > 0 &&
        (editing ? (
          <VaultEditor accounts={vault.accounts} onSaved={onChanged} onClose={() => setEditing(false)} />
        ) : (
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
              {vault.accounts_with_cash === 0 ? "Enter cash" : "Update cash"}
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}
