/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Left vertical control rail — Bloomberg-style filters, search, and market directory.
 * All insight panes react to the selection / filter state owned here (via parent).
 */
import { useEffect, useMemo, useState } from "react";
import { SportsEntity } from "../types";
import { getFavorites, toggleFavorite, onFavoritesChange } from "../lib/watchlist";
import {
  Search, Star, Trophy, Users, SlidersHorizontal, ChevronDown, X, Filter,
} from "lucide-react";
import InfoTip from "./InfoTip";

export interface RailFilters {
  search: string;
  sport: string | null;
  league: string;
  category: "all" | "athlete" | "team";
  favoritesOnly: boolean;
  /** Minimum |cross-venue gap| in pp to surface (0 = off). */
  minGap: number;
  /** Only show dislocation-flagged markets. */
  signalsOnly: boolean;
  /** Decision-quality gate: all | good | fair+ | thin. */
  quality: "all" | "good" | "fair" | "thin";
}

export const DEFAULT_RAIL_FILTERS: RailFilters = {
  search: "",
  sport: null,
  league: "all",
  category: "all",
  favoritesOnly: false,
  minGap: 0,
  signalsOnly: false,
  quality: "all",
};

interface Props {
  entities: SportsEntity[];
  activeEntity: SportsEntity;
  onSelectEntity: (e: SportsEntity) => void;
  filters: RailFilters;
  onFiltersChange: (f: RailFilters) => void;
  /** Mobile: whether the drawer is open. */
  open?: boolean;
  onClose?: () => void;
  /** Filtered count for header badge. */
  filteredCount: number;
}

const SPORTS = ["Basketball", "Football", "Soccer", "F1", "Tennis"] as const;

function matchesQuality(e: SportsEntity, q: RailFilters["quality"]): boolean {
  if (q === "all") return true;
  const dq = (e.decisionQuality || "").toLowerCase();
  if (q === "good") return dq === "good";
  if (q === "fair") return dq === "good" || dq === "fair";
  if (q === "thin") return dq === "thin";
  return true;
}

/** Shared filter predicate used by App + InsightDeck so everything stays in lockstep. */
export function applyRailFilters(entities: SportsEntity[], f: RailFilters, favorites: Set<string>): SportsEntity[] {
  const q = f.search.toLowerCase().trim();
  return entities.filter((item) => {
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.ticker.toLowerCase().includes(q) ||
      item.team.toLowerCase().includes(q) ||
      (item.league || "").toLowerCase().includes(q);
    const matchesSport = f.sport ? item.sport === f.sport : true;
    const matchesCategory = f.category === "all" ? true : item.category === f.category;
    const matchesLeague = f.league === "all" ? true : (item.league || "") === f.league;
    const matchesFav = f.favoritesOnly ? favorites.has(item.id) : true;
    const gap = Math.abs(item.divergence?.booksGapPP ?? item.divergence?.gapPP ?? 0);
    const matchesGap = f.minGap <= 0 ? true : gap >= f.minGap;
    const matchesSignal = f.signalsOnly ? Boolean(item.dislocation) : true;
    const matchesQ = matchesQuality(item, f.quality);
    return matchesSearch && matchesSport && matchesCategory && matchesLeague && matchesFav && matchesGap && matchesSignal && matchesQ;
  });
}

export default function TerminalRail({
  entities,
  activeEntity,
  onSelectEntity,
  filters,
  onFiltersChange,
  open = true,
  onClose,
  filteredCount,
}: Props) {
  const bodyProps = {
    entities,
    activeEntity,
    onSelectEntity,
    filters,
    onFiltersChange,
    onClose,
    filteredCount,
  };

  // Desktop + mobile each need their own instance (a single element can't mount twice).
  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-[300px] xl:w-[320px] shrink-0 h-full sticky top-0 self-stretch">
        <RailBody {...bodyProps} />
      </aside>

      <div
        className={`lg:hidden fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={onClose}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[min(100%,320px)] shadow-2xl transition-transform duration-300 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <RailBody {...bodyProps} />
        </div>
      </div>
    </>
  );
}

interface RailBodyProps {
  entities: SportsEntity[];
  activeEntity: SportsEntity;
  onSelectEntity: (e: SportsEntity) => void;
  filters: RailFilters;
  onFiltersChange: (f: RailFilters) => void;
  onClose?: () => void;
  filteredCount: number;
}

function RailBody({
  entities,
  activeEntity,
  onSelectEntity,
  filters,
  onFiltersChange,
  onClose,
  filteredCount,
}: RailBodyProps) {
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  useEffect(() => onFavoritesChange(() => setFavorites(getFavorites())), []);

  const leagues = useMemo(
    () => Array.from(new Set(entities.map((e) => e.league).filter(Boolean))) as string[],
    [entities],
  );
  const hasAthletes = entities.some((e) => e.category === "athlete");
  const sportsPresent = useMemo(
    () => SPORTS.filter((s) => entities.some((e) => e.sport === s)),
    [entities],
  );

  const filtered = useMemo(
    () => applyRailFilters(entities, filters, favorites),
    [entities, filters, favorites],
  );

  const set = (partial: Partial<RailFilters>) => onFiltersChange({ ...filters, ...partial });

  const chip = (active: boolean) =>
    `cursor-pointer px-2 py-1 rounded border text-[10px] font-mono tracking-wide transition ${
      active
        ? "bg-[#FF9900] text-black border-[#FF9900] font-black"
        : "border-[#2D333B] text-[#D1D4DC]/60 hover:text-white hover:border-[#FF9900]/40"
    }`;

  return (
    <div className="flex flex-col h-full bg-[#0B0E11] border-r border-[#2D333B] overflow-hidden">
      <div className="shrink-0 bg-[#050608] border-b border-[#2D333B] px-3 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-[11px] font-bold tracking-[0.18em] text-[#D1D4DC]">CONTROL</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-[#D1D4DC]/50 font-bold bg-[#1C2128] border border-[#2D333B] px-1.5 py-0.5 rounded">
            {filteredCount} MKT
          </span>
          {onClose && (
            <button type="button" onClick={onClose} className="lg:hidden cursor-pointer text-[#D1D4DC]/50 hover:text-white" aria-label="Close filters">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 p-2 border-b border-[#2D333B]">
        <div className="relative">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Find market, ticker…"
            className="w-full bg-[#1C2128] border border-[#2D333B] rounded px-2.5 py-1.5 pl-7 font-mono text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-[#FF9900]/50"
          />
          <Search className="w-3 h-3 text-white/30 absolute left-2.5 top-2.5" />
        </div>
      </div>

      <div className="shrink-0 border-b border-[#2D333B]">
        <button
          type="button"
          onClick={() => setFiltersExpanded((v) => !v)}
          className="w-full cursor-pointer px-3 py-2 flex items-center justify-between text-[10px] font-mono text-[#D1D4DC]/50 hover:text-[#D1D4DC] tracking-wider"
        >
          <span className="flex items-center gap-1.5"><Filter className="w-3 h-3" /> FILTERS</span>
          <ChevronDown className={`w-3.5 h-3.5 transition ${filtersExpanded ? "rotate-180" : ""}`} />
        </button>

        {filtersExpanded && (
          <div className="px-2 pb-2.5 flex flex-col gap-2.5 max-h-[42vh] overflow-y-auto">
            {leagues.length > 0 && (
              <div>
                <div className="text-[9px] font-mono text-[#D1D4DC]/35 mb-1 tracking-wider px-0.5">UNIVERSE</div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => set({ league: "all" })} className={chip(filters.league === "all")}>ALL</button>
                  {leagues.map((lg) => (
                    <button key={lg} type="button" onClick={() => set({ league: lg })} className={chip(filters.league === lg)}>
                      {lg.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sportsPresent.length > 0 && (
              <div>
                <div className="text-[9px] font-mono text-[#D1D4DC]/35 mb-1 tracking-wider px-0.5">SPORT</div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" onClick={() => set({ sport: null })} className={chip(filters.sport === null)}>ALL.EQ</button>
                  {sportsPresent.map((s) => (
                    <button key={s} type="button" onClick={() => set({ sport: s })} className={chip(filters.sport === s)}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasAthletes && (
              <div>
                <div className="text-[9px] font-mono text-[#D1D4DC]/35 mb-1 tracking-wider px-0.5">TYPE</div>
                <div className="flex flex-wrap gap-1">
                  {([
                    ["all", "ALL", null],
                    ["athlete", "PLAYERS", Users],
                    ["team", "TEAMS", Trophy],
                  ] as const).map(([v, label, Icon]) => (
                    <button key={v} type="button" onClick={() => set({ category: v })} className={`${chip(filters.category === v)} flex items-center gap-1`}>
                      {Icon && <Icon className="w-2.5 h-2.5" />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-[9px] font-mono text-[#D1D4DC]/35 mb-1 tracking-wider px-0.5">
                <InfoTip metric="quality">DECISION QUALITY</InfoTip>
              </div>
              <div className="flex flex-wrap gap-1">
                {([
                  ["all", "ANY"],
                  ["good", "GOOD"],
                  ["fair", "FAIR+"],
                  ["thin", "THIN"],
                ] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => set({ quality: v })} className={chip(filters.quality === v)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[9px] font-mono text-[#D1D4DC]/35 mb-1 tracking-wider px-0.5">
                <InfoTip metric="crossVenue">MIN GAP (pp)</InfoTip>
                <span className="text-[#FF9900] font-bold">{filters.minGap.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={filters.minGap}
                onChange={(e) => set({ minGap: Number(e.target.value) })}
                className="w-full accent-[#FF9900] h-1.5 cursor-pointer"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => set({ signalsOnly: !filters.signalsOnly })}
                className={chip(filters.signalsOnly)}
              >
                ⚡ SIGNALS ONLY
              </button>
              <button
                type="button"
                onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}
                className={`${chip(filters.favoritesOnly)} flex items-center gap-1`}
              >
                <Star className={`w-2.5 h-2.5 ${filters.favoritesOnly ? "fill-black" : ""}`} />
                WATCHLIST{favorites.size ? ` · ${favorites.size}` : ""}
              </button>
            </div>

            {(filters.search || filters.sport || filters.league !== "all" || filters.category !== "all" || filters.favoritesOnly || filters.minGap > 0 || filters.signalsOnly || filters.quality !== "all") && (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...DEFAULT_RAIL_FILTERS })}
                className="cursor-pointer text-[10px] font-mono text-[#D1D4DC]/40 hover:text-[#FF9900] self-start px-0.5"
              >
                RESET ALL
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-10 px-4 text-center text-[#D1D4DC]/30 font-mono text-[11px]">
            NO MARKETS MATCH.<br />
            <button type="button" onClick={() => onFiltersChange({ ...DEFAULT_RAIL_FILTERS })} className="mt-2 cursor-pointer text-[#FF9900] hover:underline">
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[#2D333B]/40">
            {filtered.map((item) => {
              const isActive = item.id === activeEntity.id;
              const isPositive = item.change >= 0;
              const edge = item.divergence?.booksGapPP ?? item.divergence?.gapPP;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => { onSelectEntity(item); onClose?.(); }}
                    className={`w-full cursor-pointer text-left px-3 py-2.5 transition relative ${
                      isActive ? "bg-[#FF9900]/10" : "hover:bg-[#1C2128]/50"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF9900]" />}
                    <div className="flex items-start gap-2">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setFavorites(new Set(toggleFavorite(item.id))); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setFavorites(new Set(toggleFavorite(item.id))); } }}
                        className="mt-0.5 shrink-0"
                        title={favorites.has(item.id) ? "Remove from watchlist" : "Add to watchlist"}
                      >
                        <Star className={`w-3 h-3 transition ${favorites.has(item.id) ? "fill-[#FF9900] text-[#FF9900]" : "text-[#D1D4DC]/25 hover:text-[#FF9900]"}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`font-mono text-[11px] font-bold tracking-wider truncate ${isActive ? "text-[#FF9900]" : "text-[#FF9900]/80"}`}>
                            {item.ticker}
                          </span>
                          <span className="font-mono text-[12px] font-bold text-white shrink-0">
                            {item.value.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-[10px] text-[#D1D4DC]/55 font-sans truncate">{item.name}</span>
                          <span className={`font-mono text-[10px] font-bold shrink-0 ${isPositive ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                            {isPositive ? "+" : ""}{item.change.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.dislocation && (
                            <span
                              className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                                item.dislocation.action === "avoid"
                                  ? "bg-[#FF3B30]/15 text-[#FF3B30]"
                                  : item.dislocation.action === "watch"
                                  ? "bg-[#FF9900]/15 text-[#FF9900]"
                                  : "bg-[#00FF66]/15 text-[#00FF66]"
                              }`}
                            >
                              {item.dislocation.label}
                            </span>
                          )}
                          {edge != null && Math.abs(edge) >= 1 && (
                            <span className="text-[8px] font-mono text-[#D1D4DC]/40">
                              Δ {edge >= 0 ? "+" : ""}{edge.toFixed(1)}pp
                            </span>
                          )}
                          {item.decisionQuality && (
                            <span className={`text-[8px] font-mono ${
                              item.decisionQuality === "good" ? "text-[#00FF66]/70" :
                              item.decisionQuality === "fair" ? "text-[#FF9900]/70" : "text-[#FF3B30]/70"
                            }`}>
                              {item.decisionQuality.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
