"""The PR template guardrail (2026-11-15, issue #428): the shared checker, and the Claude Code hook that
refuses to create a PR without the template. Born from PR #427, opened by hand without either."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("check_pr_template", ROOT / ".github" / "scripts" / "check_pr_template.py")
C = importlib.util.module_from_spec(SPEC)
sys.modules["check_pr_template"] = C
SPEC.loader.exec_module(C)

HOOK = ROOT / ".claude" / "hooks" / "require_pr_template.py"


def good_body(rows: dict[str, tuple[str, str, str]] | None = None) -> str:
    rows = rows or {}
    default = {
        "rules-auditor": ("yes", "pass, no violations", ""),
        "docs-sync-checker": ("yes", "findings fixed", ""),
        "playtest-qa": ("skipped", "", "no UI change"),
        "game-ux-designer": ("skipped", "", "no UI change"),
        "game-designer": ("skipped", "", "no new game page"),
        "game-feel-engineer": ("skipped", "", "no UI change"),
        "qa-testlead": ("skipped", "", "not run"),
        "compliance-officer": ("skipped", "", "no new vendor or data"),
        "release-manager": ("skipped", "", "no CI or deploy files changed"),
        "llm-quality-guard": ("skipped", "", "no prompt or schema change"),
        "valuation-reviewer": ("skipped", "", "no valuation maths changed"),
        "board-steward": ("skipped", "", "issue and milestone set by hand"),
    }
    default.update(rows)
    table = "\n".join(f"| `{r}` (what it checks) | {a} | {b} | {c} |" for r, (a, b, c) in default.items())
    return f"""## What changed and why

Measures each holding's rate and krone sensitivity from stored history so the Printer can show more amounts.

## How it was verified

Checks run (tick what ran; for anything unticked say why):
- [x] Backend: ruff, pytest (`MACRO_DATA_PROVIDER=none`): 2119 passed
- [ ] Frontend: tsc, lint, test, build. Not run: no frontend files changed.

Seen in a browser? Not seen, backend only.

## Who reviewed it (agents and skills)

| Role | Ran? | Result / link | If skipped, why |
|---|---|---|---|
{table}

Implemented by: main session

## After deploy (Faiz)

Written, not yet deployed. Check /game/printer on the real portfolio.

Closes #426
"""


def all_ran_body() -> str:
    """A body with every reviewer marked as run, so a hook test passes whatever files the checked-out branch changed."""
    roles = ("rules-auditor", "docs-sync-checker", "playtest-qa", "game-ux-designer", "game-designer", "game-feel-engineer",
             "qa-testlead", "compliance-officer", "release-manager", "llm-quality-guard", "valuation-reviewer", "board-steward")
    return good_body({r: ("yes", "pass, nothing found", "") for r in roles})


# What PR #427 was first opened with: a free-form body, no template.
HAND_WRITTEN = (
    "## What and why\nFaiz decided on #374 to measure sensitivities first.\n\n## Verified\n`ruff check .` clean; "
    "`pytest -q`: 2117 passed.\n\n## After deploy (Faiz)\nOpen the endpoint.\n\nCloses #426."
)


def test_a_filled_in_template_passes():
    assert C.check(good_body(), ["backend/app/x.py", "docs/game/y.md"]) == []


def test_the_body_pr_427_was_first_opened_with_is_refused():
    errors = C.check(HAND_WRITTEN, ["backend/app/x.py"])
    assert any("How it was verified" in e for e in errors) and any("Who reviewed it" in e for e in errors)


def test_an_empty_body_is_refused():
    assert C.check("", []) and C.check(None, [])  # type: ignore[arg-type]


def test_a_left_over_placeholder_is_refused():
    assert any("placeholder" in e for e in C.check(good_body() + "\n<!-- which checks, and why -->", []))


def test_every_reviewer_row_must_be_answered():
    body = good_body({"playtest-qa": ("", "", "")})
    assert any("`playtest-qa`" in e and "Ran?" in e for e in C.check(body, []))


def test_a_skip_needs_a_reason_and_a_run_needs_a_result():
    assert any("skipped, but no reason" in e for e in C.check(good_body({"game-designer": ("skipped", "", "")}), []))
    assert any("no result or link" in e for e in C.check(good_body({"rules-auditor": ("yes", "", "")}), []))


def test_a_deleted_reviewer_row_is_refused():
    body = "\n".join(line for line in good_body().splitlines() if "`game-designer`" not in line)
    assert any("missing the row for `game-designer`" in e for e in C.check(body, []))


def test_a_backend_change_cannot_skip_the_rules_auditor_or_docs_check():
    body = good_body({"rules-auditor": ("skipped", "", "no time"), "docs-sync-checker": ("skipped", "", "no time")})
    errors = C.check(body, ["backend/app/services/game/printer.py"])
    assert any("`rules-auditor` must run" in e for e in errors) and any("`docs-sync-checker` must run" in e for e in errors)
    assert C.check(body, ["README.md"]) == []  # a typo elsewhere is not forced


def test_a_game_ui_change_needs_all_four_game_reviewers():
    errors = C.check(good_body(), ["frontend/src/components/fortress/Mint.tsx"])
    assert {e.split("`")[1] for e in errors if "must run" in e} == set(C.GAME_ROLES)


def test_the_five_gap_roles_are_required_rows_and_run_for_what_they_guard():
    for role in ("compliance-officer", "release-manager", "llm-quality-guard", "valuation-reviewer", "board-steward"):
        body = "\n".join(line for line in good_body().splitlines() if f"`{role}`" not in line)
        assert any(f"missing the row for `{role}`" in e for e in C.check(body, [])), role
    cases = {
        "release-manager": ".github/workflows/ci.yml",
        "llm-quality-guard": "backend/prompts/analysis/blind_v3.md",
        "valuation-reviewer": "backend/app/services/valuation/dcf.py",
        "compliance-officer": "backend/requirements.txt",
    }
    more = {
        "release-manager": ["frontend/Dockerfile", ".github/scripts/check_pr_template.py", ".claude/hooks/require_pr_template.py", ".pre-commit-config.yaml"],
        "llm-quality-guard": ["backend/app/schemas/analysis.py", "backend/app/services/instruments/evidence.py", "backend/app/services/analysis/blind_pass.py"],
        "valuation-reviewer": ["backend/app/services/metrics.py", "backend/app/services/risk/x.py", "docs/valuation/y.md", "backend/app/services/market_data/fx.py", "backend/app/api/valuation.py", "backend/app/schemas/valuation.py"],
        "compliance-officer": ["frontend/package-lock.json", "backend/pyproject.toml", "backend/app/models/llm_usage.py"],
    }
    for role, paths in more.items():
        for path in paths:
            assert any(f"`{role}` must run" in e for e in C.check(good_body(), [path])), (role, path)
    for role, path in cases.items():
        errors = C.check(good_body(), [path])
        assert any(f"`{role}` must run" in e for e in errors), (role, errors)
        ran = C.check(good_body({role: ("yes", "pass, nothing found", "")}), [path])
        assert not any(f"`{role}` must run" in e for e in ran), (role, ran)
    # a docs or typo change does not force them
    assert not any("must run" in e and any(r in e for r in cases) for e in C.check(good_body(), ["README.md"]))


def test_an_unticked_check_must_say_why():
    body = good_body().replace("Not run: no frontend files changed.", "")
    assert any("unticked check without a reason" in e for e in C.check(body, []))


def test_nothing_ticked_is_refused():
    assert any("tick at least one" in e for e in C.check(good_body().replace("[x]", "[ ]"), []))


def _hook(command: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(HOOK)], input=json.dumps({"tool_input": {"command": command}}),
        capture_output=True, text=True, cwd=ROOT, check=False,
    )


def test_hook_blocks_a_hand_written_pr_but_lets_the_template_through(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"title": "t", "head": "h", "base": "main", "body": HAND_WRITTEN}))
    good = tmp_path / "good.json"
    good.write_text(json.dumps({"title": "t", "head": "h", "base": "main", "body": all_ran_body()}))
    blocked = _hook(f"gh api repos/frmingest/Aladdin/pulls -X POST --input {bad}")
    assert blocked.returncode == 2 and "template" in blocked.stderr
    assert _hook(f"gh api repos/frmingest/Aladdin/pulls -X POST --input {good}").returncode == 0
    assert _hook(f"gh pr create --title t --body-file {tmp_path / 'missing.md'}").returncode == 2


def test_hook_blocks_editing_a_pr_body_to_something_not_the_template(tmp_path):
    bad = tmp_path / "patch.json"
    bad.write_text(json.dumps({"body": HAND_WRITTEN}))
    assert _hook(f"gh api repos/frmingest/Aladdin/pulls/427 -X PATCH --input {bad}").returncode == 2


def test_hook_ignores_everything_else():
    for cmd in (
        "git status",
        "gh api repos/frmingest/Aladdin/pulls/427 --jq .state",
        "gh api repos/frmingest/Aladdin/issues/413/comments -X POST -f body=hello",
        "gh api repos/frmingest/Aladdin/issues/427 -X PATCH -F milestone=39",
        "gh api repos/frmingest/Aladdin/pulls/427/ccr/review_threads",
        "gh api repos/frmingest/Aladdin/pulls/427 -X PATCH -f state=closed",
    ):
        assert _hook(cmd).returncode == 0, cmd


def test_hook_leaves_commands_that_only_mention_the_phrase_alone():
    for cmd in (
        'git commit -m "docs: gh pr create guardrail"',
        'echo "use gh pr create later"',
        "cd /tmp && grep -r 'gh pr create' .",
    ):
        assert _hook(cmd).returncode == 0, cmd


def test_hook_still_catches_the_real_command_behind_prefixes(tmp_path):
    bad = tmp_path / "bad.md"
    bad.write_text(HAND_WRITTEN)
    good = tmp_path / "good.md"
    good.write_text(all_ran_body())
    assert _hook(f"cd /tmp && GH_TOKEN=x gh pr create -t t --body-file {bad}").returncode == 2
    assert _hook(f"gh pr create -t t -F {bad}").returncode == 2
    assert _hook(f"gh pr create -t t -F {good}").returncode == 0
    assert _hook(f"gh pr create -t t -b body_file_is_{bad.name}").returncode == 2


def test_hook_catches_a_graphql_pull_request_and_survives_bad_input():
    assert _hook("gh api graphql -f query='mutation{createPullRequest(input:{title:\"x\"}){clientMutationId}}'").returncode == 2
    p = subprocess.run([sys.executable, str(HOOK)], input="not json", capture_output=True, text=True, cwd=ROOT, check=False)
    assert p.returncode == 0
