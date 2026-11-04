import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { YARD_MAX_ROWS, yardBenchmark, yardView } from "./siegeYard";
import type { YardView } from "./siegeYard";

export type YardState =
  | { status: "reading" }
  | { status: "failed" }
  | { status: "ready"; view: YardView; refreshing: boolean };

/**
 * Asks the backend what a fall does to each tower: the same call the flat Siege Simulator makes. Debounced while the
 * slider moves; the newest answer wins; a failed read says so and leaves the rest of the panel working.
 */
export function useSiegeYard(fall: number, maxRows: number = YARD_MAX_ROWS): YardState {
  const [state, setState] = useState<YardState>({ status: "reading" });
  const latest = useRef(0);
  useEffect(() => {
    const id = ++latest.current;
    const timer = window.setTimeout(() => {
      setState((s) => (s.status === "ready" ? { ...s, refreshing: true } : { status: "reading" }));
      api
        .getSiegeSim(fall, yardBenchmark())
        .then((sim) => {
          if (id === latest.current) setState({ status: "ready", view: yardView(sim, maxRows), refreshing: false });
        })
        .catch(() => {
          if (id === latest.current) setState({ status: "failed" });
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fall, maxRows]);
  return state;
}
