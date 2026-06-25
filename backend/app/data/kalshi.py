"""Read-only Kalshi client (public market data, no auth).

Used ONLY to compute DERIVED cross-venue signals (Polymarket vs Kalshi) and to link out to
Kalshi with attribution. Kalshi's Data ToS restricts commercial redistribution of their raw
feed without written consent, so we do not mirror their book — we compute derived analytics
(gaps, player lines) and link to the source. A data license would let us display more directly.

Live WC markets used here:
  * KXMENWORLDCUP  — winner, one market per team (yes_sub_title = team)
  * KXWCGOALLEADER — top scorer / Golden Boot (yes_sub_title = player)
  * KXWCAST        — assists, yes_sub_title = "Player Name: 1+"
Prices live in the `*_dollars` fields (already 0..1 = probability).
"""
from __future__ import annotations

import time
import unicodedata

import httpx

from app.config import settings

WC_WINNER_SERIES = "KXMENWORLDCUP"
GOAL_LEADER_SERIES = "KXWCGOALLEADER"  # Kalshi top-scorer (Golden Boot equivalent)
ASSISTS_SERIES = "KXWCAST"

# Per-series process cache so a Kalshi blip never empties the board (last-known-good).
_CACHE: dict = {}  # series -> {"ts": float, "probs": dict}
_CACHE_TTL_S = 30.0


def _to_float(x) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def normalize_team(name: str | None) -> str:
    """Lowercase, accent- and punctuation-insensitive key for cross-venue matching."""
    decomposed = unicodedata.normalize("NFKD", name or "")
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    return "".join(ch for ch in no_accents.lower() if ch.isalnum())


def _mid(m: dict) -> float | None:
    """Executable mid (bid/ask) else last trade, from the `*_dollars` fields."""
    bid = _to_float(m.get("yes_bid_dollars"))
    ask = _to_float(m.get("yes_ask_dollars"))
    if bid is not None and ask is not None and (bid + ask) > 0:
        return (bid + ask) / 2.0
    return _to_float(m.get("last_price_dollars"))


def _kalshi_url(series: str) -> str:
    return f"https://kalshi.com/markets/{series.lower()}"


class KalshiClient:
    def __init__(self, base_url: str | None = None, timeout: float | None = None):
        self.base_url = (base_url or settings.kalshi_api_url).rstrip("/")
        self.timeout = timeout or settings.request_timeout_s

    async def _fetch_markets(self, series: str) -> list:
        """Raw open markets for a series, with retries (Kalshi can be flaky). [] on failure."""
        for _ in range(3):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.get(
                        f"{self.base_url}/markets",
                        params={"series_ticker": series, "limit": 500, "status": "open"},
                    )
                    resp.raise_for_status()
                    return resp.json().get("markets", [])
            except Exception:
                continue
        return []

    async def get_winner_probs(self, series: str = WC_WINNER_SERIES) -> dict[str, dict]:
        """normalized name -> {prob, ticker, url}. Cached; last-known-good on failure."""
        now = time.time()
        cached = _CACHE.get(series)
        if cached and cached["probs"] and now - cached["ts"] < _CACHE_TTL_S:
            return cached["probs"]
        markets = await self._fetch_markets(series)
        if not markets:
            return cached["probs"] if cached else {}
        out: dict[str, dict] = {}
        for m in markets:
            name = m.get("yes_sub_title") or ""
            prob = _mid(m)
            if not name or prob is None:
                continue
            out[normalize_team(name)] = {"prob": round(prob, 4), "ticker": m.get("ticker"), "url": _kalshi_url(series)}
        _CACHE[series] = {"ts": now, "probs": out}
        return out

    async def get_assist_probs(self, series: str = ASSISTS_SERIES) -> dict[str, dict]:
        """normalized player -> {prob, threshold, url} for assists, preferring the '1+' line.
        Kalshi encodes these as yes_sub_title 'Player Name: 1+'."""
        now = time.time()
        cached = _CACHE.get(series)
        if cached and cached["probs"] and now - cached["ts"] < _CACHE_TTL_S:
            return cached["probs"]
        markets = await self._fetch_markets(series)
        if not markets:
            return cached["probs"] if cached else {}
        out: dict[str, dict] = {}
        for m in markets:
            sub = m.get("yes_sub_title") or ""
            if ":" not in sub:
                continue
            name, thr = (p.strip() for p in sub.split(":", 1))
            prob = _mid(m)
            if not name or prob is None:
                continue
            key = normalize_team(name)
            if key not in out or thr.startswith("1"):  # prefer the 1+ line
                out[key] = {"prob": round(prob, 4), "threshold": f"{thr} assists", "url": _kalshi_url(series)}
        _CACHE[series] = {"ts": now, "probs": out}
        return out
