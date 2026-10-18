---
name: game-ux-onboarding-accessibility
description: UX review method for dense game-style dashboards: first-run onboarding, information hierarchy, noise, colour-blind-safe status, reduced motion, keyboard and mobile. Use on any game-mode UI change.
---
# Review checklist (in order)
0. **Click count (do this first, in a real browser).** Name the page's main task (get an answer, set a mark, open a record), perform it from a cold load, and count the taps. Target: 2 or fewer for the common case. Blockers: the same control twice on one screen; a step that only unlocks the next step ("Ask" after you already chose everything); an empty form when a sensible default exists; a button that only scrolls or nags. Selecting should act. Report the count as "N taps, was M".
1. First 10 seconds: can a new player say what the scene is, what is most important now, and what to click? If not, propose a skippable, replayable 3-step guide (point at real elements, no modal wall).
2. Hierarchy: one primary focus per screen; secondary info on demand (hover/tap/detail); repeat nothing (see noise audit).
3. Legibility at a glance: shape + position + size encode importance; colour only reinforces.
4. States: loading, empty, unknown, stale, error, demo. Each has a designed look.
5. Accessibility: colour-blind simulation pass, reduced motion, keyboard path through every ritual, focus order, screen-reader labels on interactive art, contrast, touch targets.
6. Mobile: 390px width, thumb reach, no hover-only information.
7. Copy: plain words, no jargon without the glossary tooltip, no advice wording.
Output blocker/should/nit with file:line and the concrete change.
