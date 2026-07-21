/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Command Rail — the Bloomberg-style left control column. Every scope chip, slider and
 * toggle here re-scopes the WHOLE terminal (ticker, radar, screener, pulse, charts, intel).
 * Desktop: a fixed vertical rail. Mobile: the same rail inside a slide-over drawer.
 */
import type { ReactNode } from "react";
import { SportsEntity } from "../types";
import { TerminalFilters, DEFAULT_FILTERS, SortKey, activeFilterCount } from "../lib/filters";
import {
  SlidersHorizontal, Search, Star, Zap, RotateCcw, ArrowDownWideNarrow, ArrowUpNarrowWide, X,
} from "lucide-react";

interface Props {
  entities: SportsEntity[];       // full universe (for chip lists + counts)
  filteredCount: number;
  filters: TerminalFilters;
  onChange: (f: TerminalFilters) => void;
  favoritesCount: number;
  onClose?: () => void;           // present when rendered inside the mobile drawer
}

const SORTS: { id: SortKey; label: string }[] = [
  { id: "prob", label: "IMPLIED %" },
  { id: "move", label: "1W MOVE" },
  { id: "edge", label: "EDGE" },
  { id: "liquidity", label: "LIQUIDITY" },
  { id: "volume", label: "VOLUME" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-[#2D333B]/60">
      <div className="text-[9px] font-mono font-bold tracking-widest text-[#FF9900]/70 mb-1.5 select-none">
        {title}
      </div>
      {children}
    </div>
  );
}

export default function FilterRail({ entities, filteredCount, filters, onChange, favoritesCount, onClose }: Props) {
  const set = (patch: Partial<TerminalFilters>) => onChange({ ...filters, ...patch });

  const leagues = Array.from(new Set(entities.map((e) => e.league).filter(Boolean))) as string[];
  const hasAthletes = entities.some((e) => e.category === "athlete");
  const active = activeFilterCount(filters);

  const chip = (on: boolean) =>
    `cursor-pointer px-2 py-1 rounded border font-mono text-[9px] tracking-wider transition ${
      on
        ? "bg-[#FF9900] text-black border-[#FF9900] font-black"
        : "border-[#2D333B] text-[#D1D4DC]/60 hover:text-white hover:border-[#FF9900]/40"
    }`;

  const scopeCount = (lg: string) =>
    lg === "all" ? entities.length : entities.filter((e) => (e.league || "") === lg).length;

  return (
    <div className="flex flex-col h-full bg-[#0B0E11]/60 backdrop-blur-md font-mono select-none overflow-hidden">
      {/* Rail header */}
      <div className="px-3 py-2.5 border-b border-[#2D333B] bg-[#0B0E11] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF9900]" />
          <span className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">COMMAND RAIL</span>
        </div>
        {onClose ? (
          <button onClick={onClose} className="cursor-pointer text-[#D1D4DC]/50 hover:text-[#FF9900]" aria-label="Close filters">
            <X className="w-4 h-4" />
          </button>
        ) : (
          active > 0 && (
            <span className="text-[9px] font-bold text-black bg-[#FF9900] rounded px-1.5 py-0.5">{active}</span>
          )
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Scope — event universe */}
        <Section title="MARKET UNIVERSE">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => set({ scope: "all" })} className={chip(filters.scope === "all")}>
              ALL <span className="opacity-60">{scopeCount("all")}</span>
            </button>
            {leagues.map((lg) => (
              <button key={lg} onClick={() => set({ scope: lg })} className={chip(filters.scope === lg)}>
                {lg.toUpperCase()} <span className="opacity-60">{scopeCount(lg)}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Search */}
        <Section title="SEARCH">
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
              placeholder="Team, player, ticker…"
              className="w-full bg-[#1C2128] border border-[#2D333B] rounded px-2.5 py-1.5 pl-7 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-[#FF9900]/50"
            />
            <Search className="w-3 h-3 text-white/30 absolute left-2.5 top-2.5" />
          </div>
        </Section>

        {/* Subject type */}
        {hasAthletes && (
          <Section title="SUBJECT">
            <div className="flex gap-1.5">
              {([["all", "ALL"], ["team", "TEAMS"], ["athlete", "PLAYERS"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => set({ category: id })} className={chip(filters.category === id)}>
                  {label}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Sliders */}
        <Section title="IMPLIED PROBABILITY WINDOW">
          <div className="flex items-center justify-between text-[10px] text-[#D1D4DC]/60 mb-1">
            <span className="text-white font-bold">{filters.probRange[0]}%</span>
            <span className="text-[#D1D4DC]/30">to</span>
            <span className="text-white font-bold">{filters.probRange[1]}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={1}
            value={filters.probRange[0]}
            onChange={(e) => set({ probRange: [Math.min(Number(e.target.value), filters.probRange[1]), filters.probRange[1]] })}
            className="tickrr-range w-full"
            aria-label="Minimum implied probability"
          />
          <input
            type="range" min={0} max={100} step={1}
            value={filters.probRange[1]}
            onChange={(e) => set({ probRange: [filters.probRange[0], Math.max(Number(e.target.value), filters.probRange[0])] })}
            className="tickrr-range w-full mt-1"
            aria-label="Maximum implied probability"
          />
        </Section>

        <Section title="MIN LIQUIDITY">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-[#D1D4DC]/40">book depth ≥</span>
            <span className="text-white font-bold">{filters.minLiquidity > 0 ? `${filters.minLiquidity}/100` : "OFF"}</span>
          </div>
          <input
            type="range" min={0} max={90} step={5}
            value={filters.minLiquidity}
            onChange={(e) => set({ minLiquidity: Number(e.target.value) })}
            className="tickrr-range w-full"
            aria-label="Minimum liquidity score"
          />
        </Section>

        <Section title="MIN EDGE vs BOOKS/KALSHI">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-[#D1D4DC]/40">|gap| ≥</span>
            <span className="text-white font-bold">{filters.minEdge > 0 ? `${filters.minEdge.toFixed(1)}pp` : "OFF"}</span>
          </div>
          <input
            type="range" min={0} max={10} step={0.5}
            value={filters.minEdge}
            onChange={(e) => set({ minEdge: Number(e.target.value) })}
            className="tickrr-range w-full"
            aria-label="Minimum cross-venue edge"
          />
        </Section>

        {/* Decision quality */}
        <Section title="DECISION QUALITY">
          <div className="flex flex-wrap gap-1.5">
            {([["all", "ALL"], ["good", "GOOD"], ["fair", "FAIR"], ["thin", "THIN"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => set({ quality: id })} className={chip(filters.quality === id)}>
                {label}
              </button>
            ))}
          </div>
        </Section>

        {/* Toggles */}
        <Section title="LENSES">
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => set({ signalsOnly: !filters.signalsOnly })}
              className={`${chip(filters.signalsOnly)} flex items-center gap-1.5 w-fit`}
            >
              <Zap className="w-2.5 h-2.5" /> LIVE SIGNALS ONLY
            </button>
            <button
              onClick={() => set({ watchlistOnly: !filters.watchlistOnly })}
              className={`${chip(filters.watchlistOnly)} flex items-center gap-1.5 w-fit`}
            >
              <Star className={`w-2.5 h-2.5 ${filters.watchlistOnly ? "fill-black" : ""}`} />
              WATCHLIST{favoritesCount ? ` · ${favoritesCount}` : ""}
            </button>
          </div>
        </Section>

        {/* Sort */}
        <Section title="RANK BY">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {SORTS.map((s) => (
              <button key={s.id} onClick={() => set({ sortBy: s.id })} className={chip(filters.sortBy === s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => set({ sortDir: filters.sortDir === "desc" ? "asc" : "desc" })}
            className="cursor-pointer flex items-center gap-1.5 text-[9px] text-[#D1D4DC]/60 hover:text-[#FF9900] transition"
          >
            {filters.sortDir === "desc"
              ? <><ArrowDownWideNarrow className="w-3 h-3" /> HIGH → LOW</>
              : <><ArrowUpNarrowWide className="w-3 h-3" /> LOW → HIGH</>}
          </button>
        </Section>
      </div>

      {/* Rail footer — result count + reset */}
      <div className="px-3 py-2.5 border-t border-[#2D333B] bg-[#0B0E11] flex items-center justify-between shrink-0">
        <span className="text-[9px] text-[#D1D4DC]/50">
          <span className="text-[#00FF66] font-bold">{filteredCount}</span> / {entities.length} MARKETS
        </span>
        <button
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          disabled={active === 0}
          className="cursor-pointer flex items-center gap-1 text-[9px] font-bold text-[#D1D4DC]/50 hover:text-[#FF9900] disabled:opacity-30 disabled:cursor-default transition"
        >
          <RotateCcw className="w-3 h-3" /> RESET
        </button>
      </div>
    </div>
  );
}
