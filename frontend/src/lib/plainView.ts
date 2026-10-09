import { useCallback, useEffect, useState } from "react";

/** "Plain view" (game UI standard 3): every game page can drop its painted scene and show the same
 * facts as labelled blocks. A view preference only, kept in this browser (guarded: storage can be
 * unavailable), shared by every page through one event. */

const KEY = "aladdin-plain-view";
const EVENT = "aladdin-plain-view-change";

export function readPlain(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function usePlainView(): [boolean, (on: boolean) => void] {
  const [plain, setPlain] = useState<boolean>(readPlain);
  useEffect(() => {
    const sync = () => setPlain(readPlain());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const set = useCallback((on: boolean) => {
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* not remembered */
    }
    setPlain(on);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [plain, set];
}
