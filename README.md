# Tickrr

**Real-time trading analytics for sports markets — the Bloomberg Terminal for sports prediction markets.**

Tickrr turns live sports-market data into *decision-quality* intelligence: **fair-value ranges,
dislocation detection, cross-venue divergence, player dossiers, and cited "why did it move?"
explanations** — delivered as a dense, fast terminal plus an API and an MCP layer so AI agents
can consume the same signals.

We start with the **FIFA World Cup 2026** — the highest-volume, most-volatile sports-trading
event on the calendar and the perfect proving ground. From there Tickrr follows the money:
it **expands to global sporting events based on where trading interest and capital flow next**,
re-pointing the same engine at the leagues and tournaments with the most volume and volatility.

> **Intel only.** Tickrr never tells you to bet, buy, sell, or size a position, and it never
> executes trades. It tells you whether a price is decision-quality — and why it moved.

Built for the **Build with Gemini XPRIZE** (category: Professional Services), powered by
**Gemini** and designed to run on **Google Cloud**.

---

## What it does

| Capability | What you get |
|---|---|
| **Dislocation Radar** | Live edge signals — momentum, overreaction, thin-book/liquidity traps — ranked by severity the moment they appear. |
| **Cross-Venue Divergence** | Polymarket vs Kalshi on the *same* outcome, with the gap computed so you see which book is mispriced. |
| **Fair Value** | Every market normalized to a comparable probability with a liquidity- and spread-aware fair range. |
| **Player Dossiers** | Per-player tickers (Golden Boot, to-score, assists) mapped to national teams, plus a live Wikipedia attention signal. |
| **Real Price History** | Implied-probability charts straight from the Polymarket CLOB. |
| **Deliberation Room** *(Pro)* | Two grounded Gemini experts argue your stance — one for, one against — facts only. |
| **"Why it moved" intel** | Gemini + Google Search grounding explains market moves with citations. |
| **Autonomous growth engine** | An agent drafts social posts from live signals; you approve; approved posts auto-publish to free channels. See below. |

---

## Architecture

Monorepo, two services:

| Path | Role |
|---|---|
| `backend/` | **Python · FastAPI** — the intelligence engine: data ingestion, fair-value, dislocation & divergence detection, player index. Serves the read API on `:8000`. |
| `web/` | **Vite · React 19 · Tailwind v4 · Express** — the terminal UI + a thin Node server (`:3000`) that fronts Gemini, Stripe, and the growth engine, and proxies market data from the backend. |
| `docs/` | Operational guides (e.g. `CLOUD_SCHEDULER.md`). |

**Data sources (derived analytics only):**
- **Polymarket** — Gamma + CLOB public APIs (primary; ToS permits derived, customer-facing outputs).
- **Kalshi** — used for **derived cross-venue analytics + attributed link-out only** (their Data ToS bars raw redistribution).
- **Wikimedia pageviews** — a free attention/buzz signal.

### Gemini + Google Cloud

- **Gemini** (`@google/genai`, model `gemini-2.5-flash`) powers the "why it moved" intel, the
  Deliberation Room, and social-post drafting — with **Google Search grounding** for cited,
  fresh answers. Runs in a graceful mock mode when no key is present, so the app is always demoable.
- **Runs on Google Cloud Run** (two services: `tickrr-api` + `tickrr-web`), with **Google Cloud
  Scheduler** driving the autonomous growth loop on a free-tier cadence. One-command deploy via
  [`deploy.sh`](deploy.sh) — see [`docs/DEPLOY.md`](docs/DEPLOY.md) and
  [`docs/CLOUD_SCHEDULER.md`](docs/CLOUD_SCHEDULER.md).

---

## Autonomous growth engine (free-tier)

Tickrr markets itself with a human-in-the-loop agent — everything except your approval is automated:

```
Scheduler (Cloud Scheduler or in-process) ─▶ agent drafts posts from live market signals
        └─ pings you on Discord ◀── notify ◀───────────────┘
you approve in the in-app console ─▶ auto-publish to Discord + Bluesky + Buffer (X / LinkedIn / Instagram)
```

- Drafts are generated from real dislocation/divergence signals and are **intel-only** by construction.
- Publishing runs in **dry-run** until you add free credentials, so the loop is safe to demo.
- **Buffer** reaches X / LinkedIn / Instagram through official-partner credentials, staying inside
  the free tier (100 req/24h, 3,000/30d).

---

## Quickstart

**Backend** (Python 3.11+, PowerShell):
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```
Health check: http://127.0.0.1:8000/healthz · Docs: http://127.0.0.1:8000/docs

**Web** (Node 20+):
```powershell
cd web
npm install
cp .env.example .env   # optional: add keys to leave demo mode
npm run dev
```
Open http://localhost:3000 (the web server proxies market data from the backend on `:8000`).

---

## Environment (`web/.env`)

All optional — without them the app runs in free/demo/dry-run mode. See `web/.env.example`.

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Enables live Gemini intel (else mock). |
| `STRIPE_SECRET_KEY` | Enables real Stripe Checkout (else demo unlock). |
| `MARKET_API` | Backend base URL (default `http://localhost:8000`). |
| `DISCORD_WEBHOOK_URL` / `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` | Free publishing channels. |
| `BUFFER_ACCESS_TOKEN` / `BUFFER_CHANNEL_IDS` | Buffer → X / LinkedIn / Instagram. |
| `GROWTH_CRON_SECRET` / `GROWTH_NOTIFY_WEBHOOK` / `GROWTH_AUTODRAFT` | Scheduled autonomous drafting. |

---

## API surface

**Backend (`:8000`)** — `GET /api/markets`, `/api/dislocations`, `/api/history`, `/api/player`, `/healthz`.

**Web (`:3000`)** — `POST /api/insights`, `/api/deliberate`; billing `GET /api/plans`, `POST /api/checkout`;
growth `GET /api/growth/drafts`, `POST /api/growth/generate`, `POST /api/growth/drafts/:id/:action`,
`POST /api/growth/cron`, `GET /api/growth/buffer/channels`.

---

## Themes

Two looks, one interface: the default **dark terminal**, and a **monochrome light mode**
(white / black / greys only) toggled from the header and persisted locally.

---

## Legal & responsible use

Tickrr provides **informational market analytics only**. It is **not** financial, investment, or
betting advice, and it does **not** execute trades. Prediction markets involve risk; 18+/21+ where
applicable. Kalshi data is used for derived analytics and attributed link-out only, per their Data ToS.

## License

[Apache License 2.0](LICENSE) © Ticker Labs.
