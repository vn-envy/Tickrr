"""Fair-value engine — DETERMINISTIC, no network, no LLM.

Turns a raw prediction-market price (plus order-book microstructure when available) into a
*decision-quality* read:
  * implied probability — the executable mid (best bid/ask) when we have it, else last trade,
  * a FAIR RANGE — the real [bid, ask] band when published, else a liquidity-widened band,
  * spread cost — the real round-trip spread when published, else estimated from depth,
  * a 0..1 liquidity score and a plain-English quality label.

Polymarket's Gamma feed publishes bestBid / bestAsk / spread / lastTradePrice directly, so
the read is grounded in real microstructure rather than guessed. Pure stdlib -> zero-dependency
unit tests. Heuristics are documented and meant to be recalibrated against realized outcomes.
"""
from __future__ import annotations

import math

from app.models import FairValue


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def liquidity_score(liquidity: float | None, volume: float | None) -> float:
    """0..1 confidence from market depth. Log-scaled: ~$1 -> 0, ~$100k -> 1.0.

    Volume is discounted (cumulative, not standing depth) but still informative.
    """
    liq = max(0.0, liquidity or 0.0) + 0.25 * max(0.0, volume or 0.0)
    if liq <= 0:
        return 0.0
    return round(clamp(math.log10(liq + 1.0) / 5.0), 4)


def _estimated_spread(liq_score: float) -> float:
    """Fallback round-trip cost when bid/ask isn't published: ~12% thin -> ~1% deep."""
    return round(0.12 - 0.11 * clamp(liq_score), 4)


def assess(price: float, *, best_bid: float | None = None, best_ask: float | None = None,
           spread: float | None = None, liquidity: float | None = None,
           volume: float | None = None) -> FairValue:
    """Full fair-value read for one outcome. `price` is the fallback point price (0..1);
    bid/ask/spread/liquidity/volume are used when the venue publishes them."""
    bid = best_bid if (best_bid or 0) > 0 else None
    ask = best_ask if (best_ask or 0) > 0 else None
    ls = liquidity_score(liquidity, volume)

    # Implied probability: prefer the executable mid, else the last/point price.
    if bid is not None and ask is not None:
        mid, source = (bid + ask) / 2.0, "mid"
    else:
        mid, source = price, "last"
    mid = clamp(mid)

    # Fair range + spread cost: real book if we have it, else a liquidity-widened band.
    if bid is not None and ask is not None:
        lo, hi = clamp(bid), clamp(ask)
        sc = round(max(0.0, hi - lo), 4)
    elif spread and spread > 0:
        half = clamp(spread / 2.0, 0.0, 0.5)
        lo, hi = clamp(mid - half), clamp(mid + half)
        sc = round(clamp(spread, 0.0, 1.0), 4)
    else:
        sc = _estimated_spread(ls)
        half = (1.0 - ls) * 0.10 + 0.01
        lo, hi = clamp(mid - half), clamp(mid + half)

    if sc <= 0.03 and ls >= 0.5:
        quality, notes = "good", "tight spread on a deep book — decision-quality price"
    elif sc <= 0.08 and ls >= 0.3:
        quality, notes = "fair", "tradable, but respect the spread — use the range"
    else:
        quality, notes = "thin", "wide spread / thin book — easy to overpay, low trust"

    return FairValue(
        implied_prob=round(mid, 4),
        fair_low=round(lo, 4),
        fair_high=round(hi, 4),
        spread_cost=sc,
        liquidity_score=ls,
        decision_quality=quality,
        notes=notes,
        best_bid=round(bid, 4) if bid is not None else None,
        best_ask=round(ask, 4) if ask is not None else None,
        price_source=source,
    )
