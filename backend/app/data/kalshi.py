"""Read-only Kalshi client (public market data, no auth).

Used ONLY to compute a DERIVED cross-venue divergence signal (Polymarket vs Kalshi) and to
link out to Kalshi with attribution. Kalshi's Data ToS restricts commercial redistribution of
their raw feed without written consent, so we do not mirror their book — we compute a derived
analytic (the gap) and link to the source. A data license would let us display more directly.

Live WC winner market: series KXMENWORLDCUP, one market per team; team in `yes_sub_title`,
prices in the `*_dollars` fields (already 0..1 = probability).
"""
from __future__ import annotations

import time

import httpx

from app.config import settings

WC_WINNER_SERIES = "KXMENWORLDCUP"
GOAL_LEADER_SERIES = "KXWCGOALLEADER"  # Kalshi top-scorer (Golden Boot equivalent)

# Per-series process cache so a Kalshi blip never empties the board (last-known-good).
_CACHE: dict = {}  # series -> {"ts": float, "probs": dict}
_CACHE_TTL_S = 30.0


def _to_float(x) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def normalize_team(name: str | None) -> str:
    """Lowercase alphanumeric key so 'Ivory Coast' / 'ivory  coast' match across venues."""
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


class KalshiClient:
    def __init__(self, base_url: str | None = None, timeout: float | None = None):
        self.base_url = (base_url or settings.kalshi_api_url).rstrip("/")
        self.timeout = timeout or settings.request_timeout_s

    async def get_winner_probs(self, series: str = WC_WINNER_SERIES) -> dict[str, dict]:
        """Map normalized team -> {prob, ticker, url} from Kalshi's WC winner market.
        Best-effort: serves a short cache and falls back to last-known-good on failure."""
        now = time.time()
        cached = _CACHE.get(series)
        if cached and cached["probs"] and now - cached["ts"] < _CACHE_TTL_S:
            return cached["probs"]
        markets: list = []
        for _ in range(3):  # best-effort with retries (Kalshi can be flaky)
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.get(
                        f"{self.base_url}/markets",
                        params={"series_ticker": series, "limit": 500, "status": "open"},
                    )
                    resp.raise_for_status()
                    markets = resp.json().get("markets", [])
                    break
            except Exception:
                markets = []
        if not markets:
            return cached["probs"] if cached else {}  # last-known-good beats nothing

        out: dict[str, dict] = {}
        for m in markets:
            team = m.get("yes_sub_title") or ""
            if not team:
                continue
            bid = _to_float(m.get("yes_bid_dollars"))
            ask = _to_float(m.get("yes_ask_dollars"))
            last = _to_float(m.get("last_price_dollars"))
            if bid is not None and ask is not None and (bid + ask) > 0:
                prob = (bid + ask) / 2.0
            elif last is not None:
                prob = last
            else:
                continue
            out[normalize_team(team)] = {
                "prob": round(prob, 4),
                "ticker": m.get("ticker"),
                "url": f"https://kalshi.com/markets/{series.lower()}",
            }
        _CACHE[series] = {"ts": now, "probs": out}
        return out
