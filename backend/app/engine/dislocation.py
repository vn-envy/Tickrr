"""Dislocation detector — DETERMINISTIC, no network, no LLM.

Scans a market's price + microstructure for the situations a prediction-market trader cares
about and returns the single most severe flag (or None for an unremarkable market):

  * momentum      — a sharp recent move; active repricing worth investigating,
  * liquidity_trap — a thin/wide book that's easy to overpay and may not fill at size,
  * overreaction   — a sharp move into an extreme price; watch mean-reversion vs. real news.

Cross-venue divergence (Kalshi vs Polymarket) is the next signal — pending a Kalshi data
license — and will slot in here as another candidate.
"""
from __future__ import annotations

from app.models import Dislocation, FairValue, MarketSnapshot

# thresholds in probability points (0..1)
MOMENTUM_MIN = 0.02
OVERREACTION_MIN = 0.04
EXTREME_HI = 0.85
EXTREME_LO = 0.15
DIVERGENCE_MIN = 0.01


def _norm_change(x: float | None) -> float:
    """Normalize a 1-week change to probability points in [-1, 1]
    (Gamma may report it as a fraction or a percentage)."""
    m = x or 0.0
    if abs(m) > 1.0:
        m = m / 100.0
    return m


def detect(market: MarketSnapshot, fv: FairValue, kalshi_prob: float | None = None,
           kalshi_url: str | None = None) -> Dislocation | None:
    p = fv.implied_prob
    m = _norm_change(market.one_week_change)
    candidates: list[Dislocation] = []

    # 0. Cross-venue divergence (marquee signal): Polymarket vs Kalshi.
    if kalshi_prob is not None:
        d = p - kalshi_prob
        if abs(d) >= DIVERGENCE_MIN:
            candidates.append(Dislocation(
                kind="divergence",
                label=f"Kalshi gap {d * 100:+.1f}pp",
                severity=round(min(1.0, 0.55 + abs(d) / 0.10), 2),
                direction="up" if d > 0 else "down",
                action="research",
                rationale=f"Polymarket {p * 100:.1f}% vs Kalshi {kalshi_prob * 100:.1f}% — a {abs(d) * 100:.1f}pp cross-venue gap. Compare both books before trusting either price.",
                link=kalshi_url,
            ))

    # 1. Momentum / repricing
    if abs(m) >= MOMENTUM_MIN:
        candidates.append(Dislocation(
            kind="momentum",
            label=f"Momentum {m * 100:+.1f}pp/1w",
            severity=round(min(1.0, abs(m) / 0.15), 2),
            direction="up" if m > 0 else "down",
            action="research",
            rationale=f"Price moved {m * 100:+.1f} points over the past week — active repricing; check what changed.",
        ))

    # 2. Liquidity trap
    if fv.decision_quality == "thin" or (fv.liquidity_score < 0.3 and fv.spread_cost > 0.08):
        candidates.append(Dislocation(
            kind="liquidity_trap",
            label="Liquidity trap",
            severity=round(min(1.0, 0.45 + fv.spread_cost * 3), 2),
            direction="neutral",
            action="avoid",
            rationale=f"Thin book (liquidity {fv.liquidity_score:.2f}) with ~{fv.spread_cost * 100:.1f}% spread — easy to overpay; may not fill at size.",
        ))

    # 3. Overreaction into an extreme price
    if abs(m) >= OVERREACTION_MIN and (p >= EXTREME_HI or p <= EXTREME_LO):
        candidates.append(Dislocation(
            kind="overreaction",
            label="Overreaction watch",
            severity=round(min(1.0, abs(m) / 0.10), 2),
            direction="up" if m > 0 else "down",
            action="watch",
            rationale=f"Sharp {m * 100:+.1f}pp move into an extreme price ({p * 100:.1f}%) — watch mean-reversion vs. genuine news.",
        ))

    if not candidates:
        return None
    candidates.sort(key=lambda d: d.severity, reverse=True)
    return candidates[0]
