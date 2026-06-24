# Tickrr

**Prediction & event intelligence, delivered as a professional service** — "the Bloomberg
terminal for prediction markets."

Tickrr turns live prediction-market data (Polymarket now; Kalshi pending a data license)
into *decision-quality* intelligence: **fair-value ranges, dislocation detection, event
simulation, and cited "why did it move?" explanations** — exposed three ways: a **Terminal**
(web UI), an **API**, and an **MCP server** (so AI agents can consume it too).

Built for the **Build with Gemini XPRIZE**. **Intel only — Tickrr never places trades.**

## Monorepo layout
| Path | Role |
|---|---|
| `backend/` | Python **FastAPI** service — the intelligence engine, data ingestion, and the API. |
| `web/` | **Next.js** terminal UI (added next). |

## Backend quickstart (Windows / PowerShell)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/healthz and the interactive docs at http://127.0.0.1:8000/docs

## Status
Day-1 MVP scaffold: deterministic **fair-value engine** + **Polymarket ingest** + a
**market-intelligence API**. Dislocation detector, Gemini "why it moved", simulator, and the
Next.js terminal are the next increments (see `../.claude/plans/`).

## Not financial advice
Tickrr provides informational market analytics only. It is **not** financial, investment, or
betting advice, and it does not execute trades. Prediction markets involve risk; 18+/21+ where
applicable.
