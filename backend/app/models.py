"""Normalized schemas shared across the engine and the API.

A `MarketSnapshot` is the source-agnostic shape we normalize every venue into; the
`FairValue` is what the deterministic engine derives from a single outcome price; and
`MarketIntel` is what the API returns (snapshot + the headline outcome + its fair value).
"""
from __future__ import annotations

from pydantic import BaseModel


class Outcome(BaseModel):
    label: str
    price: float  # raw market price = implied probability, 0..1


class MarketSnapshot(BaseModel):
    source: str  # "polymarket" | "kalshi" | ...
    id: str
    question: str
    slug: str | None = None
    outcomes: list[Outcome] = []
    volume: float | None = None
    liquidity: float | None = None
    end_date: str | None = None
    url: str | None = None
    # Microstructure (Polymarket Gamma publishes these for the primary token)
    best_bid: float | None = None
    best_ask: float | None = None
    spread: float | None = None
    last_price: float | None = None
    group_title: str | None = None      # leg/team label, e.g. "Spain"
    one_week_change: float | None = None  # momentum signal for dislocation detection
    event_title: str | None = None


class FairValue(BaseModel):
    implied_prob: float  # executable mid (best bid/ask) when available, else last price
    fair_low: float      # real [bid, ask] band when published, else liquidity-widened band
    fair_high: float
    spread_cost: float   # real round-trip spread when published, else estimated from depth
    liquidity_score: float  # 0..1
    decision_quality: str   # "good" | "fair" | "thin"
    notes: str = ""
    best_bid: float | None = None
    best_ask: float | None = None
    price_source: str = "mid"  # "mid" | "last"


class Dislocation(BaseModel):
    kind: str        # "momentum" | "liquidity_trap" | "overreaction"
    label: str       # short display label
    severity: float  # 0..1
    direction: str   # "up" | "down" | "neutral"
    action: str      # "watch" | "research" | "avoid"
    rationale: str


class MarketIntel(BaseModel):
    market: MarketSnapshot
    primary_outcome: Outcome
    fair_value: FairValue
    dislocation: Dislocation | None = None
