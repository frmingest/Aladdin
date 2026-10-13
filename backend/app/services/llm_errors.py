"""Plain-language reasons for an LLM provider failure (hardening sprint, 2026-10-13).

Why: a failed analysis used to store the vendor's own error text, for example
``Gemini API call failed (model=gemini-3.6-flash): 429 RESOURCE_EXHAUSTED. {'error': {...}}``,
and the analysis panel, the queue and the 503 body printed it as it came. The
useful part (the quota is spent, Ollama is not running, the model name is
retired) was buried in a dump.

This module only reads the message text. It does not decide whether a run
fails, retries or falls back (pipeline.py and the worker still do), it never
calls a provider, and it keeps no secret: provider messages carry the model name
and a status, never a key. Pure and deterministic: the same text always gives the
same sentence, so it is easy to test.
"""

from __future__ import annotations

import re

# How much of the original text stays after the plain sentence, for diagnosis.
DETAIL_CHARS = 160

_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        ("The daily request budget for this model is used up. It resets tomorrow; "
         "you can also switch the provider in the settings."),
        re.compile(r"daily request budget|budget exhausted", re.IGNORECASE),
    ),
    (
        "The AI provider's quota or rate limit was hit. Wait a few minutes and run it again.",
        re.compile(r"\b429\b|resource_exhausted|quota|rate.?limit|too many requests", re.IGNORECASE),
    ),
    (
        "No API key is set for this AI provider. Add it in the server settings (the .env file or Railway variables).",
        re.compile(r"api_key is not set|key is not set|is not set .*cannot call", re.IGNORECASE),
    ),
    (
        "The AI provider refused the API key. Check that the key is correct and still active.",
        re.compile(r"\b40[13]\b|unauthenticated|permission_denied|api key not valid|invalid api key|unauthorized", re.IGNORECASE),
    ),
    (
        "Ollama is not running or cannot be reached. Start it (or check OLLAMA_BASE_URL) and run it again.",
        re.compile(r"connecterror|connection refused|ollama request failed|all connection attempts failed", re.IGNORECASE),
    ),
    (
        "Ollama does not have the model installed. Pull it with `ollama pull <model>` and run it again.",
        re.compile(r"ollama pull|ollama doesn't have model", re.IGNORECASE),
    ),
    (
        "The AI provider does not know this model name (it may have been retired). Check the model setting.",
        re.compile(r"\b404\b|not_found|not found|no longer available|retired", re.IGNORECASE),
    ),
    (
        "The AI provider took too long to answer. Run it again; if it keeps happening, raise the timeout setting.",
        re.compile(r"timed? ?out|timeout|stalled", re.IGNORECASE),
    ),
    (
        "The evidence was too large for the model's context window. Lower the evidence budget or use a model with a longer context.",
        re.compile(r"context (length|window)|num_ctx|too many tokens|token limit exceeded", re.IGNORECASE),
    ),
    (
        "The model ran out of output space before finishing its answer. Raise the output token limit and run it again.",
        re.compile(r"max_output_tokens|LLM_MAX_OUTPUT_TOKENS|finish_reason.*length|truncated", re.IGNORECASE),
    ),
    (
        "The AI provider is overloaded right now. Run it again in a few minutes.",
        re.compile(r"\b50[0234]\b|unavailable|overloaded|bad gateway|try again later", re.IGNORECASE),
    ),
    (
        "The model answered with nothing. Run it again.",
        re.compile(r"empty response|no choices|no response returned", re.IGNORECASE),
    ),
    (
        "The model's answer did not match the required format, so nothing was saved from it. Run it again.",
        re.compile(r"schema validation|invalid json|not valid json|json decode|malformed", re.IGNORECASE),
    ),
]

_GENERIC = "The AI provider could not produce an answer."


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def explain_llm_failure(message: str | BaseException | None, *, detail_chars: int = DETAIL_CHARS) -> str:
    """One plain sentence for the cause, then the start of the original text.

    The first matching rule wins, in the order above (a budget message is
    checked before the generic 429 rule, a missing key before a refused key).
    Unknown text gets the generic sentence and keeps its detail.
    """
    raw = _squash(str(message)) if message is not None else ""
    if not raw:
        return _GENERIC
    sentence = _GENERIC
    for text, pattern in _RULES:
        if pattern.search(raw):
            sentence = text
            break
    detail = raw if len(raw) <= detail_chars else raw[: detail_chars - 1].rstrip() + "…"
    return f"{sentence} (Technical detail: {detail})"
