# Market Street: "Top pick" stall motion (spec + paste-ready code)

Date: 2026-10-17. Status: written, not applied, not measured. No repo file was edited for this doc (the street files are being rebuilt by another engineer). Apply after that rebuild lands, then fill the performance note at the bottom.

Visual verb + scene: a lamp-lit pennant drops onto the awning of a stall the analyst rated top, and the ground under it glows softly. Fact encoded: the stored analyst rating is "Strong Buy" (`row.verdict_rating`). It is not the price tone (the flag and plate edge keep saying In range / Near / Above / No price).

## The effect (one effect, two animated layers per stall)

| Layer | What | Animates | Runs |
|---|---|---|---|
| 1 `ms-pick-glow` | warm lamplight pool on the ground behind the stall (radial gradient, drawn once) | `opacity` only | fades in on enter, then a slow 6 s breath (0.40 to 0.62), 5 times (30 s), then rests at the static value |
| 2 `ms-pick-seal` | teal pennant banner with a star and the printed words "Top pick", hung on a cord at the top left of the picture | `transform` + `opacity` | drops in with a small pendulum bounce (0.75 s), once; replayed on hover/focus |

Why these choices
- Sparks and an awning shimmer were left out: they would be a third and fourth layer, and the awning is baked into the raster picture (no separate layer to sweep). If Faiz wants a shimmer later, swap it for the glow breathing, never add it.
- Teal banner, cream lamplight, not gold. Gold is already the "In range" price tone (flag, plate edge). A gold glow would read as "in your price range". The banner is teal (Stitch decoration colour, never a status) with a printed word and a star, so colour is never the only signal.
- Wording: game strings say "Top pick". Plain view and normal mode keep the exact stored word ("Strong Buy"); this change does not touch them.
- Truth rules (juice never changes a fact):
  - Only `verdict_rating === "Strong Buy"` shows the mark. Nothing else is promoted, and nothing is demoted.
  - Motion only for a fresh read (analysed within 180 days). An older Strong Buy still gets the static banner, titled "older read", and no glow, no animation. The freshness pip is unchanged.
  - Fog-lane stalls (no price) get the static banner only: no glow, no motion. The mist overlay stays unchanged; the banner sits above it (z-index 2) so it stays readable.
  - The animation never fades or hides the plate, flag, pips or name. First 3 eligible stalls in street order animate; any others show the static glow + banner.
- Budget: at most 3 stalls x 2 layers = 6 animated layers on screen, only while on screen. After the drop, only 1 layer per stall keeps moving (glow). Loop is finite (30 s), period 6 s (>= 4 s), peak opacity change 0.22 over 3 s: nothing flashes (far below 3 per second).
- Reduced motion: no attribute is ever armed, all animation is behind `prefers-reduced-motion: no-preference`, plus an explicit `reduce` kill switch. Result is the static frame: glow at 0.40 + printed banner.
- Skip: nothing blocks input; the stall is a normal link throughout. The loop ends by itself. Any click leaves the page.
- No sound.

## 1. Pure helper: `frontend/src/lib/pickMotion.ts`

```ts
import { analysisAgeDays } from "./marketplace";
import { districtOf } from "./marketStreet";
import type { WatchlistRow } from "./types";

/** At most this many stalls animate at once (first in street order). */
export const PICK_MOTION_CAP = 3;
/** A top rating older than this is still shown, but static (the read may be stale). */
export const PICK_FRESH_DAYS = 180;

export type PickKind = "fresh" | "old" | null;

/** Pure: does this row carry the stored top rating, and is the read recent? Unknown date counts as old, never fresh. */
export function topPickKind(row: WatchlistRow, now: number = Date.now()): PickKind {
  if (row.verdict_rating !== "Strong Buy") return null;
  const age = analysisAgeDays(null, row.analyzed_at, now);
  return age !== null && age <= PICK_FRESH_DAYS ? "fresh" : "old";
}

/**
 * Which stalls may animate. `rows` is already in street order (orderStreet). Fog-lane stalls and stale reads never
 * animate; the cap keeps the street calm and the layer count bounded.
 */
export function pickMotionIds(rows: readonly WatchlistRow[], now: number = Date.now(), cap: number = PICK_MOTION_CAP): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    if (out.size >= cap) break;
    if (districtOf(row) === "fog") continue;
    if (topPickKind(row, now) === "fresh") out.add(row.holding_id);
  }
  return out;
}
```

## 2. Shared in-view hook: `frontend/src/hooks/usePickMotion.ts`

One `IntersectionObserver` for the whole street. The hook writes `data-pick` / `data-off` straight onto the element, so scrolling causes zero React re-renders.

```ts
import { useCallback, useEffect, useRef } from "react";

type Cb = (visible: boolean) => void;
const subs = new Map<Element, Cb>();
let io: IntersectionObserver | null = null;

/** One shared observer (threshold 0.4). Returns an unsubscribe. No-op where IntersectionObserver is missing (jsdom, old browsers). */
export function observeInView(el: Element, cb: Cb): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  io ??= new IntersectionObserver(
    (entries) => entries.forEach((e) => subs.get(e.target)?.(e.isIntersecting)),
    { threshold: 0.4 },
  );
  subs.set(el, cb);
  io.observe(el);
  return () => {
    subs.delete(el);
    io?.unobserve(el);
    if (subs.size === 0) {
      io?.disconnect();
      io = null;
    }
  };
}

const reduced = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * data-pick: "armed" (waiting to be seen) -> "run" (flourish + slow loop). data-off: on screen = absent, off screen = present
 * (CSS pauses). Hover/focus replays, at most once per 1.5 s. Not live, or reduced motion: nothing is ever set (static frame).
 */
export function usePickMotion<T extends HTMLElement>(live: boolean) {
  const ref = useRef<T>(null);
  const last = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!live || !el || typeof IntersectionObserver === "undefined" || reduced()) return;
    el.dataset.pick = "armed";
    const stop = observeInView(el, (visible) => {
      if (!visible) {
        el.dataset.off = "";
        return;
      }
      delete el.dataset.off;
      if (el.dataset.pick === "armed") {
        el.dataset.pick = "run";
        last.current = performance.now();
      }
    });
    return () => {
      stop();
      delete el.dataset.pick;
      delete el.dataset.off;
    };
  }, [live]);

  const replay = useCallback(() => {
    const el = ref.current;
    if (!el || el.dataset.pick !== "run" || performance.now() - last.current < 1500) return;
    last.current = performance.now();
    delete el.dataset.pick;
    void el.offsetWidth; // restart the animations
    el.dataset.pick = "run";
  }, []);

  return { ref, replay };
}
```

## 3. TSX changes: `frontend/src/components/marketplace/MarketStreet.tsx`

Imports:
```tsx
import { useMemo } from "react"; // add to the existing react import
import { usePickMotion } from "../../hooks/usePickMotion";
import { pickMotionIds, topPickKind } from "../../lib/pickMotion";
```

Small star mark (cream, ink outline-free so it stays crisp at 12 px):
```tsx
function TopPickSeal({ older }: { older: boolean }) {
  return (
    <span className="ms-pick-seal" title={older ? "Top pick, older read" : "Top pick"}>
      <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden>
        <path d="M10 1.5l2.5 5.6 6 .6-4.5 4 1.3 5.9L10 14.6 4.7 17.6 6 11.7 1.5 7.7l6-.6z" fill="currentColor" />
      </svg>
      Top pick
    </span>
  );
}
```

Inside `StreetStall` (new prop `picks: ReadonlySet<string>`):
```tsx
const kind = topPickKind(row);
const { ref, replay } = usePickMotion<HTMLAnchorElement>(!fog && picks.has(row.holding_id));
// ...
<Link
  ref={ref}
  onPointerEnter={replay}
  onFocus={replay}
  to={storePath(row.holding_id)}
  className={`ms-stall${fog ? " is-fog" : ""}`}
  aria-label={kind ? `${stallLabel(row)}, top pick` : stallLabel(row)}
  title={`${front.tag} · ${priceLine(row)}`}
  style={{ "--stall-tone": paint.a } as CSSProperties}
>
  <span className="ms-art" aria-hidden>
    {kind === "fresh" && !fog && <span className="ms-pick-glow" />}
    <ObjectArtImage /* unchanged */ />
    <Flag tone={front.tone} shape={flag.shape} />
    {kind && <TopPickSeal older={kind === "old"} />}
  </span>
  {/* plate unchanged */}
</Link>
```

Plumbing: in `MarketStreet`, `const picks = useMemo(() => pickMotionIds(rows), [rows]);`, pass `picks={picks}` to `LaneRowView`, and on to `StreetStall`.

## 4. CSS: append to `frontend/src/components/marketplace/street.css` (before the print rule)

Colours are the existing street palette (cream `#f8ecd0` already used on the boards, ink `--ms-ink`) plus the Stitch teal pair from the style bible (`#075960`, `#0b6a73`; cream on teal is about 6.4:1 or better). Consolidate those two into tokens when the kit is touched.

```css
/* Top pick (stored analyst rating, fresh read). Static frame first: lamp glow + printed banner. Motion is layered on below. */
.ms-pick-glow {
  position: absolute;
  z-index: -1; /* behind the contact shadow and the picture; .ms-cell is the stacking context */
  left: -14%;
  right: -14%;
  bottom: -0.4rem;
  height: 78%;
  background: radial-gradient(ellipse at 50% 82%, rgb(255 236 190 / 0.85), rgb(255 222 150 / 0.35) 45%, transparent 70%);
  opacity: 0.4;
  pointer-events: none;
}
.ms-pick-seal {
  position: absolute;
  z-index: 2; /* above the fog mist, so the printed word stays readable */
  top: 0.55rem;
  left: 4%;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem 0.15rem 0.35rem;
  border: 2px solid var(--ms-ink);
  border-radius: 999px;
  background: linear-gradient(180deg, #0b6a73, #075960);
  box-shadow: 0 2px 0 var(--ms-ink);
  color: #f8ecd0;
  font-family: "Marcellus", "Palatino Linotype", Palatino, Georgia, serif;
  font-size: 0.75rem;
  line-height: 1.2;
  white-space: nowrap;
  transform-origin: 50% -0.5rem; /* swings from its cord */
  pointer-events: none;
}
.ms-pick-seal::before { /* the cord */
  content: "";
  position: absolute;
  top: -0.55rem;
  left: 50%;
  width: 2px;
  height: 0.55rem;
  background: var(--ms-ink);
}

@keyframes ms-pick-drop {
  0%   { opacity: 0; transform: translateY(-1.5rem) rotate(-8deg); }
  45%  { opacity: 1; transform: translateY(0.3rem) rotate(4deg); }
  65%  { transform: translateY(-0.15rem) rotate(-2deg); }
  82%  { transform: translateY(0.06rem) rotate(0.8deg); }
  100% { opacity: 1; transform: none; }
}
@keyframes ms-pick-glow-in { from { opacity: 0; } to { opacity: 0.4; } }
@keyframes ms-pick-breathe { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.62; } }

@media (prefers-reduced-motion: no-preference) {
  /* Armed = waiting to scroll into view. The hook only arms when JS, IntersectionObserver and motion are all available. */
  .ms-stall[data-pick="armed"] .ms-pick-seal { opacity: 0; transform: translateY(-1.5rem); }
  .ms-stall[data-pick="armed"] .ms-pick-glow { opacity: 0; }
  .ms-stall[data-pick="run"] .ms-pick-seal { animation: ms-pick-drop 0.75s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
  .ms-stall[data-pick="run"] .ms-pick-glow {
    animation: ms-pick-glow-in 0.8s ease-out both, ms-pick-breathe 6s ease-in-out 0.8s 5; /* finite: 5 x 6 s, then rests at 0.4 */
  }
  .ms-stall[data-off] .ms-pick-seal,
  .ms-stall[data-off] .ms-pick-glow { animation-play-state: paused; } /* off screen: frozen, costs nothing */
}
@media (prefers-reduced-motion: reduce) {
  .ms-pick-seal, .ms-pick-glow { animation: none !important; }
}
@media (max-width: 640px) {
  .ms-pick-seal { top: 0.4rem; padding: 0.1rem 0.4rem 0.1rem 0.3rem; }
}
```

Fit notes
- Picture ~12.5 rem tall (9.4 rem on phones): banner is about 5 rem wide at the top left, the flag stays top right (`right: 14%`), so they do not collide down to the narrowest plot.
- Plate: not touched. Its tone strip (`--stall-tone`) still carries the price tone; the glow is cream and sits behind the picture, and the plate is opaque above it (`z-index: 1`).
- `.ms-stall:hover` lift (`translateY(-3px)`) moves the whole stall, banner and glow with it. No conflict, they are children.
- Fog: `.is-fog .ms-stall-img` filter and the `::after` mist are unchanged. No glow in fog (not rendered), banner only.
- Armed state hides the banner until the stall is 40% on screen. A full-page screenshot taken without scrolling will not show banners on stalls below the fold; playtest-qa must scroll. Plain view always lists the rating.

## 5. Vitest: `frontend/src/lib/pickMotion.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { PICK_MOTION_CAP, pickMotionIds, topPickKind } from "./pickMotion";
import type { WatchlistRow } from "./types";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function row(id: string, over: Partial<WatchlistRow> = {}): WatchlistRow {
  return { holding_id: id, status: "buy_zone", verdict_rating: "Strong Buy", analyzed_at: daysAgo(10), ...over } as WatchlistRow;
}

describe("topPickKind", () => {
  it("is null unless the stored rating is the top one", () => {
    expect(topPickKind(row("a", { verdict_rating: "Buy" }), NOW)).toBeNull();
    expect(topPickKind(row("a", { verdict_rating: null }), NOW)).toBeNull();
  });
  it("is fresh within 180 days, old after, and old when the date is unknown", () => {
    expect(topPickKind(row("a"), NOW)).toBe("fresh");
    expect(topPickKind(row("a", { analyzed_at: daysAgo(181) }), NOW)).toBe("old");
    expect(topPickKind(row("a", { analyzed_at: null }), NOW)).toBe("old");
  });
});

describe("pickMotionIds", () => {
  it("animates only the first 3 fresh top picks, in street order", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) => row(id));
    expect([...pickMotionIds(rows, NOW)]).toEqual(["a", "b", "c"]);
    expect(pickMotionIds(rows, NOW).size).toBe(PICK_MOTION_CAP);
  });
  it("skips fog-lane stalls, stale reads and other ratings, without spending the cap on them", () => {
    const rows = [
      row("fog", { status: "no_target" }),
      row("old", { analyzed_at: daysAgo(400) }),
      row("buy", { verdict_rating: "Buy" }),
      row("x"),
    ];
    expect([...pickMotionIds(rows, NOW)]).toEqual(["x"]);
  });
  it("is empty for an empty street", () => {
    expect(pickMotionIds([], NOW).size).toBe(0);
  });
});
```

Optional hook test (jsdom has no IntersectionObserver, so assert the safe default): render a component using `usePickMotion(true)` with `matchMedia` stubbed to `matches: true` for reduced motion, and expect `el.dataset.pick` to be `undefined`. A second case stubs `IntersectionObserver` with a class that captures the callback, fires `(true)`, and expects `data-pick="run"`; firing `(false)` expects `data-off` present.

## 6. Checklist for the PR that applies this

- Identity score: Market Street stays 3 (one real fact, the stored rating, encoded as a printed banner). Visual verb + scene line is at the top. Game voice: one two-word string, "Top pick".
- Kit: the banner is used on one page only, so it stays in `components/marketplace/`. Promote it to `fortress/kit/` (name `PickBanner`, screenshot in the kit index) when a second page (store page header, Fortress tower) wants it, and fold `#0b6a73`/`#075960` into `lib/gameTokens.ts` then.
- Screenshots to capture: desktop 1440x900 and phone 390x844; reduced motion on and off; one fresh top pick, one older top pick, one in the fog lane, one top pick that is also "In range" (to confirm the cream glow and teal banner do not read as the gold price tone).

## 7. Before/after performance note (to fill in; playtest-qa, phone profile, 4x CPU throttle, 5 s sample, demo data, street scrolled so 3 top picks are visible)

| Measure | Before | After | Notes |
|---|---|---|---|
| Frames over 16.7 ms | not measured | not measured | |
| Long tasks (> 50 ms) | not measured | not measured | |
| Animated compositor layers | 0 | expected 6 during the 0.8 s entry, then 3 (glow only), 0 off screen or after 30 s | verify in Layers panel |
| Main-thread work from the effect | 0 | expected none: no scroll or JS handlers, one IntersectionObserver callback per threshold crossing | verify |
| Added JS / CSS | 0 | about 1.3 KB source (hook + helper), about 1.6 KB CSS before gzip | verify in build output |
| Properties animated | none | `opacity`, `transform` only (no filter, blur, box-shadow, layout) | grep keyframes |
| Reduced motion | n/a | no attribute set, no animation, static glow + banner | verify with emulation |

The figures marked "expected" are design targets from reading the code, not measurements. Do not quote them as results.
