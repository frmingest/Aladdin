"""
Unit tests for app.services.analysis.prompts' versioned persona/synthesis
loading (architecture §11.1, §2.4) — specifically the ECON-006 fix (docs/
decisions/0014) that adds an explicit macro/FX engagement requirement to the
persona checklist without disturbing v1's already-shipped text.
"""

import pytest

from app.services.analysis.prompts import UnknownPromptVersionError, load_persona_prompt


def test_persona_v1_unchanged_and_has_no_macro_checklist_line():
    load_persona_prompt.cache_clear()
    v1 = load_persona_prompt("v1")

    assert "Macro and FX backdrop" not in v1


def test_persona_v2_adds_explicit_macro_engagement_requirement():
    load_persona_prompt.cache_clear()
    v2 = load_persona_prompt("v2")

    assert "Macro and FX backdrop" in v2
    assert "macro_snapshot" in v2


def test_persona_v2_keeps_every_v1_hard_rule():
    load_persona_prompt.cache_clear()
    v1 = load_persona_prompt("v1")
    v2 = load_persona_prompt("v2")

    v1_rules = [line for line in v1.splitlines() if line.strip().startswith(tuple(f"{n}. **" for n in range(1, 9)))]
    for rule in v1_rules:
        assert rule in v2, f"v2 dropped or altered a v1 hard rule: {rule!r}"


def test_unknown_persona_version_raises():
    load_persona_prompt.cache_clear()
    with pytest.raises(UnknownPromptVersionError):
        load_persona_prompt("v999_does_not_exist")
