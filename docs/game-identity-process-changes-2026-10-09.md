# Changes proposed (copy into the repo at these paths)

| File | New/Edited | Reason |
|---|---|---|
| `.claude/standards/game-visual-identity.md` | New | Identity ladder 0-3, definition of done, anti-patterns, word-budget balance, direction memory (palette, motifs, files), kit contract. |
| `.claude/skills/game-visual-identity/SKILL.md` | New | Step method plus recipes for Council, Records, Circle, Siege, Chronicle, Marketplace/Store, Scrolls library, dialogs. |
| `.claude/agents/game-designer.md` | Edited | Every spec/idea needs a "Visual verb + scene" line and identity before/after. |
| `.claude/agents/game-ux-designer.md` | Edited | Adds a Game Identity lane (score 0-3, blocker below 2, identity debt list); noise rules kept. |
| `.claude/agents/game-feel-engineer.md` | Edited | Owns the shared page-scene kit and tokens; consolidates duplicate hex. |
| `.claude/agents/frontend-engineer.md` | Edited | Must use kit, pure mapping + render component, Plain view, no net word growth. |
| `.claude/agents/playtest-qa.md` | Edited | Screenshots of every game page, desktop+phone, game/Plain/normal side by side. |
| `.claude/commands/game-review.md` | Edited | Adds identity table and checklist section B; playtest before UX so screenshots exist. |
| `.claude/commands/game-ideas.md` | New | Idea gathering that outputs page + visual verb per idea, art-lens filtered, with a visual-win slot. |
| `docs/game-sprint-checklist.md` | New | Sections A (plan) and B (review) every game sprint must answer. |
| `CLAUDE.md.append.md` | New (append to CLAUDE.md) | 8-line "Game mode visual identity" rule. |

Also update `.claude/README.md` counts/lists (1 new skill, 1 new standard, 1 new command) when merging; not rewritten here.

## game-art-director: not added
Extending `game-ux-designer` with a second lane wins. A separate agent would read the same diff and screenshots, add a third verifier to a loop already capped at 2 rounds, and split one "is this page okay" verdict across two reports. The risk the new agent would address (nobody owns identity) is solved by ownership instead: game-designer specs it, game-feel-engineer owns the kit, game-ux-designer gates it, playtest-qa supplies evidence. Revisit if the Identity lane starts crowding out the noise lane, or if hand-painted assets (G39 sprite pilot) need a dedicated art-direction brief.

## Caveats
- Page scores in the standard's direction memory (Council/Circle/Records 0-1, etc.) are inferred from reading imports (those pages use `PageHeader` + `Card` only), not from screenshots; the first `/game-review` must re-score.
- Kit path `components/fortress/kit/`, `lib/pageScene.ts`, `lib/gameTokens.ts` are proposed names; none exist on main. `lib/wordBudget.ts` exists.
- Recipes are design proposals, not specs; each still needs its own game-designer spec with real-data mapping.
