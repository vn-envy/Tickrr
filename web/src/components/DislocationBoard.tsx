/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dislocation Radar — the home board. Surfaces, from live market intel:
 *   1. LIVE SIGNALS   — single-venue dislocations (momentum / overreaction / liquidity trap)
 *   2. CROSS-VENUE GAPS — derived Polymarket-vs-Kalshi divergence, with an attributed link.
 */
import { SportsEntity } from "../types";
import { Radar, ExternalLink, Zap } from "lucide-react";
import InfoTip from "./InfoTip";

interface Props {
  entities: SportsEntity[];
  onSelect: (e: SportsEntity) => void;
}

const actionColor = (a?: string) =>
  a === "avoid" ? "#FF3B30" : a === "watch" ? "#FF9900" : "#00FF66";

export default function DislocationBoard({ entities, onSelect }: Props) {
  const gapFor = (e: SportsEntity) => e.divergence?.booksGapPP ?? e.divergence?.gapPP ?? 0;
  const flagged = entities
    .filter((e) => e.dislocation)
    .sort((a, b) => (b.dislocation!.severity) - (a.dislocation!.severity))
    .slice(0, 12);

  const gaps = entities
    .filter((e) => e.divergence && Math.abs(gapFor(e)) >= 1)
    .sort((a, b) => Math.abs(gapFor(b)) - Math.abs(gapFor(a)))
    .slice(0, 12);

  return (
    <div className="z-20">
      <div className="bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Radar className="w-3.5 h-3.5 text-[#FF9900] animate-pulse" />
            <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">
              DISLOCATION RADAR
            </h2>
            <span className="text-[9px] text-[#00FF66] font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink" /> LIVE
            </span>
          </div>
          <span className="font-mono text-[9px] text-[#D1D4DC]/40">
            {flagged.length} SIGNALS · {gaps.length} CROSS-VENUE GAPS
          </span>
        </div>

        {flagged.length === 0 && gaps.length === 0 && (
          <div className="px-4 py-6 text-center font-mono text-[10px] text-[#D1D4DC]/40">
            NO DISLOCATIONS IN THIS CONTROL SET · BROADEN THE LEFT-RAIL FILTERS
          </div>
        )}

        {/* Live signals row */}
        {flagged.length > 0 && (
          <div className="px-2 pt-2">
            <div className="text-[9px] font-mono font-bold text-[#FF9900]/70 px-1 mb-1 tracking-wider"><InfoTip metric="liveSignals">⚡ LIVE SIGNALS</InfoTip></div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {flagged.map((e) => {
                const d = e.dislocation!;
                const c = actionColor(d.action);
                return (
                  <button
                    key={`s-${e.id}`}
                    onClick={() => onSelect(e)}
                    title={d.rationale}
                    className="cursor-pointer text-left shrink-0 w-[190px] bg-[#1C2128]/40 border rounded p-2 hover:bg-[#1C2128]/70 transition"
                    style={{ borderColor: `${c}55` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] font-bold text-[#FF9900] truncate">{e.ticker}</span>
                      <span className="font-mono text-[10px] text-white font-bold">{e.value.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold mb-1" style={{ color: c }}>
                      <Zap className="w-3 h-3" /> {d.label}
                    </div>
                    <div className="w-full h-1 bg-[#050608] rounded overflow-hidden">
                      <div className="h-full" style={{ width: `${Math.round(d.severity * 100)}%`, background: c }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cross-venue gaps row */}
        {gaps.length > 0 && (
          <div className="px-2 pb-2 border-t border-[#2D333B]/50">
            <div className="text-[9px] font-mono font-bold text-[#D1D4DC]/50 px-1 my-1 tracking-wider">
              <InfoTip metric="crossVenue">◇ CROSS-VENUE GAPS · POLYMARKET vs MARKET</InfoTip>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gaps.map((e) => {
                const g = e.divergence!;
                const gap = gapFor(e);
                const comparison = g.kalshi != null ? "KALSHI" : "BOOKS";
                const comparisonValue = g.kalshi ?? g.books;
                const pos = gap >= 0;
                return (
                  <div
                    key={`g-${e.id}`}
                    className="shrink-0 w-[210px] bg-[#1C2128]/40 border border-[#2D333B] rounded p-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <button onClick={() => onSelect(e)} className="cursor-pointer font-mono text-[11px] font-bold text-[#FF9900] truncate hover:underline">
                        {e.ticker}
                      </button>
                      <span className={`font-mono text-[11px] font-black ${pos ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                        {pos ? "+" : ""}{gap.toFixed(1)}pp
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-[#D1D4DC]/70 flex items-center gap-2">
                      <span>POLY <span className="text-white font-bold">{g.polymarket.toFixed(1)}%</span></span>
                      <span className="text-[#D1D4DC]/30">vs</span>
                      <span>{comparison} <span className="text-white font-bold">{comparisonValue?.toFixed(1) ?? "—"}%</span></span>
                    </div>
                    {g.url && (
                      <a
                        href={g.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-0.5 text-[9px] text-[#D1D4DC]/40 hover:text-[#00FF66] transition"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Kalshi
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
