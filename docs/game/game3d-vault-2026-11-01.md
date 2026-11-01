# 3D courtyard S16, PR 1 of 3: the Vault chest (2026-11-01)

**Status: written; `tsc`, `eslint`, the full test suite and the build pass on a clean case-sensitive checkout; seen in a headless browser (pictures below); not merged until you merge the PR, not deployed.** Branch `feature/game3d-fortress-panels`, off `main` at `3ab938c` (#246: S9, S13, S14 and the S15 Town are merged).

## What a sprint is for (plain words)

The flat Fortress has a Vault (the cash you typed in) and a Temperament meter (how calmly you have been acting). Until now the 3D world had no way to reach either. This step gives them one object in the world: a chest. Walk up, press E, and the same two cards open over the world.

## What you will see

- A **chest in front of the keep, just east of its door**, with a small name plate (**Vault**). Coin stacks stand on the lid: **six** for a deep vault, **four** stocked, **two** thin, **none** for empty.
- If you have never typed in your cash, the plate says **Vault ?** and the lid is bare. That is fog, not "empty": an empty vault and an unknown one never look the same.
- Stand near it: **"Press E to open the vault"**. E opens **The Vault** panel: the flat page's own Vault card (picture, "Deep vault", "250 000 kr in cash", the accounts line) and Temperament meter. **Update cash** is the one write, the same save as the flat page. E again, the × button or walking away closes it.
- "Open the flat page" in the panel goes to `/fortress`.
- On the sample fortress the cards show but cash cannot be saved (the card's own rule). If the fortress cannot be read, the chest is a plain closed chest and E does nothing (no panel without data).

Pictures: [chest and prompt](img/game3d-vault-chest-2026-11-01.png), [the panel](img/game3d-vault-panel-2026-11-01.png), [cash never entered](img/game3d-vault-fog-2026-11-01.png). They were taken with the hero spawned next to the chest (a throwaway build; the real spawn is untouched), on made-up sample data.

## How it works (short)

- `game3d/vaultPlan.ts` (+ 9 tests): where the chest stands, reach, `coinStacks(level)`, fixed stack slots, `vaultUnknown`. Pure. It never works out a level or an amount: the level is the backend's own `vault.level`.
- `game3d/Vault.tsx`: the chest, code-built with the same ink outline as the rest, so a failed model load cannot break it. No light, no animation.
- `game3d/VaultPanel.tsx` (+ 4 tests): hosts the flat `VaultCard` and `TemperamentCard` as they are. Every word and number is theirs, so the two pages cannot disagree.
- `game3d/vaultWordsV1.ts`: the five new strings (prompt, plate, panel title, close, flat-page link).
- `Scene.tsx`, `Game3DPage.tsx`: a near-watcher, state, the E key and the panel; after a cash save the fortress is read again so the chest follows.
- `towerDoor.ts`: the vault is one more thing a hero stepping out of a tower must not be put down inside.

## A mistake the screenshot caught (and the test that now prevents it)

My first spot for the chest, 11.5 east of the keep door (the mirror of the desk), sat on the tower pad at (15, -13.5). Standing at the chest put you inside that tower's door reach, so the prompt said "Press E to go into Beta" and E took me into Beta's library. My placement test only asked for 3.5 units from a pad, far less than a door's reach. The chest now stands at **x = 6** (9.5 from the nearest pad), and `vaultPlan.test.ts` asserts every pad is farther than the chest's reach plus the widest tower plus a door's reach (8.9), and that a tower exit never lands inside the chest.

## Game sprint checklist

Pages touched: `/game3d` only. Identity: stays 3 (visual verb *count*, scene a chest with coin stacks, fact: the vault level; Plain view is the flat Fortress). Words: reused from the flat cards; five new strings in a new version file; no buy or sell words. Colour: coins are warm yellow, no red or green. Reduced motion: nothing moves. Performance: one small code-built object, a handful of meshes. Taps from a cold load: walk up, E (1). Cut line: none hit. Kit reused: `Part`/`PAL`/`Inked`, the plate canvas of the booths, the desk's near-watcher pattern.

## Decisions I took (you may overrule)

- **Code-built chest, not the KayKit chest model.** The plan named a KayKit `chest`; none is packed yet, and packing one needs its own importer step. A model swap is a later, separate step and the coin stacks stay code.
- **Coin stacks follow the backend's level (6 / 4 / 2 / 0), not the cash amount.** Same ladder as the flat picture's fill; an amount stays in the card.
- **Temperament joins this panel** (the plan said so) rather than getting its own object.

## Not done / not checked

- Not seen on real data or on Railway; the pictures use sample data in a headless browser with software rendering (no fps number is meaningful).
- **Writing desk:** it is 4.6 from the tower pad at (-15, -13.5), the same distance that bit the chest. Checked by distance only; if E at the desk offers a tower, it needs the same move.
- Local `tsc` and `npm run build` on `E:\Aladdin` fail with the old Windows case-clash errors (`Desk`/`desk.ts` and so on); both pass on a case-sensitive copy, which is what CI runs. `npm run lint` is clean here.
- S16 still to do: Ravens and Night Watch, the Advisors shelf, Journal books (PR 2); weather, realm verdict and the lamp (PR 3).
