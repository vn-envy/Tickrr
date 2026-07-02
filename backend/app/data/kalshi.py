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
GOAL_SERIES = "KXWCGOAL"   # per-match "scores N+ goals" (1+ = to-score)
SOA_SERIES = "KXWCSOA"     # per-match "goal or assist"

# Crypto "how high will it get this year?" — one market per strike ("Above $X", floor_strike set,
# close = year end). P(yearly high >= X) == P(reach X by year end), which is exactly Polymarket's
# "Will {asset} reach $X by December 31?" — a clean, same-question cross-venue pair.
BTC_REACH_SERIES = "KXBTCMAXY"
ETH_REACH_SERIES = "KXETHMAXY"

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

    async def get_reach_probs(self, series: str) -> dict[int, dict]:
        """threshold(int) -> {prob, ticker, url} for a 'how high this year' series.

        Only the 'Above $X' legs (floor_strike set, no cap) are used — each one's price is
        P(asset's yearly high >= X) = P(reach X by year end). Strikes are quoted a cent under
        the round number ($99,999.99), so we round to the clean threshold (100000) for matching.
        Cached; last-known-good on failure."""
        now = time.time()
        cached = _CACHE.get(series)
        if cached and cached["probs"] and now - cached["ts"] < _CACHE_TTL_S:
            return cached["probs"]
        markets = await self._fetch_markets(series)
        if not markets:
            return cached["probs"] if cached else {}
        out: dict[int, dict] = {}
        for m in markets:
            floor = _to_float(m.get("floor_strike"))
            cap = _to_float(m.get("cap_strike"))
            prob = _mid(m)
            if floor is None or cap is not None or prob is None:
                continue  # keep only the open-ended 'Above $X' legs
            thr = int(round(floor))  # 99999.99 -> 100000
            out[thr] = {"prob": round(prob, 4), "ticker": m.get("ticker"), "url": _kalshi_url(series)}
        _CACHE[series] = {"ts": now, "probs": out}
        return out

    async def get_threshold_probs(self, series: str) -> dict[str, dict]:
        """normalized player -> {prob, threshold, url} for 'Player: N+' per-match series
        (assists / goals / score-or-assist). Prefers the '1+' line; on duplicate players keeps
        the most-liquid market. Cached; last-known-good on failure."""
        now = time.time()
        cached = _CACHE.get(series)
        if cached and cached["probs"] and now - cached["ts"] < _CACHE_TTL_S:
            return cached["probs"]
        markets = await self._fetch_markets(series)
        if not markets:
            return cached["probs"] if cached else {}
        out: dict[str, dict] = {}
        best_vol: dict[str, float] = {}
        for m in markets:
            sub = m.get("yes_sub_title") or ""
            if ":" in sub:
                name, thr = (p.strip() for p in sub.split(":", 1))
            else:
                name, thr = sub.strip(), "1+"
            prob = _mid(m)
            if not name or prob is None:
                continue
            key = normalize_team(name)
            vol = _to_float(m.get("volume_fp")) or _to_float(m.get("volume")) or 0.0
            if thr.startswith("1"):  # prefer the 1+ line; among those, the most-liquid match
                if key not in best_vol or vol > best_vol[key]:
                    out[key] = {"prob": round(prob, 4), "threshold": thr, "url": _kalshi_url(series)}
                    best_vol[key] = vol
            elif key not in out:
                out[key] = {"prob": round(prob, 4), "threshold": thr, "url": _kalshi_url(series)}
        _CACHE[series] = {"ts": now, "probs": out}
        return out
