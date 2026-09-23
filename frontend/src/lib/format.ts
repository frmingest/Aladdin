/**
 * Every numeric value from the API is a Decimal serialized as a string
 * (see src/lib/types.ts's header comment) — these all parse before
 * formatting, never render a raw backend string directly.
 */

export function formatDecimal(value: string, fractionDigits = 2): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPercent(value: string, fractionDigits = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${(n * 100).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** A filing-scale money amount: "USD 1,787.4m" (millions, one decimal —
 * the precision ESEF statements are tagged at), or plain units below 1m. */
export function formatMoney(value: string, currency: string | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  const prefix = currency ? `${currency} ` : "";
  if (Math.abs(n) >= 1_000_000) {
    return `${prefix}${(n / 1_000_000).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}m`;
  }
  return `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** A ratio expressed as a multiple: "2.93×". */
export function formatMultiple(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;
}
