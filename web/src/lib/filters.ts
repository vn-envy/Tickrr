/**
 * Terminal filter state — the single source of truth behind the Bloomberg-style command
 * rail. Every insight surface (ticker, radar, screener, pulse, charts) renders from the
 * same filtered universe, so one selection on the rail re-scopes the whole terminal.
 */
import { SportsEntity } from "../types";

export type SortKey = "prob" | "move" | "edge" | "liquidity" | "volume";

export interface TerminalFilters {
  scope: string;                       // "all" | league/category (e.g. "World Cup", "Macro")
  category: "all" | "athlete" | "team";
  search: string;
  minLiquidity: number;                // 0..100 — hide books thinner than this
  minEdge: number;                     // 0..10 pp — |gap vs books/Kalshi| threshold (0 = off)
  probRange: [number, number];         // implied-probability window, %
  quality: "all" | "good" | "fair" | "thin";
  watchlistOnly: boolean;
  signalsOnly: boolean;                // only markets with a live dislocation signal
  sortBy: SortKey;
  sortDir: "desc" | "asc";
}

export const DEFAULT_FILTERS: TerminalFilters = {
  scope: "all",
  category: "all",
  search: "",
  minLiquidity: 0,
  minEdge: 0,
  probRange: [0, 100],
  quality: "all",
  watchlistOnly: false,
  signalsOnly: false,
  // Volume-ranked by default: the most-traded (most meaningful) markets lead the board,
  // instead of a wall of near-settled 100% quotes.
  sortBy: "volume",
  sortDir: "desc",
};

/** Edge = gap vs the sportsbook consensus when the books price it, else vs Kalshi. */
export function edgeOf(e: SportsEntity): number | undefined {
  return e.divergence?.booksGapPP ?? e.divergence?.gapPP;
}

function sortValue(e: SportsEntity, key: SortKey): number {
  switch (key) {
    case "prob": return e.impliedProb ?? e.value;
    case "move": return e.oneWeekChange ?? e.change;
    case "edge": return Math.abs(edgeOf(e) ?? 0);
    case "liquidity": return e.liquidityScore ?? e.efficiency;
    case "volume": return e.volume ?? 0;
  }
}

/** Apply the rail's filters + sort to the full market universe. */
export function applyFilters(
  entities: SportsEntity[],
  f: TerminalFilters,
  favorites: Set<string>,
): SportsEntity[] {
  const q = f.search.trim().toLowerCase();
  const out = entities.filter((e) => {
    if (f.scope !== "all" && (e.league || "") !== f.scope) return false;
    if (f.category !== "all" && e.category !== f.category) return false;
    if (q) {
      const hay = `${e.name} ${e.ticker} ${e.team} ${e.league || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const prob = e.impliedProb ?? e.value;
    if (prob < f.probRange[0] || prob > f.probRange[1]) return false;
    if (f.minLiquidity > 0 && (e.liquidityScore ?? e.efficiency) < f.minLiquidity) return false;
    if (f.minEdge > 0) {
      const edge = edgeOf(e);
      if (edge == null || Math.abs(edge) < f.minEdge) return false;
    }
    if (f.quality !== "all" && (e.decisionQuality || "") !== f.quality) return false;
    if (f.watchlistOnly && !favorites.has(e.id)) return false;
    if (f.signalsOnly && !e.dislocation) return false;
    return true;
  });

  const dir = f.sortDir === "desc" ? -1 : 1;
  return out.sort((a, b) => dir * (sortValue(a, f.sortBy) - sortValue(b, f.sortBy)));
}

/** How many filters differ from the defaults — powers the mobile FILTERS badge. */
export function activeFilterCount(f: TerminalFilters): number {
  let n = 0;
  if (f.scope !== "all") n++;
  if (f.category !== "all") n++;
  if (f.search.trim()) n++;
  if (f.minLiquidity > 0) n++;
  if (f.minEdge > 0) n++;
  if (f.probRange[0] > 0 || f.probRange[1] < 100) n++;
  if (f.quality !== "all") n++;
  if (f.watchlistOnly) n++;
  if (f.signalsOnly) n++;
  return n;
}
