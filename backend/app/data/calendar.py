"""Catalyst calendar — the "what to watch" behind the markets. DETERMINISTIC, no network.

A curated list of dated, market-moving events across the universes the terminal covers.
(This module was referenced by main.py's /api/calendar but missing from the repo — a fresh
clone couldn't boot. Restored as a static, easily-editable list; swap in a live source later.)
"""
from __future__ import annotations

from datetime import date, datetime

# (ISO date, title, category) — keep sorted-ish; upcoming() sorts anyway.
_EVENTS: list[tuple[str, str, str]] = [
    # World Cup 2026
    ("2026-06-11", "FIFA World Cup 2026 — opening match (Mexico City)", "World Cup"),
    ("2026-06-27", "World Cup — group stage ends", "World Cup"),
    ("2026-06-29", "World Cup — round of 32 begins", "World Cup"),
    ("2026-07-04", "World Cup — round of 16 begins", "World Cup"),
    ("2026-07-09", "World Cup — quarter-finals begin", "World Cup"),
    ("2026-07-14", "World Cup — semi-finals begin", "World Cup"),
    ("2026-07-19", "World Cup FINAL — MetLife Stadium, New Jersey", "World Cup"),
    # NFL
    ("2026-09-10", "NFL 2026 season kickoff", "NFL"),
    ("2026-11-26", "NFL Thanksgiving slate", "NFL"),
    ("2027-01-09", "NFL playoffs — Wild Card weekend", "NFL"),
    ("2027-02-14", "Super Bowl LXI", "NFL"),
    # Macro
    ("2026-07-29", "FOMC rate decision + press conference", "Macro"),
    ("2026-08-11", "US CPI print (July)", "Macro"),
    ("2026-09-16", "FOMC rate decision + SEP dot plot", "Macro"),
    ("2026-10-28", "FOMC rate decision", "Macro"),
    ("2026-12-09", "FOMC rate decision (final 2026)", "Macro"),
    # Politics
    ("2026-11-03", "US midterm elections", "Politics"),
    # Crypto
    ("2026-12-31", "Bitcoin / Ethereum 2026 year-end price markets resolve", "Crypto"),
]


def upcoming(category: str | None = None, limit: int = 12) -> list[dict]:
    """Future events (today inclusive), optionally filtered to one category, soonest first."""
    today = date.today().isoformat()
    rows = [
        {"date": d, "title": t, "category": c}
        for d, t, c in _EVENTS
        if d >= today and (not category or c.lower() == category.lower())
    ]
    rows.sort(key=lambda r: r["date"])
    return rows[: max(1, limit)]


def _parse(d: str) -> datetime:
    return datetime.fromisoformat(d)
