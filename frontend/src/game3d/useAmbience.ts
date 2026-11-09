import { useCallback, useEffect, useRef, useState } from "react";
import { soundSupported, startAmbience, type Ambience } from "../lib/fortressSound";
import type { FortressSiegeLevel } from "../lib/types";

/**
 * The 3D town's sound switch. Off on every load (browsers only allow audio after a press, and a surprise noise
 * on a page that shows real money is not wanted), follows the weather bed while on, and goes quiet when the page
 * is left. `supported` is false where there is no Web Audio, so the caller hides the button.
 */
export function useAmbience(level: FortressSiegeLevel | null) {
  const [on, setOn] = useState(false);
  const ambience = useRef<Ambience | null>(null);
  const supported = soundSupported();

  const stop = useCallback(() => {
    ambience.current?.stop();
    ambience.current = null;
    setOn(false);
  }, []);

  const toggle = useCallback(() => {
    if (ambience.current) {
      stop();
      return;
    }
    const a = startAmbience(level);
    if (a) {
      ambience.current = a;
      setOn(true);
    }
  }, [level, stop]);

  useEffect(() => {
    ambience.current?.setWeather(level);
  }, [level]);

  useEffect(
    () => () => {
      ambience.current?.stop();
      ambience.current = null;
    },
    [],
  );

  return { supported, on, toggle };
}
