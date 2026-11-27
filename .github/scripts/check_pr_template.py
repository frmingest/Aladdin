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
    "In plain words",
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
# Plain words (CLAUDE.md "Plain words", issue #541, decided 2026-11-27): Faiz reads these, so they stay short.
# Limits come from a review of all 398 PRs: median body 239 words, 774 since the template, titles over 72 in 131.
TITLE_MAX_CHARS = 72
PLAIN_MAX_WORDS = 60
PLAIN_MIN_WORDS = 8
BODY_MAX_WORDS = 400  # everything except the reviewer section; long detail goes to a linked docs/ file
RESULT_MAX_WORDS = 25  # one reviewer-table "Result / link" cell
GAME_ROLES = ("playtest-qa", "game-ux-designer", "game-designer", "game-feel-engineer")
RAN = {"yes", "ran", "run"}
NOT_RAN = {"skipped", "no", "n/a", "not run"}
GAME_UI_PATH = re.compile(r"^frontend/src/.*(fortress|game|Game)")
BACKEND_PATH = re.compile(r"^backend/")
# Added with issue #444 (2026-11-17): the reviewers a change must not skip, by what it touches.
RELEASE_PATH = re.compile(r"^(\.github/(workflows|scripts)/|\.pre-commit-config\.yaml|\.claude/(hooks/|settings)|backend/Dockerfile|frontend/Dockerfile|backend/alembic/|docker/)")
LLM_PATH = re.compile(r"^backend/(prompts/|app/schemas/analysis|app/domain/analysis_schema|app/services/analysis/|app/services/[a-z_]+/evidence\.py)")
VALUATION_PATH = re.compile(r"^(backend/app/(api/valuation|schemas/valuation|services/(valuation/|metrics\.py|performance/|risk/|market_data/fx\.py)|domain/(valuation_assumptions|risk_bands|regime_adjustments|analysis_assumptions|financial_metrics))|docs/valuation/)")
COMPLIANCE_PATH = re.compile(r"^(backend/(requirements(-dev)?\.txt|pyproject\.toml)|frontend/package(-lock)?\.json|backend/app/providers/|backend/app/services/llm_|backend/app/models/llm_)")


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


def _words(text: str) -> int:
    return len(re.findall(r"\S+", text))


def check_plain_words(body: str, secs: dict[str, str], title: str | None = None) -> list[str]:
    """Short, human wording (CLAUDE.md "Plain words"). Counts words, not understanding: it cannot judge jargon,
    so the opening section may not hold code, a file path or an issue number, which is where jargon starts."""
    errors: list[str] = []
    if title is not None and len(title.strip()) > TITLE_MAX_CHARS:
        errors.append(f"the title is {len(title.strip())} characters; keep it to {TITLE_MAX_CHARS} or fewer, in plain words")
    plain = re.sub(r"<!--.*?-->", "", secs.get("In plain words", ""), flags=re.DOTALL).strip()
    n = _words(plain)
    if n < PLAIN_MIN_WORDS:
        errors.append("'In plain words' is empty or too thin: say what changes for Faiz in two or three short sentences")
    elif n > PLAIN_MAX_WORDS:
        errors.append(f"'In plain words' is {n} words; the limit is {PLAIN_MAX_WORDS}. Cut it, the detail goes under 'What changed and why'")
    if re.search(r"`|#\d+|\b[\w.-]+/[\w.-]+\.\w{1,5}\b", plain):
        errors.append("'In plain words' holds code, a file path or an issue number; say it the way you would to a friend, put those below")
    reviewer = secs.get("Who reviewed it (agents and skills)", "")
    total = _words(body) - _words(reviewer) - _words("## Who reviewed it (agents and skills)")
    if total > BODY_MAX_WORDS:
        errors.append(f"the body is {total} words outside the reviewer table; the limit is {BODY_MAX_WORDS}. Move detail to a docs/ file and link it")
    for line in reviewer.splitlines():
        if line.lstrip().startswith("|") and "`" in line:
            cells = _cells(line)
            if len(cells) >= 4 and _words(cells[2]) > RESULT_MAX_WORDS:
                role = re.search(r"`([a-z\-]+)`", cells[0])
                errors.append(f"`{role.group(1) if role else cells[0][:20]}`: the result is {_words(cells[2])} words; the limit is {RESULT_MAX_WORDS}. Link the report instead")
    return errors


def check(body: str, changed_files: list[str] | None = None, title: str | None = None) -> list[str]:
    """Problems with the body (and the title, when given); an empty list means it passes."""
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
    errors += check_plain_words(body, secs, title)
    return errors


def docs_only(files: list[str]) -> bool:
    """True when every changed file is a markdown file under docs/ (or the root README). An empty list is not docs-only:
    if the file list is missing the check runs in full. Added with issue #444 (decided by Faiz 2026-11-17): the
    `no-issue` label used to skip every must-run reviewer, including for prompt, valuation and CI changes."""
    return bool(files) and all((f.startswith("docs/") and f.endswith(".md")) or f == "README.md" for f in files)


def main() -> int:
    body = os.environ.get("PR_BODY", "")
    labels = os.environ.get("PR_LABELS", "")
    files = [f for f in os.environ.get("CHANGED_FILES", "").splitlines() if f.strip()]
    if "no-issue" in labels.split(",") and docs_only(files):
        print("no-issue label present and only docs changed (typo or link fix): template check skipped.")
        return 0
    if "no-issue" in labels.split(","):
        print("no-issue label ignored: it only skips this check when every changed file is a docs or README markdown file.")
    errors = check(body, files, os.environ.get("PR_TITLE"))
    for e in errors:
        print(f"::error::{e}")
    if errors:
        print(f"{len(errors)} problem(s). Fill in .github/pull_request_template.md; rows you did not run say 'skipped' with a reason.")
        return 1
    print("PR body follows the template.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
