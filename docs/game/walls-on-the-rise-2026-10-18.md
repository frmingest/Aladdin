# Walls on the rise (2026-10-18)

Status: **written and tested, PR open (`feature/walls-on-the-rise`), not merged, not deployed.** Asked by Faiz: show on the Fortress page how far each investment has come toward the next tower upgrade.

## What "next upgrade" means here
A tower's **wall rung** (rotted, timber, brick, granite, basalt) is the only tier that can go up. Size is just the portfolio weight and is not an upgrade. The backend already decides the rung and, since A1 Knife-edge (`margins_v1`), already measures the distance from the stored ratio to the line above and the line below. This change only draws that distance; no rule, tier or backend file changed.

## What was added
- `frontend/src/lib/wallRise.ts` (pure): rung, next rung, how far across the current band the ratio has come (0 to 1), the backend's own sentence for the gap, the thin-interest-cover note, and whether the number is close to a weaker line. No band edge or no stored ratio gives fog (no fill), never 0.
- `kit/WallRiseGauge.tsx`: masons' courses fill with the wall's own stone toward a flag in the next rung's stone; five pips mark the rung by shape. Named in words for screen readers.
- `WallsOnTheRise.tsx`: a panel on the Fortress page (Scene and Plain views) listing the keeps, nearest rung first; pressing a row opens that tower's survey. The same gauge sits in the tower survey above "Distance to the next tier".

## Rule change to confirm
A1 said the distance to a stronger tier is "shown as plain text and never as progress" and "a distance, not a goal". Faiz asked for exactly this progress view, so it is now drawn. It keeps the guardrails: it measures the business's last stored statements, not anything the owner does; no points, streaks or "done" state; no buy/sell wording; the weaker line stays on the gauge ("a new report can move a wall either way"); unknown stays fog.

## Also today
- Siege Simulator: the "market falls by" slider now opens at 5% (`SIEGE_START_DROP` in `lib/siege.ts`), the slider's lowest stop; the backend's default (20%) is untouched, since `siege_scenarios_v1` is a versioned file.

## Identity (Fortress home)
Before 3 -> after 3 (a new panel with a bespoke gauge, shared kit stone colours, a real fact encoded as fill, Plain-view friendly). To judge in a browser: phone width, a tower with a thin interest cover, a financial (granite) wall, and a keep with no stored ratio.
