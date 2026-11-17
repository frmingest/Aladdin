"""The mypy ratchet (issue #389): a new finding fails, a moved or fixed one does not."""
import importlib.util
from collections import Counter
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "mypy_ratchet", Path(__file__).resolve().parents[2] / "scripts" / "mypy_ratchet.py"
)
ratchet = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(ratchet)

OUT = (
    'app/a.py:10: error: Incompatible return value type (got "int", expected "str")  [return-value]\n'
    "app/a.py:11: note: some note that must be ignored\n"
    'app\\b.py:3:7: error: Item "None" of "X | None" has no attribute "y"  [union-attr]\n'
    "app/c.py:1: error: Cannot find implementation or library stub for module named \"z\"\n"
)


def test_parse_reads_errors_only_and_normalises_paths():
    found = ratchet.parse(OUT)
    assert [(f, c) for f, c, _, _ in found] == [("app/a.py", "return-value"), ("app/b.py", "union-attr"), ("app/c.py", "none")]
    assert found[1][3] == 3


def test_same_findings_on_other_lines_are_not_new():
    base = Counter(ratchet.key(f, c, m) for f, c, m, _ in ratchet.parse(OUT))
    moved = OUT.replace("a.py:10", "a.py:99")
    new, fixed = ratchet.compare(ratchet.parse(moved), base)
    assert new == [] and fixed == 0


def test_an_extra_copy_of_a_finding_is_new():
    base = Counter(ratchet.key(f, c, m) for f, c, m, _ in ratchet.parse(OUT))
    doubled = OUT + OUT.splitlines()[0] + "\n"
    new, _ = ratchet.compare(ratchet.parse(doubled), base)
    assert len(new) == 1 and new[0][0] == "app/a.py"


def test_a_brand_new_finding_is_new_and_a_removed_one_counts_as_fixed():
    base = Counter(ratchet.key(f, c, m) for f, c, m, _ in ratchet.parse(OUT))
    changed = OUT.splitlines()[0] + "\napp/d.py:5: error: Name \"q\" is not defined  [name-defined]\n"
    new, fixed = ratchet.compare(ratchet.parse(changed), base)
    assert [n[0] for n in new] == ["app/d.py"]
    assert fixed == 2


def test_committed_baseline_is_well_formed():
    base = ratchet.read_baseline()  # empty since #455 (zero findings); any line a later change adds must still parse
    assert all(k.count("::") >= 2 for k in base)
