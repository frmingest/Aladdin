"""Check a pull request body against .github/pull_request_template.md.

One checker, two callers, so they cannot drift apart:
  * CI (.github/workflows/pr-template.yml) fails a PR whose body is not the filled-in template;
  * the Claude Code hook (.claude/hooks/require_pr_template.py) refuses to create or edit such a PR.

It checks structure and honesty, not prose: every template section is present, no placeholder is left,
the verification boxes say what ran, every reviewer row is answered, a skip gives a reason, and the
reviewers CLAUDE.md requires for the kind of change are not skipped. Standard library only.
Written after PR #427 (2026-11-15) was opened by hand without the template or the review agents.
"""
from __future__ import annotations

import os
import re
import sys

REQUIRED_SECTIONS = (
    "What changed and why",
    "How it was verified",
    "Who reviewed it (agents and skills)",
    "After deploy (Faiz)",
)
ROLES = (
    "rules-auditor",
    "docs-sync-checker",
    "playtest-qa",
    "game-ux-designer",
    "game-designer",
    "game-feel-engineer",
    "qa-testlead",
    "compliance-officer",
    "release-manager",
    "llm-quality-guard",
    "valuation-reviewer",
    "board-steward",
)
GAME_ROLES = ("playtest-qa", "game-ux-designer", "game-designer", "game-feel-engineer")
RAN = {"yes", "ran", "run"}
NOT_RAN = {"skipped", "no", "n/a", "not run"}
GAME_UI_PATH = re.compile(r"^frontend/src/.*(fortress|game|Game)")
BACKEND_PATH = re.compile(r"^backend/")
# Added with issue #444 (2026-11-17): the reviewers a change must not skip, by what it touches.
RELEASE_PATH = re.compile(r"^(\.github/workflows/|backend/Dockerfile|backend/alembic/|docker/)")
LLM_PATH = re.compile(r"^backend/(prompts/|app/domain/analysis_schema)")
VALUATION_PATH = re.compile(r"^backend/app/(services/valuation/|domain/(valuation_assumptions|risk_bands|regime_adjustments|financial_metrics))")
COMPLIANCE_PATH = re.compile(r"^(backend/requirements\.txt|frontend/package\.json|backend/app/providers/|backend/app/services/llm_)")


def _sections(body: str) -> dict[str, str]:
    out: dict[str, str] = {}
    name: str | None = None
    for line in body.splitlines():
        m = re.match(r"^##\s+(.*?)\s*$", line)
        if m:
            name = m.group(1)
            out[name] = ""
        elif name is not None:
            out[name] += line + "\n"
    return out


def _cells(row: str) -> list[str]:
    return [c.strip() for c in row.strip().strip("|").split("|")]


def check(body: str, changed_files: list[str] | None = None) -> list[str]:
    """Problems with the body; an empty list means it passes."""
    errors: list[str] = []
    body = body or ""
    files = changed_files or []
    secs = _sections(body)

    for name in REQUIRED_SECTIONS:
        if name not in secs:
            errors.append(f"missing the section '## {name}' (use .github/pull_request_template.md)")
    if errors:
        return errors

    if "<!--" in body:
        errors.append("an HTML comment placeholder from the template is still in the body; fill it in or delete it")

    if len(re.sub(r"\s+", " ", secs["What changed and why"]).strip()) < 40:
        errors.append("'What changed and why' is empty or too thin to review")
    if len(secs["After deploy (Faiz)"].replace("Closes #", "").strip()) < 10:
        errors.append("'After deploy (Faiz)' is empty; say what Faiz must do, or 'nothing, written not deployed' and why")

    verified = secs["How it was verified"]
    boxes = re.findall(r"^\s*-\s*\[([ xX])\]\s*(.*)$", verified, flags=re.MULTILINE)
    if not any(state.lower() == "x" for state, _ in boxes):
        errors.append("'How it was verified': tick at least one check that actually ran")
    for state, text in boxes:
        if state == " " and not re.search(r"not run|not applicable|no \w+ files changed|skipped|because|ci runs", text, re.IGNORECASE):
            errors.append(f"unticked check without a reason: '{text.strip()[:60]}' (say why it was not run)")
    m = re.search(r"Seen in a browser\?\s*(.*)", verified)
    if not m or len(m.group(1).strip()) < 3:
        errors.append("'Seen in a browser?' has no answer (real browser, headless only, or not seen)")

    rows: dict[str, list[str]] = {}
    for line in secs["Who reviewed it (agents and skills)"].splitlines():
        if line.lstrip().startswith("|") and "`" in line:
            cells = _cells(line)
            role = re.search(r"`([a-z\-]+)`", cells[0])
            if role and len(cells) >= 4:
                rows[role.group(1)] = cells
    for role in ROLES:
        if role not in rows:
            errors.append(f"reviewer table is missing the row for `{role}` (write 'skipped' and why; do not delete the row)")
            continue
        _, ran, result, why = rows[role][:4]
        state = ran.strip().lower()
        if state not in RAN | NOT_RAN:
            errors.append(f"`{role}`: 'Ran?' must be yes or skipped, got '{ran or 'empty'}'")
        elif state in RAN and len(result.strip()) < 3:
            errors.append(f"`{role}`: ran, but no result or link")
        elif state in NOT_RAN and len(why.strip()) < 3:
            errors.append(f"`{role}`: skipped, but no reason")

    def must_run(role: str, reason: str) -> None:
        row = rows.get(role)
        if row and row[1].strip().lower() not in RAN:
            errors.append(f"`{role}` must run for this change ({reason}); it is marked '{row[1].strip() or 'empty'}'")

    if any(BACKEND_PATH.match(f) for f in files):
        must_run("rules-auditor", "backend files changed, CLAUDE.md Pull requests step 3")
    if any(BACKEND_PATH.match(f) or f.startswith("docs/") for f in files):
        must_run("docs-sync-checker", "backend or docs changed, claims must be checked against git")
    if any(RELEASE_PATH.match(f) for f in files):
        must_run("release-manager", "CI, Docker or migration files changed")
    if any(LLM_PATH.match(f) for f in files):
        must_run("llm-quality-guard", "a prompt or analysis schema changed, CLAUDE.md Rules 3 and 5")
    if any(VALUATION_PATH.match(f) for f in files):
        must_run("valuation-reviewer", "valuation or risk maths changed, the numbers must be recomputed")
    if any(COMPLIANCE_PATH.match(f) for f in files):
        must_run("compliance-officer", "a dependency, data provider or LLM client changed, so what leaves the app may have changed")
    if any(GAME_UI_PATH.match(f) for f in files):
        for role in GAME_ROLES:
            must_run(role, "game UI files changed, the template requires all four game rows")

    if not re.search(r"Implemented by:\s*\S{3,}", body):
        errors.append("'Implemented by:' has no answer")
    return errors


def main() -> int:
    body = os.environ.get("PR_BODY", "")
    labels = os.environ.get("PR_LABELS", "")
    files = [f for f in os.environ.get("CHANGED_FILES", "").splitlines() if f.strip()]
    if "no-issue" in labels.split(","):
        print("no-issue label present (typo or link fix): template check skipped.")
        return 0
    errors = check(body, files)
    for e in errors:
        print(f"::error::{e}")
    if errors:
        print(f"{len(errors)} problem(s). Fill in .github/pull_request_template.md; rows you did not run say 'skipped' with a reason.")
        return 1
    print("PR body follows the template.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
