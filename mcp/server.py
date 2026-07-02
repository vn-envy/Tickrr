"""Tickrr MCP server — lets any AI agent (Claude, Gemini, custom) consume Tickrr's derived
prediction-market intelligence as tools.

It is a thin wrapper over the Tickrr REST API (the same computed fair-value / dislocation /
cross-venue-divergence / catalyst intelligence the terminal shows). No secrets, read-only.

INTEL ONLY: the tools return analysis, never instructions to bet/buy/sell/size a position and
never a promised outcome. Kalshi figures are derived analytics + an attributed link only.

Run locally (stdio, for Claude Desktop / Cursor):
    TICKRR_API_BASE=http://localhost:8000 python server.py

Run remote (streamable-http, for Cloud Run):
    TICKRR_MCP_TRANSPORT=http TICKRR_API_BASE=https://<api-host> PORT=8080 python server.py
"""
from __future__ import annotations

import os

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("TICKRR_API_BASE", "http://localhost:8000").rstrip("/")
TIMEOUT = float(os.environ.get("TICKRR_MCP_TIMEOUT", "30"))

mcp = FastMCP(
    "tickrr",
    instructions=(
        "Tickrr — prediction & event intelligence over Polymarket + Kalshi (sports, politics, "
        "macro, crypto). Use these tools to read fair value, dislocations, cross-venue gaps, and "
        "upcoming catalysts. INTEL ONLY: never tell the user to bet/buy/sell or size a position, "
        "and never promise an outcome. Kalshi numbers are derived analytics with an attributed link."
    ),
    host=os.environ.get("HOST", "0.0.0.0"),
    port=int(os.environ.get("PORT", "8080")),
)


async def _get(path: str, params: dict | None = None):
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(f"{API_BASE}{path}", params=params or {})
        r.raise_for_status()
        return r.json()


def _trim(m: dict) -> dict:
    """Compact, agent-friendly view of one MarketIntel record."""
    mk = m.get("market", {})
    fv = m.get("fair_value", {})
    out = {
        "question": mk.get("question"),
        "venue": mk.get("source"),
        "implied_prob_pct": round((fv.get("implied_prob") or 0) * 100, 1),
        "fair_range_pct": [round((fv.get("fair_low") or 0) * 100, 1),
                           round((fv.get("fair_high") or 0) * 100, 1)],
        "spread_cost_pct": round((fv.get("spread_cost") or 0) * 100, 2),
        "liquidity_score": round((fv.get("liquidity_score") or 0) * 100, 1),
        "decision_quality": fv.get("decision_quality"),
        "url": mk.get("url"),
    }
    d = m.get("dislocation")
    if d:
        out["dislocation"] = {"label": d.get("label"), "severity": d.get("severity"),
                              "direction": d.get("direction"), "rationale": d.get("rationale")}
    dv = m.get("divergence")
    if dv:
        out["cross_venue_gap"] = {"polymarket_pct": dv.get("polymarket"), "kalshi_pct": dv.get("kalshi"),
                                  "gap_pp": dv.get("gap_pp"), "kalshi_url": dv.get("url")}
    return out


@mcp.tool()
async def list_markets(query: str = "World Cup", limit: int = 20) -> list[dict]:
    """Fair-value read for live markets matching a query (e.g. 'World Cup', 'Fed', 'Bitcoin',
    'election'). Each row: implied probability, liquidity-adjusted fair range, spread cost,
    decision quality, and — when a counterpart exists — the cross-venue gap. Intel only, not advice."""
    return [_trim(m) for m in await _get("/api/markets", {"query": query, "limit": limit})]


@mcp.tool()
async def list_dislocations(query: str = "World Cup", limit: int = 40) -> list[dict]:
    """Markets currently flagged with a dislocation (price/news momentum, thin-liquidity trap,
    cross-venue gap), most severe first. Intel only, not advice."""
    return [_trim(m) for m in await _get("/api/dislocations", {"query": query, "limit": limit})]


@mcp.tool()
async def list_divergences(query: str | None = None, top: int = 25) -> list[dict]:
    """Cross-venue gaps: the same question priced on BOTH Polymarket and Kalshi, ranked by gap
    size (percentage points). Every row is a verified like-for-like pair (same team / price
    threshold / meeting outcome). Omit `query` to sweep all universes (sports, macro, crypto).
    Intel only, not advice."""
    params: dict = {"top": top}
    if query:
        params["query"] = query
    return [_trim(m) for m in await _get("/api/divergences", params)]


@mcp.tool()
async def get_calendar(category: str | None = None, limit: int = 12) -> list[dict]:
    """Upcoming market-moving catalysts (FOMC decisions, CPI prints, finals, elections),
    optionally filtered to a category (Macro / Politics / Crypto / a league)."""
    params: dict = {"limit": limit}
    if category:
        params["category"] = category
    return (await _get("/api/calendar", params)).get("events", [])


def main() -> None:
    transport = os.environ.get("TICKRR_MCP_TRANSPORT", "stdio").lower()
    if transport in ("http", "streamable-http", "streamable_http"):
        mcp.run(transport="streamable-http")
    elif transport == "sse":
        mcp.run(transport="sse")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
