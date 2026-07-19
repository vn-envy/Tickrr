"""Read-only client for The Odds API (the-odds-api.com) — sportsbook consensus layer.

One integration surfaces outright (futures) odds from ~40 high-usage books — DraftKings,
FanDuel, BetMGM, Pinnacle, bet365, and more — which we distill into a single de-vigged
CONSENSUS implied probability per outcome. That consensus is the third venue next to
Polymarket and Kalshi: prediction market vs prediction market vs the sportsbook crowd.

Free tier is 500 requests/month, so responses are cached aggressively (default 15 min).
Without an ODDS_API_KEY the client degrades gracefully to "no data" — nothing breaks.

Method: for each bookmaker, implied prob = 1/decimal_price, then de-vig by normalizing the
bookmaker's outcome probs to sum to 1. Consensus = mean of de-vigged probs across books.
"""
from __future__ import annotations

import time

import httpx

from app.config import settings

# Query keyword -> The Odds API sport key (outright winner markets).
# Adding a spectacle = adding one line here, in the same spirit as VITE_MARKET_QUERIES.
SPORT_KEYS: dict[str, str] = {
    "world cup": "soccer_fifa_world_cup_winner",
    "nfl": "americanfootball_nfl_super_bowl_winner",
    "super bowl": "americanfootball_nfl_super_bowl_winner",
    "nba": "basketball_nba_championship_winner",
    "mlb": "baseball_mlb_world_series_winner",
    "world series": "baseball_mlb_world_series_winner",
}


def sport_key_for(query: str) -> str | None:
    """The outright sport key for a terminal query, or None if books don't cover it."""
    q = (query or "").lower()
    for kw, key in SPORT_KEYS.items():
        if kw in q:
            return key
    return None


class OddsApiClient:
    """Consensus outright odds keyed by normalized outcome name."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None,
                 timeout: float | None = None, cache_ttl: float = 900.0):
        self.api_key = api_key if api_key is not None else settings.odds_api_key
        self.base_url = (base_url or settings.odds_api_url).rstrip("/")
        self.timeout = timeout or settings.request_timeout_s
        self.cache_ttl = cache_ttl
        self._cache: dict[str, tuple[float, dict]] = {}

    async def get_consensus(self, sport_key: str, normalize=lambda s: s) -> dict:
        """normalized outcome -> {prob, book_count, best_book, best_price, label}.

        `prob` is the mean de-vigged implied probability across books (0..1);
        `best_price` is the best raw decimal price on offer and `best_book` who offers it.
        Returns {} when no key is configured or the venue has no such market.
        """
        if not self.api_key or not sport_key:
            return {}
        now = time.monotonic()
        hit = self._cache.get(sport_key)
        if hit and now - hit[0] < self.cache_ttl:
            return hit[1]
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.base_url}/v4/sports/{sport_key}/odds",
                    params={
                        "apiKey": self.api_key,
                        "regions": "us,uk,eu",
                        "markets": "outrights",
                        "oddsFormat": "decimal",
                    },
                )
                resp.raise_for_status()
                events = resp.json()
        except (httpx.HTTPError, ValueError):
            return hit[1] if hit else {}

        out = self._consensus_from_events(events, normalize)
        self._cache[sport_key] = (now, out)
        return out

    @staticmethod
    def _consensus_from_events(events: list, normalize) -> dict:
        # key -> {"probs": [de-vigged probs], "best": (price, book), "label": display name}
        acc: dict[str, dict] = {}
        for ev in events or []:
            for bm in ev.get("bookmakers") or []:
                book = bm.get("title") or bm.get("key") or "book"
                for mkt in bm.get("markets") or []:
                    if mkt.get("key") != "outrights":
                        continue
                    outcomes = mkt.get("outcomes") or []
                    raw = []
                    for o in outcomes:
                        try:
                            price = float(o.get("price") or 0)
                        except (TypeError, ValueError):
                            continue
                        if price > 1.0:
                            raw.append((str(o.get("name") or ""), price))
                    if not raw:
                        continue
                    overround = sum(1.0 / p for _, p in raw)
                    if overround <= 0:
                        continue
                    for name, price in raw:
                        key = normalize(name)
                        entry = acc.setdefault(key, {"probs": [], "best": (0.0, ""), "label": name})
                        entry["probs"].append((1.0 / price) / overround)
                        if price > entry["best"][0]:
                            entry["best"] = (price, book)

        out: dict[str, dict] = {}
        for key, e in acc.items():
            probs = e["probs"]
            if not probs:
                continue
            out[key] = {
                "prob": sum(probs) / len(probs),
                "book_count": len(probs),
                "best_price": round(e["best"][0], 2),
                "best_book": e["best"][1],
                "label": e["label"],
            }
        return out
