"""Which Newsweb category carries an issuer's quarterly (Q1/Q3) reports?

Newsweb's category ids are Oslo Børs' own and this repo only knows the annual (1001) and half-year
(1002) ones. Run this once on the machine that runs the backend (it needs normal internet access to
api3.oslo.oslobors.no), then put the right id(s) in NEWSWEB_QUARTERLY_CATEGORY_IDS:

    cd backend
    python scripts/newsweb_probe.py EQNR --since 2025-01-01

It lists the issuer's announcements WITHOUT a category filter and prints, per category, the id, its
names, a count and up to five sample titles. Read-only: one GET request. Look for the category whose
titles are "Q1 2026", "Third quarter 2026" and so on.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import date, datetime, timezone

import httpx

LIST_URL = "https://api3.oslo.oslobors.no/v1/newsreader/list"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("issuer", help="Newsweb issuer sign, e.g. EQNR (the ticker without .OL)")
    parser.add_argument("--since", default="2025-01-01", help="ISO date, default 2025-01-01")
    args = parser.parse_args()

    params = {
        "issuer": args.issuer.upper(),
        "fromDate": date.fromisoformat(args.since).isoformat(),
        "toDate": datetime.now(timezone.utc).date().isoformat(),
    }
    try:
        response = httpx.get(LIST_URL, params=params, timeout=30.0, headers={"Accept": "application/json"})
        response.raise_for_status()
        messages = response.json()["data"]["messages"]
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        print(f"Could not read the Newsweb list: {exc}", file=sys.stderr)
        return 1

    by_category: dict[tuple[object, str, str], list[str]] = defaultdict(list)
    for message in messages:
        if not isinstance(message, dict) or message.get("test"):
            continue
        for cat in message.get("category") or [{}]:
            if isinstance(cat, dict):
                key = (cat.get("id"), str(cat.get("category_en") or ""), str(cat.get("category_no") or ""))
                by_category[key].append(str(message.get("title") or ""))

    if not by_category:
        print("No announcements found for that issuer and window.")
        return 0
    for (cat_id, name_en, name_no), titles in sorted(by_category.items(), key=lambda kv: str(kv[0][0])):
        print(f"\nCategory {cat_id}: {name_en} / {name_no}  ({len(titles)} announcements)")
        for title in titles[:5]:
            print(f"   - {title}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
