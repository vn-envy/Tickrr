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
    clob_token_id: str | None = None     # Yes-token id, for CLOB price history


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
    link: str | None = None  # attributed source (e.g. Kalshi) for cross-venue signals


class Divergence(BaseModel):
    """Same question, different venues. Polymarket is the anchor; Kalshi and/or the
    sportsbook consensus (The Odds API, de-vigged mean across books) fill in when the
    outcome is priced there too. `gap_pp` is vs Kalshi when present, else vs books."""
    polymarket: float          # implied prob %
    kalshi: float | None = None  # implied prob %
    gap_pp: float              # percentage points (poly - kalshi, else poly - books)
    url: str | None = None
    books: float | None = None       # sportsbook consensus implied prob %
    book_count: int = 0              # how many book quotes back the consensus
    best_book: str | None = None     # who offers the best raw price
    best_price: float | None = None  # best decimal price on offer
    books_gap_pp: float | None = None  # poly - books, percentage points


class TeamEnrichment(BaseModel):
    top_scorer: str | None = None
    top_scorer_prob: float | None = None   # %
    attacking_threat: float | None = None  # % (sum of squad golden-boot probs, capped at 100)
    scorer_count: int = 0


class MarketIntel(BaseModel):
    market: MarketSnapshot
    primary_outcome: Outcome
    fair_value: FairValue
    dislocation: Dislocation | None = None
    divergence: Divergence | None = None
    subject_type: str = "team"   # "player" | "team"
    enrichment: TeamEnrichment | None = None
    player_country: str | None = None
