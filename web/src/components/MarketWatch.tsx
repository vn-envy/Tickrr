/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { SportsEntity } from "../types";
import { Search, Trophy, Users, Star } from "lucide-react";

interface MarketWatchProps {
  entities: SportsEntity[];
  activeEntity: SportsEntity;
  onSelectEntity: (entity: SportsEntity) => void;
  sportFilter: string | null;
}

export default function MarketWatch({
  entities,
  activeEntity,
  onSelectEntity,
  sportFilter
}: MarketWatchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "athlete" | "team">("all");

  // Filter entities based on search, sport filter, and category tab
  const filtered = entities.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.team.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSport = sportFilter ? item.sport === sportFilter : true;
    const matchesCategory = categoryFilter === "all" ? true : item.category === categoryFilter;

    return matchesSearch && matchesSport && matchesCategory;
  });

  return (
    <div 
      className="flex flex-col h-full bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl overflow-hidden backdrop-blur-md"
      id="terminal-market-watch"
    >
      {/* Header Banner */}
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-[#FF9900] fill-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">
            WIN MARKETS · LIVE
          </h2>
        </div>
        <span className="font-mono text-[9px] text-[#D1D4DC]/60 font-bold bg-[#1C2128] border border-[#2D333B] px-1.5 py-0.5 rounded">
          {filtered.length} RECORDS
        </span>
      </div>

      {/* Directory Filters & Search */}
      <div className="p-2 border-b border-[#2D333B] bg-[#0B0E11]/30 flex flex-col sm:flex-row gap-2">
        {/* Category Tabs */}
        <div className="flex bg-[#1C2128] p-0.5 border border-[#2D333B] rounded font-mono text-[10px]">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`cursor-pointer px-2.5 py-1 rounded transition duration-150 ${
              categoryFilter === "all"
                ? "bg-[#FF9900] text-black font-black"
                : "text-[#D1D4DC]/60 hover:text-white"
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setCategoryFilter("athlete")}
            className={`cursor-pointer px-2.5 py-1 rounded transition duration-150 flex items-center gap-1 ${
              categoryFilter === "athlete"
                ? "bg-[#FF9900] text-black font-black"
                : "text-[#D1D4DC]/60 hover:text-white"
            }`}
          >
            <Users className="w-2.5 h-2.5" />
            PLAYERS
          </button>
          <button
            onClick={() => setCategoryFilter("team")}
            className={`cursor-pointer px-2.5 py-1 rounded transition duration-150 flex items-center gap-1 ${
              categoryFilter === "team"
                ? "bg-[#FF9900] text-black font-black"
                : "text-[#D1D4DC]/60 hover:text-white"
            }`}
          >
            <Trophy className="w-2.5 h-2.5" />
            TEAMS
          </button>
        </div>

        {/* Directory-specific Search */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
            className="w-full bg-[#1C2128] border border-[#2D333B] rounded px-2.5 py-1 pl-7 font-mono text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-[#FF9900]/50"
          />
          <Search className="w-3 h-3 text-white/30 absolute left-2.5 top-2" />
        </div>
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-auto min-h-[220px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#050608]/90 border-b border-[#2D333B] font-mono text-[10px] text-[#D1D4DC]/40 tracking-wider sticky top-0 select-none">
              <th className="py-2.5 px-3 font-semibold">TICKER / NAME</th>
              <th className="py-2.5 px-2 font-semibold hidden sm:table-cell">MARKET</th>
              <th className="py-2.5 px-2 font-semibold text-right">IMPLIED %</th>
              <th className="py-2.5 px-2 font-semibold text-right">1W &#916;</th>
              <th className="py-2.5 px-2 font-semibold text-right hidden md:table-cell">LIQ</th>
              <th className="py-2.5 px-3 font-semibold text-right hidden md:table-cell">QUALITY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D333B]/40 font-mono text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[#D1D4DC]/30 font-mono text-xs">
                  NO RECORDS MATCH CRITERIA.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isActive = item.id === activeEntity.id;
                const isPositive = item.change >= 0;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectEntity(item)}
                    className={`group cursor-pointer transition duration-150 ${
                      isActive 
                        ? "bg-[#FF9900]/10 text-white font-semibold" 
                        : "hover:bg-[#1C2128]/40 text-[#D1D4DC]"
                    }`}
                  >
                    {/* Ticker & Name */}
                    <td className="py-2 px-3 flex flex-col relative">
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF9900]" />
                      )}
                      <span className={`font-bold tracking-wider ${isActive ? "text-[#FF9900]" : "text-[#FF9900]/80 group-hover:text-[#FF9900]"}`}>
                        {item.ticker}
                      </span>
                      <span className="text-[10px] text-[#D1D4DC]/60 font-sans tracking-tight">
                        {item.name}
                      </span>
                      {item.dislocation && (
                        <span
                          title={item.dislocation.rationale}
                          className={`mt-0.5 inline-flex w-fit items-center gap-0.5 text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                            item.dislocation.action === "avoid"
                              ? "bg-[#FF3B30]/15 text-[#FF3B30]"
                              : item.dislocation.action === "watch"
                              ? "bg-[#FF9900]/15 text-[#FF9900]"
                              : "bg-[#00FF66]/15 text-[#00FF66]"
                          }`}
                        >
                          ⚡ {item.dislocation.label}
                        </span>
                      )}
                      {item.enrichment?.topScorer && (
                        <span
                          className="mt-0.5 text-[8px] font-mono text-[#00FF66]/70"
                          title={`Attacking threat ${item.enrichment.attackingThreat ?? 0}% (squad golden-boot)`}
                        >
                          ⚽ {item.enrichment.topScorer} {Math.round(item.enrichment.topScorerProb ?? 0)}%
                        </span>
                      )}
                    </td>

                    {/* Event */}
                    <td className="py-2 px-2 text-[11px] text-[#D1D4DC]/50 hidden sm:table-cell">
                      {(item.team || item.sport).toUpperCase()}
                    </td>

                    {/* Implied probability */}
                    <td className="py-2 px-2 text-right font-bold text-white">
                      {item.value.toFixed(1)}%
                    </td>

                    {/* 24h Change */}
                    <td className={`py-2 px-2 text-right font-bold ${isPositive ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                      {isPositive ? "+" : ""}{item.change.toFixed(2)}%
                    </td>

                    {/* Efficiency (PER) */}
                    <td className="py-2 px-2 text-right text-[#00FF66]/80 hidden md:table-cell">
                      {item.efficiency.toFixed(1)}
                    </td>

                    {/* Decision quality */}
                    <td className="py-2 px-3 text-right hidden md:table-cell">
                      <span className={
                        item.decisionQuality === "good" ? "text-[#00FF66]" :
                        item.decisionQuality === "fair" ? "text-[#FF9900]" : "text-[#FF3B30]"
                      }>
                        {(item.decisionQuality || "—").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
