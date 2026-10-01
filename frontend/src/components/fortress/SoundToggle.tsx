import { useCallback, useEffect, useRef, useState } from "react";
import { soundSupported, startAmbience, type Ambience } from "../../lib/fortressSound";
import type { FortressSiegeLevel } from "../../lib/types";

/** Game mode G7b: optional ambience, off by default and never remembered across
 * page loads — browsers only allow audio after a press, and a surprise noise on
 * opening a page that shows real money is not wanted. */

export default function SoundToggle({ weather }: { weather: FortressSiegeLevel | null | undefined }) {
  const [on, setOn] = useState(false);
  const ambience = useRef<Ambience | null>(null);
  const supported = soundSupported();

  const stop = useCallback(() => {
    ambience.current?.stop();
    ambience.current = null;
    setOn(false);
  }, []);

  const toggle = () => {
    if (on) {
      stop();
      return;
    }
    const a = startAmbience(weather);
    if (a) {
      ambience.current = a;
      setOn(true);
    }
  };

  useEffect(() => {
    ambience.current?.setWeather(weather);
  }, [weather]);

  // Silence on leaving the page.
  useEffect(
    () => () => {
      ambience.current?.stop();
      ambience.current = null;
    },
    [],
  );

  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title="Soft synthesized weather ambience. Off by default."
      className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-border-subtle"
    >
      Sound: {on ? "on" : "off"}
    </button>
  );
}
