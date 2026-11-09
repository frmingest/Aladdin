# Text pass 4h: frame-change sentences and the remodelling line, 2026-11-09

Two small pieces from [remaining work](../sprints/remaining-work-2026-11-06.md), in one PR. Written and tested in a local workspace; not deployed and not seen in a browser.

## 1. Night Watch: "what changed between two looks" sentences
- The backend writes these in `services/game/frame_diff.py`. The Night Watch card shows them as lines and facts; the flat Fortress keeps the backend wording untouched.
- New `game3d/frameChangeWordsV1.ts`: `gameFrameChangeText` rewrites each known sentence on the 3D card only. Examples: "Kongsberg went from 4.0% to 5.5% of the realm." becomes "Kongsberg's share went from 4.0% to 5.5% of the fortress."; "The walls of Vend went from brick to granite." becomes "…from worn to solid."; "The moat of Bouvet is no longer surveyed." becomes "…slipped back into fog."; "The thesis of Vend moved from intact to review." becomes "The why of Vend went from standing to due a look."
- Names, percentages and states are copied from the sentence. An unknown sentence comes back untouched. A Night Watch tripwire line with a colon ("A tripwire fired on Vend: Net debt / EBITDA.") is not a frame change and is left alone.
- Wall names reuse the 3D condition ladder (basalt sound, granite solid, brick worn, timber patched, rotted failing); unknown is fog.
- `NightWatchCard` composes it after `gameWatchText` (4f). The backend is not edited.

## 2. Temperament card: the remodelling counts line
- The flat card says "2 added, 1 removed, 3 resized · about 12% of positions changed". New `game3d/remodelWordsV1.ts` (`gameRemodelCounts`) says "2 towers added, 1 removed, 3 resized · about 12% of the fortress changed" on the 3D Vault only. Counts are copied, nothing is computed; singular reads as singular; no share when the backend sends none.

## Tests
`frameChangeWordsV1.test.ts` (every backend sentence through the layer: banned words absent, names and numbers kept, unknown untouched) and `remodelWordsV1.test.ts`. The existing 4f and 4g tests still pass.

## Still open in text pass 4
Council (advisor) and standing labels, which need a backend wording version and a matching card change, and the Realm "Buy/Sell" call (Faiz).

## Checklist section A (3D text)
1. Pages touched: `/game3d` Vault panel (Night Watch card, Temperament card).
2. Identity before/after: unchanged.
3. Visual verb + scene: none new; same cards, words only.
4. Words: shorter, no "surveyed", "thesis", "of the realm", "positions". Numbers exact.
5. Rules kept: unknown is fog, flat page keeps its wording, new version files, no LLM arithmetic.
