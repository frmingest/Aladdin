"""Filesystem locations for versioned, non-Python assets read at runtime.

CLAUDE.md Rule 3: prompts and schemas are versioned files, not inline
strings — this is the one place their on-disk location is decided, so a
future asset family (scoring/, discount_rate/, ...) adds one constant here
rather than every caller inventing its own relative path.
"""
from __future__ import annotations

from pathlib import Path

# backend/app/config/paths.py -> backend/ (three parents up)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

PROMPTS_DIR = BACKEND_DIR / "prompts"
