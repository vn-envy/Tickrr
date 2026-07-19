"""Tickrr API — FastAPI app.

Day-1 surface: health + a market-intelligence endpoint that pulls live Polymarket markets
and returns the deterministic fair-value read for each. Dislocation detection, the Gemini
"why did it move?" agent, the simulator, and auth/billing are the next increments.
"""
from __future__ import annotations

import asyncio
import re
import time

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import __version__
from app.config import settings
from app.data.polymarket import PolymarketClient
from app.data.kalshi import (
    KalshiClient, normalize_team, GOAL_LEADER_SERIES, ASSISTS_SERIES, GOAL_SERIES, SOA_SERIES,
    BTC_REACH_SERIES, ETH_REACH_SERIES, BTC_DIP_SERIES, ETH_DIP_SERIES,
)
from app.data.players import country_for
from app.data.oddsapi import OddsApiClient, sport_key_for
from app.data import wiki, gdelt, calendar
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
odds_client = OddsApiClient()  # sportsbook consensus (no-op without ODDS_API_KEY)


def _is_winner_event(s: MarketSnapshot) -> bool:
    """Only the 'World Cup Winner' event maps 1:1 to Kalshi's winner market — exclude
    advance/group/golden-boot events so we don't compare a win-price to a qualify-price."""
    et = (s.event_title or "").lower()
    return "winner" in et and "boot" not in et


def _is_outright_event(s: MarketSnapshot) -> bool:
    """Outright/championship events — the shape sportsbook futures markets price. Broader
    than `_is_winner_event` (NFL/NBA events say 'champion' rather than 'winner')."""
    et = (s.event_title or "").lower()
    return any(k in et for k in ("winner", "champion", "super bowl")) and "boot" not in et


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


# Cross-venue crypto match: Polymarket "Will {asset} reach/dip to $X by December 31, 2026?" is the
# same question as Kalshi's "how high/low this year — Above/Below $X". We only pair a parseable
# dollar threshold for 2026 with the matching direction — so a gap is always like-for-like
# (reach<->above, dip<->below; never reach-vs-below, never a different year).
_CRYPTO_YEAR = "2026"


def _crypto_key(s: MarketSnapshot) -> tuple[str, int, str] | None:
    """(asset, threshold, direction) for a Polymarket 2026 crypto price market, else None.
    direction is 'up' (reach) or 'down' (dip)."""
    q = (s.question or "").lower()
    if _CRYPTO_YEAR not in q:
        return None
    if "reach" in q:
        direction = "up"
    elif "dip" in q:
        direction = "down"
    else:
        return None
    if "bitcoin" in q:
        asset = "BTC"
    elif "ethereum" in q:
        asset = "ETH"
    else:
        return None
    m = re.search(r"\$([\d,]+)", q)
    if not m:
        return None
    return asset, int(m.group(1).replace(",", "")), direction


# Cross-venue Fed match: Polymarket "Fed Decision in {month}?" outcome <-> Kalshi KXFEDDECISION,
# keyed by (meeting year, month, outcome). Same decision, same meeting, same outcome.
_FED_POLY_OUTCOME = {
    "no change": "hold",
    "25 bps increase": "hike25",
    "50+ bps increase": "hike50",
    "25 bps decrease": "cut25",
    "50+ bps decrease": "cut50",
}


def _fed_key(s: MarketSnapshot) -> tuple[int, int, str] | None:
    """(year, month, outcome_code) for a Polymarket Fed-decision market, else None.
    Meeting month/year come from the resolution date (= the meeting date)."""
    if "fed decision" not in (s.event_title or "").lower():
        return None
    code = _FED_POLY_OUTCOME.get((s.group_title or "").strip().lower())
    ds = str(s.end_date or "")
    if not code or len(ds) < 7:
        return None
    return int(ds[:4]), int(ds[5:7]), code


def _intel(s: MarketSnapshot, kalshi_team: dict | None = None,
           kalshi_player: dict | None = None, player_index: dict | None = None,
           crypto_ref: dict | None = None, fed_ref: dict | None = None,
           books_ref: dict | None = None) -> MarketIntel:
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
    if kp is None and crypto_ref:
        ck = _crypto_key(s)
        if ck:
            asset, thr, direction = ck
            entry = ((crypto_ref.get(asset) or {}).get(direction) or {}).get(thr)
            if entry and entry.get("prob") is not None:
                kp, ku = entry["prob"], entry.get("url")
    if kp is None and fed_ref:
        fk = _fed_key(s)
        if fk:
            entry = fed_ref.get(fk)
            if entry and entry.get("prob") is not None:
                kp, ku = entry["prob"], entry.get("url")

    # Sportsbook consensus (The Odds API): only for team outright markets, where the books
    # price the identical question ("who wins the tournament/championship").
    books_entry = None
    if books_ref and subject == "team" and _is_outright_event(s):
        books_entry = books_ref.get(key)
    bp = books_entry.get("prob") if books_entry else None

    div = None
    if kp is not None or bp is not None:
        gap = (fv.implied_prob - kp) if kp is not None else (fv.implied_prob - bp)
        div = Divergence(
            polymarket=round(fv.implied_prob * 100, 1),
            kalshi=round(kp * 100, 1) if kp is not None else None,
            gap_pp=round(gap * 100, 1),
            url=ku,
            books=round(bp * 100, 1) if bp is not None else None,
            book_count=(books_entry or {}).get("book_count", 0),
            best_book=(books_entry or {}).get("best_book"),
            best_price=(books_entry or {}).get("best_price"),
            books_gap_pp=round((fv.implied_prob - bp) * 100, 1) if bp is not None else None,
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

    disloc = dislocation.detect(s, fv, kalshi_prob=kp, kalshi_url=ku,
                                books_prob=bp, book_count=(books_entry or {}).get("book_count", 0))
    player_country = country_for(s.group_title or s.question) if subject == "player" else None
    return MarketIntel(
        market=s, primary_outcome=primary, fair_value=fv,
        dislocation=disloc, divergence=div, subject_type=subject,
        enrichment=enr, player_country=player_country,
    )


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": __version__, "env": settings.tickrr_env}


# Short-lived cache of built intel per (query, limit) — the multi-category board fires many
# queries, and Polymarket + enrichment is the slow part. Keeps repeat loads instant + cuts load.
_INTEL_CACHE: dict[str, tuple[float, list[MarketIntel]]] = {}
_INTEL_TTL = 90.0  # seconds


async def _build_intel(query: str, limit: int) -> list[MarketIntel]:
    key = f"{query.lower()}|{limit}"
    now = time.monotonic()
    hit = _INTEL_CACHE.get(key)
    if hit and now - hit[0] < _INTEL_TTL:
        return hit[1]
    snapshots = await client.search_markets(query=query, limit=limit)
    ql = query.lower()
    is_wc = "world cup" in ql
    is_crypto = any(k in ql for k in ("bitcoin", "ethereum", "btc", "eth", "crypto"))
    is_macro = any(k in ql for k in ("fed", "fomc", "rate", "interest"))
    kalshi_team = await kalshi_client.get_winner_probs() if is_wc else {}
    kalshi_player = await kalshi_client.get_winner_probs(series=GOAL_LEADER_SERIES) if is_wc else {}
    player_index = _build_player_index(snapshots) if is_wc else {}
    crypto_ref = None
    if is_crypto:
        btc_up, eth_up, btc_dn, eth_dn = await asyncio.gather(
            kalshi_client.get_reach_probs(BTC_REACH_SERIES),
            kalshi_client.get_reach_probs(ETH_REACH_SERIES),
            kalshi_client.get_dip_probs(BTC_DIP_SERIES),
            kalshi_client.get_dip_probs(ETH_DIP_SERIES),
        )
        crypto_ref = {"BTC": {"up": btc_up, "down": btc_dn}, "ETH": {"up": eth_up, "down": eth_dn}}
    fed_ref = await kalshi_client.get_fed_decision_probs() if is_macro else None
    # Sportsbook consensus for this universe, when the books have an outright market for it.
    books_ref = await odds_client.get_consensus(sport_key_for(query) or "", normalize=normalize_team)
    intel = [_intel(s, kalshi_team, kalshi_player, player_index, crypto_ref, fed_ref, books_ref) for s in snapshots]
    _INTEL_CACHE[key] = (now, intel)
    return intel


@app.get("/api/markets", response_model=list[MarketIntel])
async def list_markets(
    query: str = Query("World Cup", description="Event-title filter"),
    limit: int = Query(30, ge=1, le=100),
):
    """Live market intelligence: matching markets + each one's fair-value read."""
    return await _build_intel(query, limit)


@app.get("/api/dislocations", response_model=list[MarketIntel])
async def list_dislocations(
    query: str = Query("World Cup", description="Event-title filter"),
    limit: int = Query(60, ge=1, le=200),
):
    """The home board: only markets currently flagged with a dislocation, most severe first."""
    intel = await _build_intel(query, limit)
    flagged = [m for m in intel if m.dislocation is not None]
    flagged.sort(key=lambda m: m.dislocation.severity if m.dislocation else 0.0, reverse=True)
    return flagged


# Categories swept when /api/divergences is called without an explicit query — the live universes
# that currently have a cross-venue (Polymarket <-> Kalshi) counterpart.
_DIVERGENCE_QUERIES = ["World Cup", "Fed", "Bitcoin", "Ethereum"]


@app.get("/api/divergences", response_model=list[MarketIntel])
async def list_divergences(
    query: str | None = Query(None, description="One universe (e.g. Bitcoin). Omit to sweep all."),
    limit_per: int = Query(60, ge=1, le=200),
    top: int = Query(40, ge=1, le=200),
):
    """Cross-venue dislocations only: markets where the same question is priced on both
    Polymarket and Kalshi, ranked by the size of the gap (percentage points). Every row is a
    verified like-for-like pair (same team/threshold/meeting/outcome) — intel only, never a pick."""
    queries = [query] if query else _DIVERGENCE_QUERIES
    lists = await asyncio.gather(*[_build_intel(q, limit_per) for q in queries])
    rows = [m for lst in lists for m in lst if m.divergence is not None]
    rows.sort(key=lambda m: abs(m.divergence.gap_pp) if m.divergence else 0.0, reverse=True)
    return rows[:top]


@app.get("/api/calendar")
async def market_calendar(
    category: str | None = Query(None, description="Filter to one category, e.g. Macro / Politics"),
    limit: int = Query(12, ge=1, le=40),
):
    """Upcoming market-moving catalysts (the 'what to watch' behind the markets)."""
    return {"events": calendar.upcoming(category, limit)}


@app.get("/api/history")
async def price_history(token: str, interval: str = "1m", fidelity: int = 1440):
    """Implied-probability time series for a market's Yes token (Polymarket CLOB)."""
    points = await client.get_price_history(token, interval=interval, fidelity=fidelity)
    return {"history": points}


@app.get("/api/player")
async def player_card(name: str):
    """Aggregated player intelligence: Kalshi markets (goal-leader / to-score / goal+assist /
    assists), Wikipedia attention 'buzz', and recent news — fetched concurrently, best-effort."""
    key = normalize_team(name)
    gl, ast, goal, soa, buzz_d, news_d = await asyncio.gather(
        kalshi_client.get_winner_probs(series=GOAL_LEADER_SERIES),
        kalshi_client.get_threshold_probs(ASSISTS_SERIES),
        kalshi_client.get_threshold_probs(GOAL_SERIES),
        kalshi_client.get_threshold_probs(SOA_SERIES),
        wiki.buzz(name),
        gdelt.news(name),
        return_exceptions=True,
    )

    def pick(result) -> dict | None:
        if not isinstance(result, dict):
            return None
        entry = result.get(key)
        if not entry:
            return None
        out = {"prob": round(entry["prob"] * 100, 1), "url": entry.get("url")}
        if entry.get("threshold"):
            out["threshold"] = entry["threshold"]
        return out

    return {
        "name": name,
        "kalshi": {
            "goal_leader": pick(gl),
            "to_score": pick(goal),
            "score_or_assist": pick(soa),
            "assists": pick(ast),
        },
        "buzz": buzz_d if isinstance(buzz_d, dict) else None,
        "news": news_d if isinstance(news_d, dict) else None,
    }
