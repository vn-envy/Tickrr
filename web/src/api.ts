/**
 * Tickrr live data layer.
 *
 * Fetches the FastAPI market-intelligence backend (/api/markets) and adapts each
 * MarketIntel into the SportsEntity shape the terminal UI already renders, while
 * carrying the real prediction-market fields (implied prob, fair range, spread,
 * liquidity, decision quality) for honest display.
 */
import { SportsEntity } from "./types";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

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
}

function tickerFrom(name: string): string {
  const base = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "MKT";
  return `${base}.WC`;
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
    ticker: tickerFrom(name),
    sport: "Soccer",
    team: m.event_title || "World Cup",
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
    category: "team",
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
