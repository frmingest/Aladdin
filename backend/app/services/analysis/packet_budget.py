"""A hard size limit for the evidence packet (2026-10-02).

Why this exists: the packet used to grow with whatever the data held (every
research item, 15 announcements, every fund holding line ...). Equinor and
Aker BP reached ~34,000 tokens once the 8,192-token answer reserve was added,
which fits neither qwen3:14b (24,576 max) nor qwen3:8b (32,768 max), and both
failed. Fixing one holding by hand would only move the problem to the next
holding or the next data upload.

So the packet now has a *design-time ceiling*, enforced after it is built and
before any prompt is rendered:

* **Caps (always on).** Every category that can grow with data (research,
  announcements, document excerpts, macro indicators, fund holding lists) has
  a per-item cap and a per-category cap. More data can never mean a bigger
  packet than the caps allow.
* **A total budget.** ``packet_token_budget()`` derives it from the largest
  context the local setup can serve, minus the answer, the blind-pass JSON that
  the reconciliation pass re-reads, and prompt overhead, so *both* passes fit.
  If the capped packet is still over, categories shrink lowest-value-first
  (announcements, then macro/sector/company research, then excerpts ...)
  toward a floor. The numbers behind the valuation (financial history, DCF,
  multiples, fund facts) are protected: they are what the analysis stands on.
* **Visible.** What was kept, shortened or dropped is recorded on the packet
  (stored with the run) and as one line in the run's evidence notes. Nothing is
  cut silently.

Deterministic and pure: no LLM, no I/O, same input -> same output. Evidence IDs
are never renumbered, so a citation always points at the item it was written
for; a dropped item's ID simply no longer appears.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field, replace

from app.services.analysis.evidence_packet import EvidenceItem, EvidencePacket

log = logging.getLogger(__name__)

# Deliberately the same conservative figure the Ollama planner starts from
# (3 characters per token, +5%): a packet that fits this estimate fits for real.
CHARS_PER_TOKEN = 3.0
_SAFETY = 1.05
# Room reserved for the model's answer, and for the blind-pass JSON the
# reconciliation pass has to read back. Mirrors OllamaProvider's reserve.
OUTPUT_RESERVE_TOKENS = 8192
MIN_BUDGET_TOKENS = 2000
# Below this a partly-kept item is not worth keeping: drop it instead.
_MIN_PARTIAL_TOKENS = 150
TRIM_MARKER = " […trimmed to fit the local model]"


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / CHARS_PER_TOKEN * _SAFETY) if text else 0


def item_tokens(item: EvidenceItem) -> int:
    # +3: the blank line that joins items in the prompt.
    return estimate_tokens(item.render()) + 3


@dataclass(frozen=True)
class CategoryPolicy:
    # Ceiling for the whole category, always enforced. None = uncapped.
    cap_tokens: int | None
    # Ceiling for one item, always enforced.
    item_cap_tokens: int
    # Order of sacrifice under pressure (lowest first). None = protected: only
    # the always-on caps apply to it.
    trim_rank: int | None = None
    # Under pressure the category is not squeezed below this (until the last,
    # desperate pass in apply_token_budget).
    floor_tokens: int = 0


# Anything not listed is protected (the numbers the analysis rests on) and only
# subject to the generous per-item guard below.
DEFAULT_POLICY = CategoryPolicy(cap_tokens=None, item_cap_tokens=4000)

POLICIES: dict[str, CategoryPolicy] = {
    # Newest first, issuer-written, usually only a title: first to go.
    "regulatory_announcements": CategoryPolicy(2500, 250, trim_rank=1, floor_tokens=600),
    # Shared by every holding, so the least specific evidence of all.
    "macro_research": CategoryPolicy(1500, 450, trim_rank=2, floor_tokens=500),
    "sector_research": CategoryPolicy(1500, 450, trim_rank=3, floor_tokens=500),
    "company_research": CategoryPolicy(2500, 600, trim_rank=4, floor_tokens=900),
    # Already selected within evidence_document_token_budget; the cap is a guard.
    "document_excerpt": CategoryPolicy(4500, 700, trim_rank=5, floor_tokens=1500),
    "macro_indicator": CategoryPolicy(2500, 500, trim_rank=6, floor_tokens=1000),
    # Fund lists grow with the fund (hundreds of holdings): keep the top lines.
    "fund_holdings": CategoryPolicy(3500, 3500, trim_rank=7, floor_tokens=1200),
    "fund_look_through": CategoryPolicy(3000, 3000, trim_rank=8, floor_tokens=1200),
    "fund_overlap": CategoryPolicy(2000, 2000, trim_rank=9, floor_tokens=600),
    "fund_exposure": CategoryPolicy(2000, 2000, trim_rank=10, floor_tokens=600),
}


def policy_for(category: str) -> CategoryPolicy:
    return POLICIES.get(category, DEFAULT_POLICY)


def truncate_text(text: str, max_tokens: int) -> str:
    """Cut ``text`` to about ``max_tokens`` at a line end, else a sentence end,
    else a word end, and say so. Never cuts a number in half."""
    if estimate_tokens(text) <= max_tokens:
        return text
    marker_tokens = estimate_tokens(TRIM_MARKER)
    max_chars = max(0, int((max_tokens - marker_tokens) * CHARS_PER_TOKEN / _SAFETY))
    cut = text[:max_chars]
    floor = len(cut) // 2
    for boundary in ("\n", ". ", "; ", "! ", "? ", " "):
        idx = cut.rfind(boundary)
        if idx >= floor:
            cut = cut[: idx + (1 if boundary.strip() else 0)]
            break
    return cut.rstrip() + TRIM_MARKER


@dataclass
class BudgetReport:
    budget_tokens: int | None
    tokens_before: int = 0
    tokens_after: int = 0
    # category -> {"before": tokens, "after": tokens, "items_before": n, "items_after": n}
    categories: dict[str, dict[str, int]] = field(default_factory=dict)
    over_budget: bool = False

    @property
    def trimmed(self) -> bool:
        return any(
            c["after"] < c["before"] or c["items_after"] < c["items_before"] for c in self.categories.values()
        )

    def as_dict(self) -> dict:
        return {
            "budget_tokens": self.budget_tokens,
            "tokens_before": self.tokens_before,
            "tokens_after": self.tokens_after,
            "over_budget": self.over_budget,
            "categories": self.categories,
        }

    def note(self) -> str | None:
        """One line for the run's evidence notes; None when nothing was cut."""
        parts = []
        for name, c in self.categories.items():
            if c["items_after"] < c["items_before"]:
                parts.append(f"{name}: kept {c['items_after']} of {c['items_before']} items")
            elif c["after"] < c["before"]:
                parts.append(f"{name}: shortened")
        if not parts:
            return None
        head = (
            f"evidence trimmed to fit the local model (~{self.tokens_before:,} -> ~{self.tokens_after:,} "
            f"estimated tokens"
            + (f", limit {self.budget_tokens:,}" if self.budget_tokens else "")
            + ")"
        )
        tail = " -- STILL OVER the limit: protected figures alone are larger than the budget" if self.over_budget else ""
        return head + ": " + "; ".join(parts) + tail


def _fit_category(items: list[EvidenceItem], cap_tokens: int) -> list[EvidenceItem]:
    """Keep items in order until ``cap_tokens`` is used; shorten the item that
    straddles the cap when enough room remains, drop the rest."""
    kept: list[EvidenceItem] = []
    used = 0
    for item in items:
        tokens = item_tokens(item)
        if used + tokens <= cap_tokens:
            kept.append(item)
            used += tokens
            continue
        remaining = cap_tokens - used
        header = item_tokens(replace(item, content=""))
        room = remaining - header
        if room >= _MIN_PARTIAL_TOKENS:
            kept.append(replace(item, content=truncate_text(item.content, room)))
        break  # everything after the straddling item is dropped
    return kept


def _tokens(items: list[EvidenceItem]) -> int:
    return sum(item_tokens(i) for i in items)


def apply_token_budget(packet: EvidencePacket, *, total_budget: int | None) -> BudgetReport:
    """Enforce the caps, then the total budget, on ``packet`` in place."""
    report = BudgetReport(budget_tokens=total_budget)
    before: dict[str, list[EvidenceItem]] = {}
    for item in packet.items:
        before.setdefault(item.category, []).append(item)
    report.tokens_before = _tokens(packet.items)

    # Phase A -- always-on caps: bounded no matter how much data exists.
    for item_index, item in enumerate(packet.items):
        policy = policy_for(item.category)
        if item_tokens(item) > policy.item_cap_tokens:
            header = item_tokens(replace(item, content=""))
            room = max(_MIN_PARTIAL_TOKENS, policy.item_cap_tokens - header)
            packet.items[item_index] = replace(item, content=truncate_text(item.content, room))
    _apply_category_caps(packet, lambda name: policy_for(name).cap_tokens)

    # Phase B -- pressure: squeeze lowest-value categories toward their floors.
    # Phase C -- last resort: floors drop to a stub, still never the protected
    # figures. Stops the moment the packet fits.
    if total_budget:
        for floor_for in (lambda p: p.floor_tokens, lambda p: min(p.floor_tokens, 200)):
            ranked = sorted(
                {i.category for i in packet.items if policy_for(i.category).trim_rank is not None},
                key=lambda name: policy_for(name).trim_rank,  # type: ignore[arg-type,return-value]
            )
            for name in ranked:
                excess = _tokens(packet.items) - total_budget
                if excess <= 0:
                    break
                current = _tokens([i for i in packet.items if i.category == name])
                target = max(floor_for(policy_for(name)), current - excess)
                if target < current:
                    _apply_category_caps(packet, lambda n, name=name, target=target: target if n == name else None)
            if _tokens(packet.items) <= total_budget:
                break

    report.tokens_after = _tokens(packet.items)
    report.over_budget = bool(total_budget) and report.tokens_after > total_budget
    after: dict[str, list[EvidenceItem]] = {}
    for item in packet.items:
        after.setdefault(item.category, []).append(item)
    for name, items in before.items():
        kept = after.get(name, [])
        report.categories[name] = {
            "before": _tokens(items),
            "after": _tokens(kept),
            "items_before": len(items),
            "items_after": len(kept),
        }

    packet.token_budget = report.as_dict()
    note = report.note()
    if note:
        packet.unavailable_reasons.append(note)
        log.warning("evidence packet %s: %s", packet.ticker, note)
    log.info(
        "evidence packet %s: ~%d estimated tokens (budget %s): %s",
        packet.ticker,
        report.tokens_after,
        total_budget,
        ", ".join(f"{n}={c['after']}" for n, c in sorted(report.categories.items(), key=lambda kv: -kv[1]["after"])),
    )
    return report


def _apply_category_caps(packet: EvidencePacket, cap_for) -> None:
    """Re-fit every category whose cap (from ``cap_for``) is exceeded, keeping
    the packet's item order."""
    by_cat: dict[str, list[EvidenceItem]] = {}
    for item in packet.items:
        by_cat.setdefault(item.category, []).append(item)
    replaced: dict[str, list[EvidenceItem]] = {}
    for name, items in by_cat.items():
        cap = cap_for(name)
        if cap is not None and _tokens(items) > cap:
            replaced[name] = _fit_category(items, cap)
    if not replaced:
        return
    emitted: dict[str, int] = {}
    new_items: list[EvidenceItem] = []
    for item in packet.items:
        if item.category in replaced:
            kept = replaced[item.category]
            i = emitted.get(item.category, 0)
            if i < len(kept) and kept[i].id == item.id:
                new_items.append(kept[i])
                emitted[item.category] = i + 1
            continue
        new_items.append(item)
    packet.items[:] = new_items


def packet_token_budget(settings, *, provider_name: str | None) -> int | None:
    """The total estimated-token limit for one evidence packet, or None (caps
    only) when both the configured limit and the derived one are off.

    Derived for the local model: the largest context it can be given, minus the
    answer, minus the blind-pass JSON the reconciliation pass reads back, minus
    prompt overhead. Sized so *both* passes fit on the fallback model, which is
    what makes this future-proof: the packet cannot outgrow the hardware.
    """
    configured = settings.evidence_packet_token_budget or None
    derived = None
    if provider_name == "ollama":
        ceiling = settings.ollama_num_ctx
        if settings.ollama_adaptive_fit and settings.ollama_fallback_model_name:
            ceiling = max(ceiling, settings.ollama_fallback_num_ctx)
        derived = max(
            MIN_BUDGET_TOKENS,
            ceiling - 2 * OUTPUT_RESERVE_TOKENS - settings.analysis_prompt_overhead_tokens,
        )
    candidates = [v for v in (configured, derived) if v]
    return min(candidates) if candidates else None
