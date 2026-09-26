import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDecimal, formatNok } from "../lib/format";
import type { CoinSeries, MetalHoldingRow, MetalPricePoint, PreciousMetalsOverview } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, SectionTitle, StatTile } from "../components/ui";

/** Physical 1oz gold/silver coins (Faiz's request, 2026-09-26): "part of my
 * investments... track their price development in some graphs". Valued at
 * gold-api.com spot converted to NOK (backend/app/services/precious_metals/).
 * Deliberately its own page and its own dashboard card rather than folded
 * into the equity Holding model or PortfolioOverview's concentration math --
 * same reasoning as Portfolio risk / Performance getting their own cards. */

function AddForm({ series, onAdded }: { series: CoinSeries[] | null; onAdded: () => void }) {
  const [metal, setMetal] = useState<"gold" | "silver">("gold");
  const [coinSeries, setCoinSeries] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePriceNok, setPurchasePriceNok] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => (series ?? []).filter((s) => s.metal === metal), [series, metal]);

  useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.code === coinSeries)) {
      setCoinSeries(options[0].code);
    }
  }, [options, coinSeries]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coinSeries || !quantity.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addMetalHolding({
        coin_series: coinSeries,
        quantity: quantity.trim(),
        purchase_date: purchaseDate.trim() || null,
        purchase_price_nok: purchasePriceNok.trim() || null,
        storage_location: storageLocation.trim() || null,
        notes: notes.trim() || null,
      });
      setQuantity("1");
      setPurchaseDate("");
      setPurchasePriceNok("");
      setStorageLocation("");
      setNotes("");
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add.");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink";
  return (
    <Card>
      <h2 className="text-sm font-semibold text-ink">Add coins</h2>
      <p className="mt-0.5 text-xs text-ink-faint">
        1oz coins, valued at today's gold/silver spot price converted to NOK.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Metal
          <div className="flex overflow-hidden rounded-md border border-border text-sm">
            {(["gold", "silver"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetal(m)}
                className={`px-2.5 py-1.5 font-medium capitalize ${
                  metal === m ? "bg-accent text-onfill" : "bg-surface text-ink-muted hover:bg-raised"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Coin
          <select className={`${input} w-56`} value={coinSeries} onChange={(e) => setCoinSeries(e.target.value)}>
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name} ({o.country})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Quantity (oz)
          <input
            className={`${input} w-20`}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(",", "."))}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Purchase date
          <input type="date" className={`${input} w-36`} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Purchase price (NOK)
          <input
            className={`${input} w-32`}
            inputMode="decimal"
            placeholder="optional"
            value={purchasePriceNok}
            onChange={(e) => setPurchasePriceNok(e.target.value.replace(",", "."))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Storage
          <input className={`${input} w-36`} placeholder="optional" value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
        </label>
        <Button type="submit" disabled={busy || !coinSeries || !quantity.trim()}>
          {busy ? "Adding…" : "Add"}
        </Button>
      </form>
      <label className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
        Notes
        <input className={`${input} w-full`} placeholder="optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </Card>
  );
}

function QuantityCell({ row, onSaved }: { row: MetalHoldingRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(row.quantity)));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await api.updateMetalHolding(row.id, { quantity: value.trim() });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid quantity");
    }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="tabular text-right text-ink hover:text-accent" title="Edit quantity">
        {formatDecimal(row.quantity, 2)} oz
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        className="tabular w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-right text-sm"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(",", "."))}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button onClick={save} className="text-xs font-medium text-accent">
        Save
      </button>
      {error && <span className="text-xs text-negative">{error}</span>}
    </span>
  );
}

function PriceChart({ gold, silver }: { gold: MetalPricePoint[]; silver: MetalPricePoint[] }) {
  const byDate = new Map<string, { on: string; gold?: number; silver?: number }>();
  for (const p of gold) byDate.set(p.on, { ...(byDate.get(p.on) ?? { on: p.on }), on: p.on, gold: Number(p.price_nok) });
  for (const p of silver) byDate.set(p.on, { ...(byDate.get(p.on) ?? { on: p.on }), on: p.on, silver: Number(p.price_nok) });
  const points = Array.from(byDate.values()).sort((a, b) => a.on.localeCompare(b.on));

  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">No price history yet. It accumulates one point per day this app is used.</p>;
  }
  if (points.length === 1) {
    return (
      <p className="text-sm text-ink-muted">
        Only today's price is recorded so far — come back tomorrow (and the days after) to see a trend line build up.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgb(var(--c-border-subtle))" vertical={false} />
          <XAxis
            dataKey="on"
            tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
            axisLine={{ stroke: "rgb(var(--c-border))" }}
            tickLine={false}
            tickFormatter={(v: string) => formatDate(v)}
            minTickGap={40}
          />
          <YAxis
            yAxisId="gold"
            tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
          />
          <YAxis
            yAxisId="silver"
            orientation="right"
            tick={{ fontSize: 11, fill: "rgb(var(--c-ink-faint))" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => v.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
          />
          <Tooltip
            formatter={(value: number) => `${Math.round(value).toLocaleString("nb-NO")} kr/oz`}
            labelFormatter={(v: string) => formatDate(v)}
            cursor={{ stroke: "rgb(var(--c-border))" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid rgb(var(--c-border))",
              background: "rgb(var(--c-raised))",
              color: "rgb(var(--c-ink))",
              boxShadow: "0 8px 24px -12px rgba(0,0,0,0.6)",
            }}
            labelStyle={{ color: "rgb(var(--c-ink-muted))" }}
            itemStyle={{ color: "rgb(var(--c-ink))" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="gold"
            type="monotone"
            dataKey="gold"
            name="Gold (kr/oz)"
            stroke="#d4af37"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            yAxisId="silver"
            type="monotone"
            dataKey="silver"
            name="Silver (kr/oz)"
            stroke="rgb(var(--c-ink-faint))"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PreciousMetalsPage() {
  const [series, setSeries] = useState<CoinSeries[] | null>(null);
  const [overview, setOverview] = useState<PreciousMetalsOverview | null>(null);
  const [goldHistory, setGoldHistory] = useState<MetalPricePoint[]>([]);
  const [silverHistory, setSilverHistory] = useState<MetalPricePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.getPreciousMetalsOverview().then(setOverview).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load."));
    api.getMetalPriceHistory("gold").then((h) => setGoldHistory(h.points)).catch(() => setGoldHistory([]));
    api.getMetalPriceHistory("silver").then((h) => setSilverHistory(h.points)).catch(() => setSilverHistory([]));
  }, []);

  useEffect(() => {
    api.getCoinSeries().then(setSeries).catch(() => setSeries([]));
    load();
  }, [load]);

  async function remove(row: MetalHoldingRow) {
    if (!window.confirm(`Remove ${formatDecimal(row.quantity, 2)} oz of ${row.coin_series_label}?`)) return;
    try {
      await api.removeMetalHolding(row.id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove.");
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      setOverview(await api.refreshPreciousMetalsOverview());
      const [g, s] = await Promise.all([api.getMetalPriceHistory("gold"), api.getMetalPriceHistory("silver")]);
      setGoldHistory(g.points);
      setSilverHistory(s.points);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  const goldSpot = overview?.spots.find((s) => s.metal === "gold");
  const silverSpot = overview?.spots.find((s) => s.metal === "silver");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Precious metals"
        subtitle="Physical 1oz gold and silver coins, valued at today's spot price."
        actions={
          <Button variant="secondary" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="space-y-6">
        <AddForm series={series} onAdded={load} />

        {!overview && !error && <p className="text-sm text-ink-muted">Loading…</p>}

        {overview && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile
                label="Total value"
                value={formatNok(overview.total_value_nok)}
                hint={formatDate(overview.as_of)}
              />
              <StatTile
                label="Gold spot"
                value={goldSpot?.available ? `${formatNok(goldSpot.price_nok_per_oz)}/oz` : "Unavailable"}
                hint={goldSpot?.available ? undefined : goldSpot?.reason ?? undefined}
              />
              <StatTile
                label="Silver spot"
                value={silverSpot?.available ? `${formatNok(silverSpot.price_nok_per_oz)}/oz` : "Unavailable"}
                hint={silverSpot?.available ? undefined : silverSpot?.reason ?? undefined}
              />
              <StatTile
                label="Holdings"
                value={`${formatDecimal(overview.total_oz_by_metal.gold ?? "0", 2)} oz gold`}
                hint={`${formatDecimal(overview.total_oz_by_metal.silver ?? "0", 2)} oz silver`}
              />
            </div>

            <Card>
              <SectionTitle hint="Accumulates one point per day this app is used -- gold-api.com's historical data isn't free.">
                Price development
              </SectionTitle>
              <PriceChart gold={goldHistory} silver={silverHistory} />
            </Card>

            {overview.holdings.length === 0 ? (
              <EmptyState>No coins added yet. Use the form above to add your first holding.</EmptyState>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-muted">
                        <th className="py-2 pr-4 font-medium">Coin</th>
                        <th className="py-2 pr-4 text-right font-medium">Quantity</th>
                        <th className="py-2 pr-4 text-right font-medium">Value</th>
                        <th className="py-2 pr-4 text-right font-medium">Unrealized P&amp;L</th>
                        <th className="py-2 pr-4 font-medium">Storage</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {overview.holdings.map((row) => {
                        const pnl = row.unrealized_pnl_nok;
                        return (
                          <tr key={row.id} className="border-t border-border-subtle align-middle">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-ink">{row.coin_series_label}</p>
                              <p className="text-xs text-ink-faint capitalize">
                                {row.metal}
                                {row.notes && ` · ${row.notes}`}
                              </p>
                            </td>
                            <td className="py-3 pr-4 text-right">
                              <QuantityCell row={row} onSaved={load} />
                            </td>
                            <td className="tabular py-3 pr-4 text-right text-ink">
                              {row.value_nok ? formatNok(row.value_nok) : "—"}
                            </td>
                            <td
                              className={`tabular py-3 pr-4 text-right font-medium ${
                                pnl === null ? "text-ink-faint" : Number(pnl) >= 0 ? "text-positive" : "text-negative"
                              }`}
                            >
                              {pnl === null ? "—" : formatNok(pnl)}
                            </td>
                            <td className="py-3 pr-4 text-xs text-ink-muted">{row.storage_location ?? "—"}</td>
                            <td className="py-3 text-right">
                              <button onClick={() => remove(row)} className="text-xs text-ink-faint hover:text-negative">
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-ink-faint">
                  Valued at spot only -- no numismatic premium is modeled. Click a quantity to edit it.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
