import type { FortressSiegeLevel } from "./types";

/**
 * Optional ambience for the Fortress (F33, G7b). OFF by default and only ever
 * started by the person pressing the Sound button, so no browser autoplay rule
 * is fought and nothing makes noise unasked. It is synthesized in the browser
 * (filtered noise, no audio files, no network) and follows the stored weather.
 * It carries no information a sighted reader lacks and rewards nothing.
 */

export interface SoundProfile {
  /** Filter type for the noise bed. */
  filter: "lowpass" | "bandpass";
  /** Filter centre/cut-off in Hz. */
  freq: number;
  /** Master level 0-1 before the safety cap. */
  gain: number;
  /** Slow swell: LFO rate in Hz (0 = none) and depth as a share of gain. */
  swellHz: number;
  swellDepth: number;
}

/** Hard ceiling for the master level, so even a wrong profile cannot be loud. */
export const MAX_MASTER_GAIN = 0.12;

/** Soft wind when calm, a fuller roar as the weather turns, a low rumble in a siege. */
export function soundProfile(level: FortressSiegeLevel | null | undefined): SoundProfile {
  switch (level) {
    case "calm":
      return { filter: "lowpass", freq: 420, gain: 0.05, swellHz: 0.12, swellDepth: 0.35 };
    case "gathering":
      return { filter: "bandpass", freq: 900, gain: 0.08, swellHz: 0.2, swellDepth: 0.45 };
    case "besieged":
      return { filter: "lowpass", freq: 240, gain: 0.11, swellHz: 0.32, swellDepth: 0.55 };
    default:
      return { filter: "lowpass", freq: 300, gain: 0.03, swellHz: 0, swellDepth: 0 };
  }
}

export function cappedGain(gain: number): number {
  if (!Number.isFinite(gain) || gain < 0) return 0;
  return Math.min(MAX_MASTER_GAIN, gain);
}

export function soundSupported(): boolean {
  return typeof window !== "undefined" && typeof window.AudioContext === "function";
}

export interface Ambience {
  setWeather: (level: FortressSiegeLevel | null | undefined) => void;
  stop: () => void;
}

/** Start the ambience. Call only from a user gesture. Returns null if the
 * browser has no Web Audio (the caller then hides the control). */
export function startAmbience(level: FortressSiegeLevel | null | undefined): Ambience | null {
  if (!soundSupported()) return null;
  let ctx: AudioContext;
  try {
    ctx = new window.AudioContext();
  } catch {
    return null;
  }

  // Two seconds of white noise, looped.
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  const master = ctx.createGain();
  master.gain.value = 0;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.connect(lfoDepth);
  lfoDepth.connect(master.gain);
  source.connect(filter);
  filter.connect(master);
  master.connect(ctx.destination);

  const apply = (l: FortressSiegeLevel | null | undefined, fade: number) => {
    const p = soundProfile(l);
    const g = cappedGain(p.gain);
    const t = ctx.currentTime;
    filter.type = p.filter;
    filter.frequency.setTargetAtTime(p.freq, t, 0.4);
    master.gain.setTargetAtTime(g, t, fade);
    lfo.frequency.setTargetAtTime(p.swellHz, t, 0.4);
    lfoDepth.gain.setTargetAtTime(g * p.swellDepth, t, 0.4);
  };

  source.start();
  lfo.start();
  void ctx.resume();
  apply(level, 1.2); // fade in, no sudden noise

  return {
    setWeather: (l) => apply(l, 0.8),
    stop: () => {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(0, t, 0.25);
      window.setTimeout(() => {
        try {
          source.stop();
          lfo.stop();
          void ctx.close();
        } catch {
          /* already stopped */
        }
      }, 900);
    },
  };
}
