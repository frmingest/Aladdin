import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Game mode toggle (F33, G2). A pure view preference: it never changes an
 * analysis, a score or a stored row, so it lives in this browser only —
 * not in the backend's app_settings — and defaults to OFF, which leaves the
 * app exactly as it was. Storage can be unavailable (private window), so
 * every access is guarded and the mode simply is not remembered then.
 */

const STORAGE_KEY = "aladdin-game-mode";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

interface GameModeContextValue {
  gameMode: boolean;
  setGameMode: (on: boolean) => void;
}

const GameModeContext = createContext<GameModeContextValue>({
  gameMode: false,
  setGameMode: () => {},
});

export function GameModeProvider({ children }: { children: React.ReactNode }) {
  const [gameMode, setGameModeState] = useState<boolean>(readStored);

  const setGameMode = useCallback((on: boolean) => setGameModeState(on), []);

  // The "study" skin (G3) re-colours the whole app through the theme tokens
  // while game mode is on. Off = the attribute is removed, nothing changes.
  useEffect(() => {
    const root = document.documentElement;
    if (gameMode) root.dataset.skin = "study";
    else delete root.dataset.skin;
    return () => {
      delete root.dataset.skin;
    };
  }, [gameMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, gameMode ? "on" : "off");
    } catch {
      /* blocked storage: the choice just isn't remembered */
    }
  }, [gameMode]);

  const value = useMemo(() => ({ gameMode, setGameMode }), [gameMode, setGameMode]);
  return <GameModeContext.Provider value={value}>{children}</GameModeContext.Provider>;
}

export function useGameMode(): GameModeContextValue {
  return useContext(GameModeContext);
}
