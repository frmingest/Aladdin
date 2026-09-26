import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

/**
 * Demo mode (2026-09-26): fetched once here and shared through context so
 * Layout's banner and SettingsPage's toggle always agree on the current
 * state without each polling the backend separately. See
 * backend/app/api/settings.py / app/services/settings/demo_mode.py.
 */

interface DemoModeContextValue {
  /** null while the first GET /settings/demo-mode is still in flight. */
  demoMode: boolean | null;
  refresh: () => void;
  setDemoMode: (enabled: boolean) => Promise<void>;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  demoMode: null,
  refresh: () => {},
  setDemoMode: async () => {},
});

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean | null>(null);

  const refresh = useCallback(() => {
    api
      .getDemoMode()
      .then((state) => setDemoModeState(state.demo_mode))
      .catch(() => {
        // Backend unreachable or an old deploy without this endpoint yet —
        // treat as "unknown", not "on". The banner only shows on a
        // confirmed true, so this never falsely hides or shows it.
        setDemoModeState(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setDemoMode = useCallback(async (enabled: boolean) => {
    const state = await api.setDemoMode(enabled);
    setDemoModeState(state.demo_mode);
  }, []);

  const value = useMemo(() => ({ demoMode, refresh, setDemoMode }), [demoMode, refresh, setDemoMode]);

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}
