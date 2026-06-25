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
from app.data.kalshi import KalshiClient, normalize_team, GOAL_LEADER_SERIES
from app.data.players import country_for
from app.engine import fair_value, dislocation
from app.models import MarketIntel, MarketSnapshot, Outcome, Divergence, TeamEnrichment

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


_PLAYER_EVENT_KEYS = ("golden boot", "goal leader", "top scorer", "player goals", "assist", "scorer")


def _subject_type(s: MarketSnapshot) -> str:
    """Player prop markets (golden boot / top scorer / goals) vs team markets."""
    et = (s.event_title or "").lower()
    return "player" if any(k in et for k in _PLAYER_EVENT_KEYS) else "team"


def _build_player_index(snapshots: list[MarketSnapshot]) -> dict:
    """country(normalized) -> [(player, prob)] from player golden-boot markets."""
    idx: dict[str, list] = {}
    for s in snapshots:
        if _subject_type(s) != "player":
            continue
        name = s.group_title or s.question
        prob = s.outcomes[0].price if s.outcomes else s.last_price
        country = country_for(name)
        if prob is None or not country:
            continue
        idx.setdefault(normalize_team(country), []).append((name, prob))
    return idx


def _intel(s: MarketSnapshot, kalshi_team: dict | None = None,
           kalshi_player: dict | None = None, player_index: dict | None = None) -> MarketIntel:
    """Fair-value read + cross-venue divergence + (for teams) player-derived enrichment."""
    primary = s.outcomes[0] if s.outcomes else Outcome(label="Yes", price=s.last_price or 0.0)
    fv = fair_value.assess(
        primary.price,
        best_bid=s.best_bid,
        best_ask=s.best_ask,
        spread=s.spread,
        liquidity=s.liquidity,
        volume=s.volume,
    )
    subject = _subject_type(s)
    key = normalize_team(s.group_title or s.question)

    # Cross-venue divergence: players vs Kalshi goal-leader, teams vs Kalshi winner.
    kp = ku = None
    if subject == "player" and kalshi_player:
        entry = kalshi_player.get(key)
        if entry and entry.get("prob") is not None:
            kp, ku = entry["prob"], entry.get("url")
    elif subject == "team" and kalshi_team and _is_winner_event(s):
        entry = kalshi_team.get(key)
        if entry and entry.get("prob") is not None:
            kp, ku = entry["prob"], entry.get("url")

    div = None
    if kp is not None:
        div = Divergence(
            polymarket=round(fv.implied_prob * 100, 1),
            kalshi=round(kp * 100, 1),
            gap_pp=round((fv.implied_prob - kp) * 100, 1),
            url=ku,
        )

    # Team enrichment: roll up that country's player golden-boot markets.
    enr = None
    if subject == "team" and player_index:
        scorers = sorted(player_index.get(key, []), key=lambda x: x[1], reverse=True)
        if scorers:
            enr = TeamEnrichment(
                top_scorer=scorers[0][0],
                top_scorer_prob=round(scorers[0][1] * 100, 1),
                attacking_threat=round(min(100.0, sum(p for _, p in scorers) * 100), 1),
                scorer_count=len(scorers),
            )

    disloc = dislocation.detect(s, fv, kalshi_prob=kp, kalshi_url=ku)
    return MarketIntel(
        market=s, primary_outcome=primary, fair_value=fv,
        dislocation=disloc, divergence=div, subject_type=subject, enrichment=enr,
    )


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
    is_wc = "world cup" in query.lower()
    kalshi_team = await kalshi_client.get_winner_probs() if is_wc else {}
    kalshi_player = await kalshi_client.get_winner_probs(series=GOAL_LEADER_SERIES) if is_wc else {}
    player_index = _build_player_index(snapshots) if is_wc else {}
    return [_intel(s, kalshi_team, kalshi_player, player_index) for s in snapshots]


@app.get("/api/dislocations", response_model=list[MarketIntel])
async def list_dislocations(
    query: str = Query("World Cup", description="Event-title filter"),
    limit: int = Query(60, ge=1, le=200),
):
    """The home board: only markets currently flagged with a dislocation, most severe first."""
    snapshots = await client.search_markets(query=query, limit=limit)
    is_wc = "world cup" in query.lower()
    kalshi_team = await kalshi_client.get_winner_probs() if is_wc else {}
    kalshi_player = await kalshi_client.get_winner_probs(series=GOAL_LEADER_SERIES) if is_wc else {}
    player_index = _build_player_index(snapshots) if is_wc else {}
    intel = [_intel(s, kalshi_team, kalshi_player, player_index) for s in snapshots]
    flagged = [m for m in intel if m.dislocation is not None]
    flagged.sort(key=lambda m: m.dislocation.severity if m.dislocation else 0.0, reverse=True)
    return flagged


@app.get("/api/history")
async def price_history(token: str, interval: str = "1m", fidelity: int = 1440):
    """Implied-probability time series for a market's Yes token (Polymarket CLOB)."""
    points = await client.get_price_history(token, interval=interval, fidelity=fidelity)
    return {"history": points}
