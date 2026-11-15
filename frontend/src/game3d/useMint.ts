import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { PrinterLever, PrinterResult } from "../lib/types";
import { DEFAULT_HORIZON, HORIZONS, notches, nextNotch, pullKey, pullsFrom, wallStateOf } from "./mintRoom";
import type { LeverState, WallState } from "./mintRoom";

/** What the Mint room shows: the levers the ledger lists, where each is set, the span, and the last stamped answer. */
export interface MintView {
  levers: readonly PrinterLever[];
  leverState: LeverState;
  horizon: number;
  result: PrinterResult | null;
  wall: WallState;
  /** The ledger could not be read: the wall stays bare. */
  ledgerFailed: boolean;
}

export const EMPTY_MINT: MintView = { levers: [], leverState: {}, horizon: DEFAULT_HORIZON, result: null, wall: "empty", ledgerFailed: false };

export interface MintControls {
  view: MintView;
  /** E at a lever: the next notch (then back to rest). */
  pull: (key: string) => void;
  /** E at the span post: 1 year, then 3, then 1. */
  toggleSpan: () => void;
  /** E at the press: ask the backend for what the pulled levers would do. */
  stamp: () => void;
  /** True when at least one lever is pulled (STAMP has something to send). */
  canStamp: boolean;
}

/**
 * The Royal Mint's state (issue #413). Reads the lever list once, when you first go in (`active`). A stamp is one read-only call
 * (`GET /game/printer`); nothing is saved and nothing is worked out here. If a lever or the span moves after a stamp, the old
 * answer stays on the wall marked as stale until you stamp again, so a plate can never claim a pull it does not match.
 */
export function useMint(active: boolean): MintControls {
  const [levers, setLevers] = useState<readonly PrinterLever[]>([]);
  const [ledgerFailed, setLedgerFailed] = useState(false);
  const [leverState, setLeverState] = useState<LeverState>({});
  const [horizon, setHorizon] = useState<number>(DEFAULT_HORIZON);
  const [result, setResult] = useState<PrinterResult | null>(null);
  const [stampedKey, setStampedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const ticket = useRef(0);
  const asked = useRef(false);

  // Read once. No "still mounted" guard on purpose: in development React runs this effect twice and cleans up between, and a guard
  // would throw away the first (only) answer while `asked` stops a second read.
  useEffect(() => {
    if (!active || asked.current) return;
    asked.current = true;
    api
      .getPrinterLedger()
      .then((l) => setLevers(l.levers))
      .catch(() => {
        asked.current = false;
        setLedgerFailed(true);
      });
  }, [active]);

  const pulls = useMemo(() => pullsFrom(levers, leverState), [levers, leverState]);
  const currentKey = pullKey(pulls, horizon);

  const pull = useCallback(
    (key: string) => {
      const lever = levers.find((l) => l.key === key);
      if (!lever) return;
      const count = notches(lever).length;
      setLeverState((s) => ({ ...s, [key]: nextNotch(s[key] ?? -1, count) }));
    },
    [levers],
  );

  const toggleSpan = useCallback(() => setHorizon((h) => (h === HORIZONS[0] ? HORIZONS[1] : HORIZONS[0])), []);

  const stamp = useCallback(() => {
    if (pulls.length === 0) return;
    const mine = ++ticket.current;
    const key = pullKey(pulls, horizon);
    setStatus("loading");
    api
      .getPrinter(pulls, horizon)
      .then((r) => {
        if (ticket.current !== mine) return;
        setResult(r);
        setStampedKey(key);
        setStatus("idle");
      })
      .catch(() => {
        if (ticket.current !== mine) return;
        setStatus("failed");
      });
  }, [pulls, horizon]);

  const wall: WallState = wallStateOf(status, result, stampedKey, currentKey);

  const view = useMemo<MintView>(
    () => ({ levers, leverState, horizon, result, wall, ledgerFailed }),
    [levers, leverState, horizon, result, wall, ledgerFailed],
  );
  return { view, pull, toggleSpan, stamp, canStamp: pulls.length > 0 };
}
