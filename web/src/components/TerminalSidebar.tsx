import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw, Search, SlidersHorizontal, Star } from "lucide-react";
import { SportsEntity } from "../types";
import { getFavorites, onFavoritesChange, toggleFavorite } from "../lib/watchlist";

export type MarketSort = "signal" | "edge" | "move" | "liquidity" | "volume";

export interface TerminalFilters {
  query: string;
  league: string;
  quality: "all" | "good" | "fair" | "thin";
  category: "all" | "athlete" | "team";
  minEdge: number;
  favoritesOnly: boolean;
  sort: MarketSort;
}

export const DEFAULT_TERMINAL_FILTERS: TerminalFilters = {
  query: "",
  league: "all",
  quality: "all",
  category: "all",
  minEdge: 0,
  favoritesOnly: false,
  sort: "signal",
};

export function marketEdge(entity: SportsEntity): number {
  return Math.abs(entity.divergence?.booksGapPP ?? entity.divergence?.gapPP ?? 0);
}

export function filterMarkets(
  entities: SportsEntity[],
  filters: TerminalFilters,
  favorites: Set<string>,
): SportsEntity[] {
  const query = filters.query.trim().toLowerCase();
  const rows = entities.filter((entity) => {
    const searchable = [entity.name, entity.ticker, entity.team, entity.league, entity.sport]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!query || searchable.includes(query))
      && (filters.league === "all" || entity.league === filters.league)
      && (filters.quality === "all" || entity.decisionQuality === filters.quality)
      && (filters.category === "all" || entity.category === filters.category)
      && marketEdge(entity) >= filters.minEdge
      && (!filters.favoritesOnly || favorites.has(entity.id));
  });

  return rows.sort((a, b) => {
    if (filters.sort === "edge") return marketEdge(b) - marketEdge(a);
    if (filters.sort === "move") return Math.abs(b.oneWeekChange ?? b.change) - Math.abs(a.oneWeekChange ?? a.change);
    if (filters.sort === "liquidity") return (b.liquidityScore ?? 0) - (a.liquidityScore ?? 0);
    if (filters.sort === "volume") return (b.volume ?? 0) - (a.volume ?? 0);
    return (b.dislocation?.severity ?? 0) - (a.dislocation?.severity ?? 0)
      || marketEdge(b) - marketEdge(a);
  });
}

interface Props {
  entities: SportsEntity[];
  filtered: SportsEntity[];
  activeEntity: SportsEntity;
  filters: TerminalFilters;
  onFiltersChange: (filters: TerminalFilters) => void;
  onSelect: (entity: SportsEntity) => void;
}

const money = (value?: number) => {
  if (!value) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

export default function TerminalSidebar({
  entities,
  filtered,
  activeEntity,
  filters,
  onFiltersChange,
  onSelect,
}: Props) {
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());
  useEffect(() => onFavoritesChange(() => setFavorites(getFavorites())), []);

  const leagues = useMemo(
    () => Array.from(new Set(entities.map((entity) => entity.league).filter(Boolean))) as string[],
    [entities],
  );
  const update = <K extends keyof TerminalFilters>(key: K, value: TerminalFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });
  const reset = () => onFiltersChange(DEFAULT_TERMINAL_FILTERS);

  return (
    <aside className="lg:sticky lg:top-3 lg:h-[calc(100vh-1.5rem)] flex flex-col bg-[#080A0D] border border-[#2D333B] rounded overflow-hidden shadow-2xl">
      <div className="px-3 py-2.5 border-b border-[#2D333B] bg-[#0B0E11] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF9900]" />
          <span className="font-mono text-[11px] font-black tracking-[0.16em]">CONTROL RAIL</span>
        </div>
        <button onClick={reset} title="Reset all filters" className="cursor-pointer text-[#D1D4DC]/40 hover:text-[#FF9900]">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 border-b border-[#2D333B] bg-[#0B0E11]/60">
        <label className="block">
          <span className="terminal-label">MARKET SEARCH</span>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-[#D1D4DC]/30" />
            <input
              value={filters.query}
              onChange={(event) => update("query", event.target.value)}
              placeholder="Ticker, event, team…"
              className="terminal-input pl-8"
            />
          </div>
        </label>

        <div>
          <span className="terminal-label">UNIVERSE</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {["all", ...leagues].map((league) => (
              <button
                key={league}
                onClick={() => update("league", league)}
                className={`terminal-chip ${filters.league === league ? "terminal-chip-active" : ""}`}
              >
                {league.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="terminal-label">QUALITY</span>
            <select value={filters.quality} onChange={(e) => update("quality", e.target.value as TerminalFilters["quality"])} className="terminal-input mt-1">
              <option value="all">ALL</option>
              <option value="good">GOOD</option>
              <option value="fair">FAIR</option>
              <option value="thin">THIN</option>
            </select>
          </label>
          <label>
            <span className="terminal-label">SORT BOARD</span>
            <select value={filters.sort} onChange={(e) => update("sort", e.target.value as MarketSort)} className="terminal-input mt-1">
              <option value="signal">SIGNAL</option>
              <option value="edge">EDGE</option>
              <option value="move">MOVE</option>
              <option value="liquidity">LIQUIDITY</option>
              <option value="volume">VOLUME</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="terminal-label flex justify-between"><span>MIN VENUE GAP</span><b className="text-[#FF9900]">{filters.minEdge.toFixed(1)}pp</b></span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={filters.minEdge}
            onChange={(event) => update("minEdge", Number(event.target.value))}
            className="terminal-range mt-2"
          />
        </label>

        <div className="flex gap-1">
          {(["all", "team", "athlete"] as const).map((category) => (
            <button key={category} onClick={() => update("category", category)} className={`terminal-chip flex-1 ${filters.category === category ? "terminal-chip-active" : ""}`}>
              {category === "all" ? "ALL TYPES" : category === "team" ? "TEAMS" : "PLAYERS"}
            </button>
          ))}
        </div>
        <button
          onClick={() => update("favoritesOnly", !filters.favoritesOnly)}
          className={`terminal-chip w-full flex justify-center items-center gap-1 ${filters.favoritesOnly ? "terminal-chip-active" : ""}`}
        >
          <Star className={`w-3 h-3 ${filters.favoritesOnly ? "fill-current" : ""}`} /> WATCHLIST · {favorites.size}
        </button>
      </div>

      <div className="px-3 py-2 border-b border-[#2D333B] flex justify-between font-mono text-[9px]">
        <span className="text-[#D1D4DC]/45"><Filter className="inline w-3 h-3 mr-1" />FILTERED BOARD</span>
        <span className="text-[#00FF66] font-bold">{filtered.length}/{entities.length} LIVE</span>
      </div>

      <div className="flex-1 min-h-[280px] lg:min-h-0 max-h-[52vh] lg:max-h-none overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="h-full min-h-56 flex flex-col items-center justify-center gap-3 text-center p-6">
            <Filter className="w-7 h-7 text-[#FF9900]/40" />
            <p className="font-mono text-[10px] text-[#D1D4DC]/50">NO MARKETS MATCH THIS CONTROL SET.</p>
            <button onClick={reset} className="terminal-chip terminal-chip-active">RESET TO LIVE DEFAULT</button>
          </div>
        ) : filtered.map((entity) => {
          const active = entity.id === activeEntity.id;
          const edge = marketEdge(entity);
          const move = entity.oneWeekChange ?? entity.change;
          return (
            <button
              key={entity.id}
              onClick={() => onSelect(entity)}
              className={`w-full cursor-pointer text-left px-3 py-2.5 border-b border-[#2D333B]/55 transition relative ${active ? "bg-[#FF9900]/10" : "hover:bg-[#1C2128]/55"}`}
            >
              {active && <span className="absolute left-0 inset-y-0 w-0.5 bg-[#FF9900]" />}
              <div className="flex items-start gap-2">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => { event.stopPropagation(); setFavorites(new Set(toggleFavorite(entity.id))); }}
                  className="mt-0.5"
                >
                  <Star className={`w-3 h-3 ${favorites.has(entity.id) ? "text-[#FF9900] fill-[#FF9900]" : "text-[#D1D4DC]/20"}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 font-mono">
                    <span className="text-[11px] font-black text-[#FF9900]">{entity.ticker}</span>
                    <span className="text-xs font-black text-white">{entity.value.toFixed(1)}%</span>
                  </div>
                  <div className="truncate text-[10px] text-[#D1D4DC]/60 mt-0.5">{entity.name}</div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[9px]">
                    <span className={move >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]"}>{move >= 0 ? "+" : ""}{move.toFixed(2)}pp</span>
                    <span className={edge >= 2 ? "text-[#FF9900]" : "text-[#D1D4DC]/35"}>EDGE {edge ? `${edge.toFixed(1)}pp` : "—"}</span>
                    <span className="text-[#D1D4DC]/35">VOL {money(entity.volume)}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
