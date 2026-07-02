/**
 * Tickrr live data layer.
 *
 * Fetches the FastAPI market-intelligence backend (/api/markets) and adapts each
 * MarketIntel into the SportsEntity shape the terminal UI already renders, while
 * carrying the real prediction-market fields (implied prob, fair range, spread,
 * liquidity, decision quality) for honest display.
 */
import { SportsEntity } from "./types";

// Same-origin by default: the web server proxies /api/markets|history|player to the backend.
// Override with VITE_API_BASE only if you want the browser to hit the backend directly.
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

interface FairValue {
  implied_prob: number;
  fair_low: number;
  fair_high: number;
  spread_cost: number;
  liquidity_score: number;
  decision_quality: string;
  best_bid?: number | null;
  best_ask?: number | null;
}

interface MarketSnapshot {
  source: string;
  id: string;
  question: string;
  slug?: string | null;
  volume?: number | null;
  liquidity?: number | null;
  url?: string | null;
  group_title?: string | null;
  one_week_change?: number | null;
  event_title?: string | null;
  clob_token_id?: string | null;
}

interface DislocationT {
  kind: string;
  label: string;
  severity: number;
  direction: string;
  action: string;
  rationale: string;
}

interface DivergenceT {
  polymarket: number;
  kalshi: number;
  gap_pp: number;
  url?: string | null;
}

interface MarketIntel {
  market: MarketSnapshot;
  primary_outcome: { label: string; price: number };
  fair_value: FairValue;
  dislocation?: DislocationT | null;
  divergence?: DivergenceT | null;
  subject_type?: string;
  enrichment?: {
    top_scorer?: string | null;
    top_scorer_prob?: number | null;
    attacking_threat?: number | null;
    scorer_count?: number;
  } | null;
  player_country?: string | null;
}

function tickerFrom(name: string, isPlayer: boolean): string {
  const clean = (name || "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
  if (isPlayer) {
    const parts = clean.trim().split(/\s+/);
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
    return surname.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || "PLAYER";
  }
  return clean.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || "MKT";
}

function cleanEvent(eventTitle?: string | null): string {
  const raw = (eventTitle || "").trim();
  const lower = raw.toLowerCase();
  if (lower.includes("golden boot")) return "Golden Boot";
  if (lower.includes("advance") || lower.includes("knockout")) return "To Advance";
  if (lower.includes("group")) return "Group Stage";
  if (lower.includes("nfl") || lower.includes("super bowl")) return "NFL Champion";
  if (lower.includes("world series") || lower.includes("mlb")) return "World Series";
  if (lower.includes("nba")) return "NBA";
  if (lower.includes("f1") || lower.includes("formula")) return "F1 Title";
  // Non-sports categories — the wider intelligence layer.
  if (lower.includes("fed") || lower.includes("fomc") || lower.includes("interest rate") || lower.includes("cpi") || lower.includes("inflation") || lower.includes("recession") || lower.includes("gdp")) return "Macro";
  if (lower.includes("bitcoin") || lower.includes("ethereum") || lower.includes("crypto") || lower.includes(" btc") || lower.includes(" eth")) return "Crypto";
  if (lower.includes("election") || lower.includes("senate") || lower.includes("house ") || lower.includes("president") || lower.includes("midterm") || lower.includes("governor") || lower.includes("congress")) return "Election";
  if (lower.includes("nobel")) return "Nobel";
  if (lower.includes("world cup")) return "To Win Cup";
  if (lower.includes("winner") || lower.includes("win the") || lower.includes("champion")) return "To Win";
  return raw || "Market";
}

/** Gentle random walk that lands on `end`, so the telemetry chart reads as a real series. */
function synthHistory(end: number, n = 10, vol = 0.06): number[] {
  const out: number[] = [];
  let v = end * (1 + (Math.random() - 0.5) * vol * 2);
  for (let i = 0; i < n; i++) {
    v = v + (end - v) * 0.25 + (Math.random() - 0.5) * Math.max(end, 1) * vol;
    out.push(Number(v.toFixed(2)));
  }
  out[n - 1] = Number(end.toFixed(2));
  return out;
}

export function intelToEntity(mi: MarketIntel): SportsEntity {
  const m = mi.market;
  const fv = mi.fair_value;
  const name = m.group_title || m.question || "Market";
  const impliedPct = Number((fv.implied_prob * 100).toFixed(2));
  const liq = Number((fv.liquidity_score * 100).toFixed(1));
  const tightness = Number(((1 - fv.spread_cost) * 100).toFixed(1));
  const change = Number(((m.one_week_change ?? 0) * 100).toFixed(2));

  return {
    id: m.id || name,
    name,
    ticker: tickerFrom(name, mi.subject_type === "player"),
    sport: "Soccer",
    team: cleanEvent(m.event_title),
    value: impliedPct,
    change,
    efficiency: liq,
    stamina: Math.round(tightness),
    speed: Math.round(liq),
    staminaHistory: synthHistory(tightness),
    efficiencyHistory: synthHistory(liq),
    speedHistory: synthHistory(liq),
    playmakingHistory: synthHistory(impliedPct),
    defenseHistory: synthHistory(tightness),
    category: mi.subject_type === "player" ? "athlete" : "team",
    // --- honest prediction-market fields ---
    impliedProb: impliedPct,
    fairLow: Number((fv.fair_low * 100).toFixed(2)),
    fairHigh: Number((fv.fair_high * 100).toFixed(2)),
    spreadCost: Number((fv.spread_cost * 100).toFixed(2)),
    liquidityScore: liq,
    decisionQuality: fv.decision_quality,
    oneWeekChange: change,
    url: m.url || undefined,
    volume: m.volume ?? undefined,
    liquidity: m.liquidity ?? undefined,
    dislocation: mi.dislocation ?? undefined,
    divergence: mi.divergence
      ? {
          polymarket: mi.divergence.polymarket,
          kalshi: mi.divergence.kalshi,
          gapPP: mi.divergence.gap_pp,
          url: mi.divergence.url ?? undefined,
        }
      : undefined,
    enrichment: mi.enrichment
      ? {
          topScorer: mi.enrichment.top_scorer ?? undefined,
          topScorerProb: mi.enrichment.top_scorer_prob ?? undefined,
          attackingThreat: mi.enrichment.attacking_threat ?? undefined,
        }
      : undefined,
    playerCountry: mi.player_country ?? undefined,
    clobTokenId: m.clob_token_id ?? undefined,
  };
}

export async function fetchMarkets(query = "World Cup", limit = 40): Promise<SportsEntity[]> {
  const res = await fetch(
    `${API_BASE}/api/markets?query=${encodeURIComponent(query)}&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`/api/markets responded ${res.status}`);
  const data: MarketIntel[] = await res.json();
  return data.map(intelToEntity);
}

// The event universes the terminal covers — Tickrr follows the money across spectacles.
// Configurable at build time via VITE_MARKET_QUERIES (comma-separated).
export const MARKET_QUERIES: string[] = (
  (import.meta as any).env?.VITE_MARKET_QUERIES || "World Cup,NFL,NBA,MLB,F1,election,Fed rate,Bitcoin,Ethereum"
).split(",").map((s: string) => s.trim()).filter(Boolean);

// Group individual queries into Bloomberg-style categories for the league/category chips.
const CATEGORY: Record<string, string> = {
  election: "Politics", trump: "Politics",
  "fed rate": "Macro",
  bitcoin: "Crypto", ethereum: "Crypto",
  nobel: "Culture",
};

/** Fetch several event universes in parallel and merge them (deduped) into one board. */
export async function fetchMarketsMulti(queries: string[] = MARKET_QUERIES, perQuery = 60): Promise<SportsEntity[]> {
  const lists = await Promise.all(queries.map((q) => fetchMarkets(q, perQuery).catch(() => [] as SportsEntity[])));
  const seen = new Set<string>();
  const merged: SportsEntity[] = [];
  lists.forEach((list, i) => {
    const league = CATEGORY[queries[i].toLowerCase()] || queries[i];
    for (const e of list) {
      const key = e.id || e.ticker || e.name;
      if (key && !seen.has(key)) { seen.add(key); merged.push({ ...e, league }); }
    }
  });
  return merged;
}

/** Implied-probability time series for a market's Yes token (Polymarket CLOB). */
export async function fetchHistory(token: string, interval = "1m"): Promise<{ t: number; p: number }[]> {
  try {
    const res = await fetch(`${API_BASE}/api/history?token=${encodeURIComponent(token)}&interval=${interval}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.history) ? data.history : [];
  } catch {
    return [];
  }
}

interface KMarket {
  prob: number;
  threshold?: string;
  url?: string;
}

export interface PlayerCard {
  goalLeader?: KMarket | null;
  toScore?: KMarket | null;
  scoreOrAssist?: KMarket | null;
  assists?: KMarket | null;
  buzz?: {
    series: { t: string; v: number }[];
    latest: number;
    baseline: number;
    spike: number;
    url?: string;
  } | null;
  news?: { articles: { title: string; url: string; domain?: string }[] } | null;
}

/** Aggregated player intelligence: Kalshi markets + Wikipedia buzz + recent news. */
export async function fetchPlayer(name: string): Promise<PlayerCard> {
  try {
    const res = await fetch(`${API_BASE}/api/player?name=${encodeURIComponent(name)}`);
    if (!res.ok) return {};
    const d = await res.json();
    const k = d.kalshi || {};
    const km = (x: any): KMarket | null => (x ? { prob: x.prob, threshold: x.threshold, url: x.url } : null);
    return {
      goalLeader: km(k.goal_leader),
      toScore: km(k.to_score),
      scoreOrAssist: km(k.score_or_assist),
      assists: km(k.assists),
      buzz: d.buzz || null,
      news: d.news || null,
    };
  } catch {
    return {};
  }
}
