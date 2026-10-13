"""v3 siege-simulator settings (game mode C1, 2026-10-13).

What changed from v2, and why: nothing about how a holding is measured. Slider,
coverage floor, benchmark, window and sample-size floors are v2's, unchanged.

The one change is in what the result says. In v2 the headline read "The walls
hold" or "costs the modelled book X%" while the holdings that could not be
modelled were treated as unharmed and mentioned only further down the page.
Finding 3 of the game-mode team review (2026-10-09): at 50% coverage the page
could say the walls hold about a book it had only half measured. v3 puts the
unmodelled share (as a share of portfolio value, with the count of holdings)
into the result and the headline, next to the number it qualifies.

It does not change the level thresholds and does not guess what the unmodelled
part would do: unknown stays unknown.

CLAUDE.md Rule 3: once these numbers have been shown for real, a change is a
new `siege_scenarios_v4.py`, not an edit of this file.
"""
from __future__ import annotations

from dataclasses import replace

from app.domain.game_mapping.siege_scenarios_v2 import SIEGE_SCENARIOS_V2

SIEGE_SCENARIOS_V3 = replace(SIEGE_SCENARIOS_V2, version="v3", name_unmodelled_in_headline=True)
