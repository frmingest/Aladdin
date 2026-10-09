# Game-mode UI standards
1. Truth over flattery: art/animation may never make a weak or unknown fact look good. Unknown renders as unknown (fog, grey, "?"), never as a default-good state.
2. Status is never colour alone (red/green/amber is common colour blindness territory): pair with shape, icon, pattern or text.
3. `prefers-reduced-motion` => no looping or large motion; entrances instant. Every ritual/animation skippable by any key; a "Plain view" always available.
4. Keyboard operable, visible focus, 4.5:1 text contrast, touch targets 44px.
5. Performance budget (phone, 4x CPU throttle): no animated SVG filters; <= a small fixed number of concurrent looping animations; no long task > 50 ms during idle scene; lazy-load heavy chunks (e.g. pdf.js).
6. Sound is opt-in, volume-capped, with a mute that persists.
7. No buy/sell wording, no points, streaks, timers or rewards for trading or return visits. Game off or demo mode on => behaviour as documented.
8. Pure mapping functions in `src/lib/` with unit tests; components render only.
