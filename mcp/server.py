"""Read-only Tickrr v1 MCP client. Run locally with TICKRR_API_BASE and TICKRR_API_KEY.
External access must be enabled under Tickrr's data agreements. Never exposes the key.
"""
from __future__ import annotations
import os
from urllib.parse import quote
import httpx
from mcp.server.fastmcp import FastMCP
API_BASE = os.environ.get('TICKRR_API_BASE', 'https://tickrr.tech').rstrip('/')
mcp = FastMCP('tickrr', instructions='Read Tickrr market evidence. Respect stale flags, null values, resolution rules and fees. Do not describe indicative prices as executable quotes or promise returns.')
async def _get(path: str, params: dict | None = None) -> dict:
    key = os.environ.get('TICKRR_API_KEY')
    if not key:
        raise ValueError('Configure TICKRR_API_KEY for licensed API access.')
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        response = await client.get(f'{API_BASE}{path}', params=params or {}, headers={'Authorization': f'Bearer {key}'})
        response.raise_for_status()
        return response.json()
@mcp.tool()
async def list_markets(cursor: int = 0) -> dict:
    """Page active markets, preserving source status, expiry, and nextCursor."""
    if cursor < 0 or cursor > 1000 or cursor % 100:
        raise ValueError('Use a cursor returned by Tickrr.')
    return await _get('/api/v1/markets', {'cursor': cursor})
@mcp.tool()
async def market_evidence(market_id: str, shares: int = 100) -> dict:
    """Read rules, depth, historical prices and warnings for an exact market ID."""
    if not 1 <= shares <= 100000 or len(market_id) > 160:
        raise ValueError('Invalid market or quantity.')
    return await _get('/api/v1/markets/' + quote(market_id, safe=''), {'shares': shares})
if __name__ == '__main__':
    mcp.run(transport='stdio')
