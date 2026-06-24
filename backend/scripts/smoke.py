"""Live smoke test — fetch real World Cup markets and print the fair-value read.

Run from backend/ with the venv:  python scripts/smoke.py
"""
import asyncio

from app.data.polymarket import PolymarketClient
from app.engine import fair_value
from app.models import Outcome


async def main() -> None:
    client = PolymarketClient()
    snaps = await client.search_markets("World Cup", limit=10)
    print(f"fetched {len(snaps)} markets\n")
    print(f"{'market':32} {'P':>6} {'fair range':>15} {'spread':>7} {'liq':>5}  quality")
    print("-" * 80)
    for s in snaps:
        primary = s.outcomes[0] if s.outcomes else Outcome(label="Yes", price=s.last_price or 0.0)
        fv = fair_value.assess(
            primary.price, best_bid=s.best_bid, best_ask=s.best_ask,
            spread=s.spread, liquidity=s.liquidity, volume=s.volume,
        )
        label = (s.group_title or s.question)[:30]
        rng = f"[{fv.fair_low:.3f},{fv.fair_high:.3f}]"
        print(f"{label:32} {fv.implied_prob:6.3f} {rng:>15} {fv.spread_cost:7.3f} "
              f"{fv.liquidity_score:5.2f}  {fv.decision_quality}")


if __name__ == "__main__":
    asyncio.run(main())
