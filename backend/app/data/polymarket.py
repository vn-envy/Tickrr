"""Read-only Polymarket client (Gamma API).

Polymarket's Gamma endpoints are public (no auth). We discover events by title and read their
embedded markets, which carry full microstructure (bestBid/bestAsk/spread/lastTradePrice,
volume, liquidity). Polymarket's ToS permits derived analytics / customer-facing outputs; we
never resell a raw bulk feed and we never place trades.
"""
from __future__ import annotations

import json

import httpx

from app.config import settings
from app.models import MarketSnapshot, Outcome


def _parse_json_list(raw) -> list:
    """Gamma encodes `outcomes` / `outcomePrices` as JSON strings. Be defensive."""
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    try:
        val = json.loads(raw)
        return val if isinstance(val, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _to_float(x) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def normalize_market(m: dict, event_title: str | None = None) -> MarketSnapshot | None:
    labels = _parse_json_list(m.get("outcomes"))
    prices = [_to_float(p) for p in _parse_json_list(m.get("outcomePrices"))]
    if not labels:
        return None
    outcomes = [
        Outcome(label=str(lbl), price=(prices[i] if i < len(prices) and prices[i] is not None else 0.0))
        for i, lbl in enumerate(labels)
    ]
    slug = m.get("slug")
    clob_ids = _parse_json_list(m.get("clobTokenIds"))
    return MarketSnapshot(
        source="polymarket",
        id=str(m.get("id") or m.get("conditionId") or slug or ""),
        question=str(m.get("question") or m.get("groupItemTitle") or ""),
        slug=slug,
        outcomes=outcomes,
        volume=_to_float(m.get("volumeNum")) or _to_float(m.get("volume")),
        liquidity=_to_float(m.get("liquidityNum")) or _to_float(m.get("liquidity")),
        end_date=m.get("endDateIso") or m.get("endDate"),
        url=f"https://polymarket.com/event/{slug}" if slug else None,
        best_bid=_to_float(m.get("bestBid")),
        best_ask=_to_float(m.get("bestAsk")),
        spread=_to_float(m.get("spread")),
        last_price=_to_float(m.get("lastTradePrice")),
        group_title=m.get("groupItemTitle"),
        one_week_change=_to_float(m.get("oneWeekPriceChange")),
        event_title=event_title,
        clob_token_id=str(clob_ids[0]) if clob_ids else None,
    )


class PolymarketClient:
    def __init__(self, gamma_url: str | None = None, timeout: float | None = None):
        self.gamma_url = (gamma_url or settings.polymarket_gamma_url).rstrip("/")
        self.clob_url = settings.polymarket_clob_url.rstrip("/")
        self.timeout = timeout or settings.request_timeout_s

    async def _get(self, path: str, params: dict):
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(f"{self.gamma_url}{path}", params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_price_history(self, token_id: str, interval: str = "1m",
                                fidelity: int = 1440) -> list[dict]:
        """Implied-probability time series for one CLOB token (Polymarket CLOB).
        Returns a list of {t: unix_seconds, p: price 0..1}."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(
                f"{self.clob_url}/prices-history",
                params={"market": token_id, "interval": interval, "fidelity": fidelity},
            )
            resp.raise_for_status()
            return resp.json().get("history", [])

    async def search_markets(self, query: str = "World Cup", limit: int = 30,
                             scan: int = 200) -> list[MarketSnapshot]:
        """Find active events whose title matches `query` and flatten their markets,
        sorted by volume (descending)."""
        events = await self._get(
            "/events",
            {"closed": "false", "limit": scan, "order": "volume", "ascending": "false"},
        )
        q = query.lower()
        out: list[MarketSnapshot] = []
        for ev in events or []:
            title = ev.get("title") or ""
            if q not in title.lower():
                continue
            for m in ev.get("markets") or []:
                snap = normalize_market(m, event_title=title)
                if snap and snap.outcomes:
                    out.append(snap)
        out.sort(key=lambda s: s.volume or 0.0, reverse=True)
        return out[:limit]
