"""Tickrr API — FastAPI app.

Day-1 surface: health + a market-intelligence endpoint that pulls live Polymarket markets
and returns the deterministic fair-value read for each. Dislocation detection, the Gemini
"why did it move?" agent, the simulator, and auth/billing are the next increments.
"""
from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import __version__
from app.config import settings
from app.data.polymarket import PolymarketClient
from app.data.kalshi import KalshiClient, normalize_team
from app.engine import fair_value, dislocation
from app.models import MarketIntel, MarketSnapshot, Outcome, Divergence

app = FastAPI(
    title="Tickrr API",
    version=__version__,
    description="Prediction & event intelligence — intel only, never executes trades.",
)

# Open CORS for the local Next.js terminal during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = PolymarketClient()
kalshi_client = KalshiClient()


def _is_winner_event(s: MarketSnapshot) -> bool:
    """Only the 'World Cup Winner' event maps 1:1 to Kalshi's winner market — exclude
    advance/group/golden-boot events so we don't compare a win-price to a qualify-price."""
    et = (s.event_title or "").lower()
    return "winner" in et and "boot" not in et


def _intel(s: MarketSnapshot, kalshi_probs: dict | None = None) -> MarketIntel:
    """Attach the deterministic fair-value read (plus any cross-venue divergence) to a
    snapshot. The primary outcome is the first listed (e.g. 'Yes' on a team-to-win market)."""
    primary = s.outcomes[0] if s.outcomes else Outcome(label="Yes", price=s.last_price or 0.0)
    fv = fair_value.assess(
        primary.price,
        best_bid=s.best_bid,
        best_ask=s.best_ask,
        spread=s.spread,
        liquidity=s.liquidity,
        volume=s.volume,
    )
    kp = ku = None
    div = None
    if kalshi_probs and _is_winner_event(s):
        entry = kalshi_probs.get(normalize_team(s.group_title or s.question))
        if entry and entry.get("prob") is not None:
            kp, ku = entry["prob"], entry.get("url")
            div = Divergence(
                polymarket=round(fv.implied_prob * 100, 1),
                kalshi=round(kp * 100, 1),
                gap_pp=round((fv.implied_prob - kp) * 100, 1),
                url=ku,
            )
    disloc = dislocation.detect(s, fv, kalshi_prob=kp, kalshi_url=ku)
    return MarketIntel(market=s, primary_outcome=primary, fair_value=fv, dislocation=disloc, divergence=div)


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": __version__, "env": settings.tickrr_env}


@app.get("/api/markets", response_model=list[MarketIntel])
async def list_markets(
    query: str = Query("World Cup", description="Event-title filter"),
    limit: int = Query(30, ge=1, le=100),
):
    """Live market intelligence: matching markets + each one's fair-value read."""
    snapshots = await client.search_markets(query=query, limit=limit)
    kalshi_probs = await kalshi_client.get_winner_probs() if "world cup" in query.lower() else {}
    return [_intel(s, kalshi_probs) for s in snapshots]


@app.get("/api/dislocations", response_model=list[MarketIntel])
async def list_dislocations(
    query: str = Query("World Cup", description="Event-title filter"),
    limit: int = Query(60, ge=1, le=200),
):
    """The home board: only markets currently flagged with a dislocation, most severe first."""
    snapshots = await client.search_markets(query=query, limit=limit)
    kalshi_probs = await kalshi_client.get_winner_probs() if "world cup" in query.lower() else {}
    intel = [_intel(s, kalshi_probs) for s in snapshots]
    flagged = [m for m in intel if m.dislocation is not None]
    flagged.sort(key=lambda m: m.dislocation.severity if m.dislocation else 0.0, reverse=True)
    return flagged


@app.get("/api/history")
async def price_history(token: str, interval: str = "1m", fidelity: int = 1440):
    """Implied-probability time series for a market's Yes token (Polymarket CLOB)."""
    points = await client.get_price_history(token, interval=interval, fidelity=fidelity)
    return {"history": points}
