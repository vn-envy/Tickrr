"""Wikimedia per-entity attention / "buzz" signal — FREE, keyless, CC0, commercial-OK.

Daily Wikipedia pageviews are a clean leading indicator: an attention spike (news, a goal, an
injury rumour) often precedes a market move. We resolve the canonical article title via the
MediaWiki opensearch API (handles accents: "Kylian Mbappe" -> "Kylian Mbappé"), then pull the
per-article daily pageviews. Both calls are cached; everything is best-effort (returns None on
failure so the dossier just hides the section).
"""
from __future__ import annotations

import datetime
import statistics
import time
from urllib.parse import quote

import httpx

_UA = "Tickrr/0.1 (https://github.com/vn-envy/Verdict; nvatsa@adobe.com)"
_TITLE_CACHE: dict[str, str | None] = {}
_BUZZ_CACHE: dict[str, dict] = {}  # name -> {"ts": float, "data": dict | None}
_TTL_S = 1800.0  # pageviews update ~daily; 30-min cache is plenty


async def _resolve_title(name: str) -> str | None:
    if name in _TITLE_CACHE:
        return _TITLE_CACHE[name]
    title: str | None = None
    try:
        async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": _UA}) as c:
            r = await c.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action": "opensearch", "search": name, "limit": 1, "namespace": 0, "format": "json"},
            )
            r.raise_for_status()
            data = r.json()
            if len(data) > 1 and data[1]:
                title = data[1][0]
    except Exception:
        title = None
    _TITLE_CACHE[name] = title
    return title


async def buzz(name: str) -> dict | None:
    """Daily pageviews series + spike (recent peak vs 3-week median) for a player/team name."""
    now = time.time()
    cached = _BUZZ_CACHE.get(name)
    if cached and now - cached["ts"] < _TTL_S:
        return cached["data"]

    title = await _resolve_title(name)
    data: dict | None = None
    if title:
        end = datetime.date.today()
        start = end - datetime.timedelta(days=21)
        art = quote(title.replace(" ", "_"), safe="")
        url = (
            "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
            f"en.wikipedia.org/all-access/all-agents/{art}/daily/"
            f"{start.strftime('%Y%m%d')}/{end.strftime('%Y%m%d')}"
        )
        try:
            async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": _UA}) as c:
                r = await c.get(url)
                r.raise_for_status()
                items = r.json().get("items", [])
        except Exception:
            items = []
        series = [{"t": it["timestamp"][:8], "v": int(it["views"])} for it in items]
        if series:
            vals = [p["v"] for p in series]
            recent = max(vals[-3:])              # robust to the partial current day
            baseline = statistics.median(vals) or recent
            data = {
                "series": series[-14:],
                "latest": recent,  # recent peak (robust to the partial current day)
                "baseline": int(baseline),
                "spike": round(recent / baseline, 2) if baseline else 1.0,
                "title": title,
                "url": f"https://en.wikipedia.org/wiki/{art}",
            }

    _BUZZ_CACHE[name] = {"ts": now, "data": data}
    return data
