"""GDELT 2.0 news signal — FREE, no key, commercial-OK (attribution). Best-effort.

Per-entity recent news headlines (the "why it moved" behind a buzz/odds spike). GDELT is
heavily rate-limited (HTTP 429s), so this is strictly best-effort: a single artlist call,
cached for 30 min, returning None on any failure so the dossier hides the section.
"""
from __future__ import annotations

import time

import httpx

_UA = "Tickrr/0.1 (https://github.com/vn-envy/Verdict; nvatsa@adobe.com)"
_CACHE: dict[str, dict] = {}  # name -> {"ts": float, "data": dict | None}
_TTL_S = 1800.0


async def news(name: str) -> dict | None:
    now = time.time()
    cached = _CACHE.get(name)
    if cached and now - cached["ts"] < _TTL_S:
        return cached["data"]

    query = f'"{name}" (soccer OR football OR "World Cup")'
    data: dict | None = None
    try:
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": _UA}) as c:
            r = await c.get(
                "https://api.gdeltproject.org/api/v2/doc/doc",
                params={
                    "query": query,
                    "mode": "artlist",
                    "maxrecords": 5,
                    "timespan": "3d",
                    "sort": "datedesc",
                    "format": "json",
                },
            )
            if r.status_code == 200:
                try:
                    arts = r.json().get("articles", [])
                except Exception:
                    arts = []
                articles = [
                    {"title": a.get("title"), "url": a.get("url"), "domain": a.get("domain")}
                    for a in arts[:3]
                    if a.get("title") and a.get("url")
                ]
                if articles:
                    data = {"articles": articles}
    except Exception:
        data = None

    _CACHE[name] = {"ts": now, "data": data}
    return data
