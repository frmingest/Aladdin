# Game sprint checklist

Status: standing gate, proposed 2026-10-09. Standard: [.claude/standards/game-visual-identity.md](../.claude/standards/game-visual-identity.md). Every game sprint plan answers section A before work starts; every sprint review (and `/game-review`) answers section B before the sprint is called done. A plan or review that skips a line is incomplete. Status claims follow CLAUDE.md "Status honesty" (written, not yet deployed, unless checked).

## A. Sprint plan must answer
1. **Pages touched.** List every game page, tab or dialog the sprint changes or adds. Mechanics-only items still name the page they land on.
2. **Identity score before -> after (0-3).** One row per page: `page | before | after | why`. Any touched page below 2 after the sprint needs a stated reason and a dated follow-up. Pages not touched but scoring 0-1 are listed as identity debt.
3. **Visual wins included.** At least one item per sprint whose point is the look (scene header, bespoke illustration, kit piece, signature object) and that deletes words. Name it, its visual verb + scene, and the real fact it encodes. If none, say why and what slips.
4. **Every item has a visual verb + scene line** (motif, page, mapping, unknown look, words deleted).
5. **Words.** Word budget per touched page (before, target). Visuals replace words.
6. **Kit.** Which kit pieces are reused, which are added (owner: game-feel-engineer).
7. **Cut line.** One thing to cut if the sprint runs long; it is never the Plain view, the unknown state or the screenshots.
8. **Rules.** Which Fortress rules each item touches and how truth / colour-blind / reduced-motion / performance are kept.

## B. Sprint review must answer
1. **Pages touched** (as built, from the diff, not from the plan).
2. **Identity table** scored by `game-ux-designer`: `page | before | after | kit pieces used | fact encoded visually | Plain view | words before/after`.
3. **Visual wins delivered** vs planned, one line each.
4. **Look-and-judge list for Faiz.** For each touched page: desktop and phone screenshots in game mode, Plain view, and normal mode side by side (from `playtest-qa`), plus one question ("Does this read as the game, and is the weak tower still weak?"). Paths listed; pages that could not be rendered are named.
5. **Checks.** tsc, lint, test, build; word budgets; colour-blind pass; reduced-motion pass; phone frame-rate / long-task note; what was NOT seen.
6. **Status.** Merged / deployed / seen on real data, each stated separately.
7. **Direction memory.** Did the look change? If yes, update section 4 of the standard in the same PR and mirror per "Documentation sync".
8. **Identity debt left**, ranked, as input to the next `/game-ideas`.
