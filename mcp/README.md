# Tickrr MCP server

Lets any AI agent (Claude, Gemini, custom) consume Tickrr's derived prediction-market
intelligence as **tools** — a thin, read-only wrapper over the Tickrr REST API. On-theme for the
Gemini XPRIZE: *our customers include other AI agents.*

> **Intel only.** Tools return analysis — never instructions to bet/buy/sell or size a position,
> and never a promised outcome. Kalshi figures are derived analytics + an attributed link.

## Tools

| Tool | What it returns |
|------|-----------------|
| `list_markets(query, limit)` | Fair-value read per market — implied prob, liquidity-adjusted fair range, spread cost, decision quality, cross-venue gap when one exists. |
| `list_dislocations(query, limit)` | Markets flagged with a dislocation (momentum, thin-liquidity trap, cross-venue gap), most severe first. |
| `list_divergences(query?, top)` | Cross-venue gaps — the same question priced on Polymarket, Kalshi and/or the sportsbook consensus (The Odds API), ranked by gap (pp). Omit `query` to sweep sports + macro + crypto. |
| `get_calendar(category?, limit)` | Upcoming catalysts (FOMC, CPI, finals, elections), optionally filtered to a category. |

Every row is a **verified like-for-like pair** (same team / price threshold / meeting outcome) —
the matcher never compares mismatched questions.

## Run locally (stdio — Claude Desktop / Cursor)

```bash
cd mcp
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # (bin/pip on macOS/Linux)
TICKRR_API_BASE=http://localhost:8000 .venv/Scripts/python server.py
```

**Claude Desktop** (`claude_desktop_config.json`) / **Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "tickrr": {
      "command": "C:/Users/you/tickrr/mcp/.venv/Scripts/python.exe",
      "args": ["C:/Users/you/tickrr/mcp/server.py"],
      "env": { "TICKRR_API_BASE": "http://localhost:8000" }
    }
  }
}
```

(Point `TICKRR_API_BASE` at your deployed Tickrr API to use live cloud data instead of localhost.)

## Run remote (streamable-HTTP — for agents over the network / Cloud Run)

```bash
TICKRR_MCP_TRANSPORT=http TICKRR_API_BASE=https://<your-tickrr-api-host> PORT=8080 python server.py
# MCP endpoint: http://<host>:8080/mcp
```

### Deploy to Cloud Run

```bash
gcloud run deploy tickrr-mcp \
  --source mcp \
  --region us-central1 --allow-unauthenticated \
  --set-env-vars "TICKRR_API_BASE=https://<your-tickrr-api-host>"
```

The container serves streamable-HTTP on `$PORT` (Cloud Run sets 8080). Agents connect to
`https://<mcp-host>/mcp`.

## Environment

| Var | Default | Meaning |
|-----|---------|---------|
| `TICKRR_API_BASE` | `http://localhost:8000` | Tickrr REST API base URL. |
| `TICKRR_MCP_TRANSPORT` | `stdio` | `stdio` (local agents) or `http` (remote/Cloud Run). |
| `TICKRR_MCP_TIMEOUT` | `30` | Per-request timeout (seconds). |
| `PORT` | `8080` | Port for the HTTP transport. |
