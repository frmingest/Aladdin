import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { DEFAULT_BASIS } from "./analystTypes";
import type { AnalystModeState } from "./analystTypes";
import type { AnalystMode } from "./types";

/**
 * Whole-app analyst mode (Epic F22, story 22.1): Buffett/Munger (default),
 * Ray Dalio, or side-by-side. Server-side setting (backend/app/api/
 * settings.py), fetched once and shared through context so the top-bar
 * toggle and every page agree. There is deliberately no per-page override
 * (decision 4).
 */


interface AnalystModeContextValue {
  /** Buffett/Munger until the first GET answers (and if it fails). */
  mode: AnalystMode;
  loaded: boolean;
  synthesisEnabled: boolean;
  dalioVerdictBasis: string;
  setMode: (mode: AnalystMode) => Promise<void>;
  setSynthesisEnabled: (enabled: boolean) => Promise<void>;
  error: string | null;
}

const AnalystModeContext = createContext<AnalystModeContextValue>({
  mode: "buffett_munger",
  loaded: false,
  synthesisEnabled: false,
  dalioVerdictBasis: DEFAULT_BASIS,
  setMode: async () => {},
  setSynthesisEnabled: async () => {},
  error: null,
});

export function AnalystModeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AnalystModeState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAnalystMode()
      .then(setState)
      .catch(() => {
        // An older backend without F22: stay in Buffett/Munger, the pre-F22 behaviour.
        setState(null);
      });
  }, []);

  const setMode = useCallback(async (mode: AnalystMode) => {
    setError(null);
    try {
      setState(await api.setAnalystMode(mode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch mode.");
    }
  }, []);

  const setSynthesisEnabled = useCallback(async (enabled: boolean) => {
    setError(null);
    try {
      setState(await api.setSynthesisEnabled(enabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the setting.");
    }
  }, []);

  const value = useMemo<AnalystModeContextValue>(
    () => ({
      mode: state?.mode ?? "buffett_munger",
      loaded: state !== null,
      synthesisEnabled: state?.synthesis_enabled ?? false,
      dalioVerdictBasis: state?.dalio_verdict_basis ?? DEFAULT_BASIS,
      setMode,
      setSynthesisEnabled,
      error,
    }),
    [state, setMode, setSynthesisEnabled, error],
  );

  return <AnalystModeContext.Provider value={value}>{children}</AnalystModeContext.Provider>;
}

export function useAnalystMode(): AnalystModeContextValue {
  return useContext(AnalystModeContext);
}
