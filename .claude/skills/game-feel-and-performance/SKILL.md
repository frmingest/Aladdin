---
name: game-feel-and-performance
description: Motion, juice, sound and frame-rate rules for SVG/CSS/React game visuals. Use when adding or changing animation, filters, parallax, particles or audio.
---
# Game feel without cost or lies
- Anticipation -> action -> settle: 150-400 ms for UI feedback; ambient loops slow and subtle; one hero moment per ritual.
- Compositor-friendly: animate `transform`/`opacity`; avoid animating `filter`, `box-shadow`, layout properties and SVG filter primitives. Pre-render noise textures instead of live turbulence.
- Budget: cap concurrent loops; pause when the tab is hidden (`visibilitychange`) or the element is off-screen (IntersectionObserver); `requestAnimationFrame` not timers.
- Reduced motion and skip: every effect has an instant path and a skip key.
- Audio: opt-in, muted by default, short, no sounds tied to trades or returns.
- Measure, do not guess: record a phone-profile performance trace before and after (playtest-qa) and state the numbers.
- Honesty: effects decorate facts, they never imply a verdict the data does not support.
