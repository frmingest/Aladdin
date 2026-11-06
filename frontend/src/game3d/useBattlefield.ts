import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { SiegeBacktest, StormDrills } from "../lib/types";
import type { Loadable } from "./battlefield";

/**
 * Reads the flat Siege page's stored back-test and the player's own Storm Drill notes, once, when the field opens.
 * Both are plain GET reads: they spend no model quota and write nothing. Each fails alone, so a missing back-test
 * leaves the war table readable and the other way round.
 */
export function useBattlefield(): { backtest: Loadable<SiegeBacktest>; drills: Loadable<StormDrills> } {
  const [backtest, setBacktest] = useState<Loadable<SiegeBacktest>>({ status: "reading" });
  const [drills, setDrills] = useState<Loadable<StormDrills>>({ status: "reading" });
  useEffect(() => {
    let live = true;
    api
      .getSiegeBacktest()
      .then((value) => live && setBacktest({ status: "ready", value }))
      .catch(() => live && setBacktest({ status: "failed" }));
    api
      .getStormDrills()
      .then((value) => live && setDrills({ status: "ready", value }))
      .catch(() => live && setDrills({ status: "failed" }));
    return () => {
      live = false;
    };
  }, []);
  return { backtest, drills };
}
