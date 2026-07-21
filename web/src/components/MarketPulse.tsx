/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Market Pulse — aggregate intelligence over the CURRENT filtered universe. Where the
 * telemetry chart reads one market, this reads the whole board: breadth (who's gaining
 * conviction), the shape of the probability distribution, the biggest week movers, where
 * the volume concentrates, and how decision-grade the board is overall. Every bar is
 * clickable so an insight is always one tap from its market.
 */
import { SportsEntity } from "../types";
import { edgeOf } from "../lib/filters";
import { Waves } from "lucide-react";
import InfoTip from "./InfoTip";

interface Props {
  entities: SportsEntity[];   // the filtered universe
  scopeLabel: string;         // "ALL MARKETS" | league name
  onSelect: (e: SportsEntity) => void;
}

const fmtVol = (v: number) =>
  v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;

export default function MarketPulse({ entities, scopeLabel, onSelect }: Props) {
  if (entities.length === 0) return null;

  const move = (e: SportsEntity) => e.oneWeekChange ?? e.change;
  const prob = (e: SportsEntity) => e.impliedProb ?? e.value;

  // --- Breadth: conviction building vs fading (1W) ---
  const up = entities.filter((e) => move(e) > 0.05).length;
  const down = entities.filter((e) => move(e) < -0.05).length;
  const flat = entities.length - up - down;
  const upShare = entities.length ? (up / entities.length) * 100 : 0;
  const downShare = entities.length ? (down / entities.length) * 100 : 0;

  // --- Distribution: 10 implied-probability bins ---
  const bins = Array.from({ length: 10 }, () => 0);
  for (const e of entities) bins[Math.min(9, Math.floor(prob(e) / 10))]++;
  const maxBin = Math.max(...bins, 1);

  // --- Top movers (1W), signed ---
  const movers = [...entities]
    .filter((e) => Math.abs(move(e)) > 0.01)
    .sort((a, b) => Math.abs(move(b)) - Math.abs(move(a)))
    .slice(0, 6);
  const maxMove = Math.max(...movers.map((e) => Math.abs(move(e))), 0.01);

  // --- Volume concentration ---
  const byVolume = [...entities]
    .filter((e) => (e.volume ?? 0) > 0)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 5);
  const maxVol = Math.max(...byVolume.map((e) => e.volume ?? 0), 1);

  // --- Board quality mix ---
  const good = entities.filter((e) => e.decisionQuality === "good").length;
  const fair = entities.filter((e) => e.decisionQuality === "fair").length;
  const thin = entities.length - good - fair;

  // --- Widest live edges vs a second venue ---
  const edges = [...entities]
    .filter((e) => edgeOf(e) != null)
    .sort((a, b) => Math.abs(edgeOf(b)!) - Math.abs(edgeOf(a)!))
    .slice(0, 5);
  const maxEdge = Math.max(...edges.map((e) => Math.abs(edgeOf(e)!)), 0.1);

  return (
    <div className="flex flex-col bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2 min-w-0">
          <Waves className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC] truncate">
            MARKET PULSE · <span className="text-[#FF9900]">{scopeLabel.toUpperCase()}</span>
          </h2>
          <InfoTip metric="pulse" />
        </div>
        <span className="font-mono text-[9px] text-[#D1D4DC]/40 shrink-0">{entities.length} MARKETS</span>
      </div>

      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
        {/* Breadth */}
        <div className="bg-[#1C2128]/30 border border-[#2D333B] rounded p-2.5">
          <div className="text-[9px] font-bold tracking-widest text-[#FF9900]/70 mb-2 flex items-center gap-1">
            <InfoTip metric="breadth">CONVICTION BREADTH · 1W</InfoTip>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-[#00FF66] font-bold">▲ {up} BUILDING</span>
            <span className="text-[#D1D4DC]/40">{flat} FLAT</span>
            <span className="text-[#FF3B30] font-bold">▼ {down} FADING</span>
          </div>
          <div className="w-full h-2 bg-[#050608] rounded overflow-hidden flex">
            <div className="h-full bg-[#00FF66]" style={{ width: `${upShare}%` }} />
            <div className="h-full bg-[#2D333B]" style={{ width: `${100 - upShare - downShare}%` }} />
            <div className="h-full bg-[#FF3B30]" style={{ width: `${downShare}%` }} />
          </div>
          {/* Quality mix under the breadth bar */}
          <div className="mt-3 text-[9px] font-bold tracking-widest text-[#FF9900]/70 mb-1.5">
            <InfoTip metric="qualityMix">BOARD QUALITY MIX</InfoTip>
          </div>
          <div className="w-full h-2 bg-[#050608] rounded overflow-hidden flex">
            <div className="h-full bg-[#00FF66]" style={{ width: `${(good / entities.length) * 100}%` }} title={`${good} good`} />
            <div className="h-full bg-[#FF9900]" style={{ width: `${(fair / entities.length) * 100}%` }} title={`${fair} fair`} />
            <div className="h-full bg-[#FF3B30]" style={{ width: `${(thin / entities.length) * 100}%` }} title={`${thin} thin`} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-[9px] text-[#D1D4DC]/50">
            <span><span className="text-[#00FF66] font-bold">{good}</span> GOOD</span>
            <span><span className="text-[#FF9900] font-bold">{fair}</span> FAIR</span>
            <span><span className="text-[#FF3B30] font-bold">{thin}</span> THIN</span>
          </div>
        </div>

        {/* Probability distribution histogram */}
        <div className="bg-[#1C2128]/30 border border-[#2D333B] rounded p-2.5">
          <div className="text-[9px] font-bold tracking-widest text-[#FF9900]/70 mb-2">
            <InfoTip metric="distribution">IMPLIED-PROBABILITY DISTRIBUTION</InfoTip>
          </div>
          <div className="flex items-end gap-1 h-16">
            {bins.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group" title={`${i * 10}–${i * 10 + 10}%: ${n} markets`}>
                <div
                  className="w-full rounded-t-sm bg-[#FF9900]/70 group-hover:bg-[#FF9900] transition-colors"
                  style={{ height: `${Math.max(n > 0 ? 8 : 2, (n / maxBin) * 100)}%`, opacity: n > 0 ? 1 : 0.25 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-[#D1D4DC]/30 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
          <p className="text-[9px] text-[#D1D4DC]/40 font-sans mt-1.5 leading-snug">
            Where this board's prices cluster — mass near the edges = settled favorites/longshots; mass in the middle = contested outcomes.
          </p>
        </div>

        {/* Top movers */}
        {movers.length > 0 && (
          <div className="bg-[#1C2128]/30 border border-[#2D333B] rounded p-2.5">
            <div className="text-[9px] font-bold tracking-widest text-[#FF9900]/70 mb-2">
              <InfoTip metric="movers">TOP MOVERS · 1W</InfoTip>
            </div>
            <div className="space-y-1.5">
              {movers.map((e) => {
                const m = move(e);
                const pos = m >= 0;
                return (
                  <button
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className="cursor-pointer w-full flex items-center gap-2 group"
                    title={`${e.name} · ${pos ? "+" : ""}${m.toFixed(2)}pp over 1 week`}
                  >
                    <span className="w-16 shrink-0 text-left text-[9px] font-bold text-[#FF9900]/80 group-hover:text-[#FF9900] truncate">{e.ticker}</span>
                    <div className="flex-1 h-2.5 flex items-center">
                      <div className="w-1/2 flex justify-end">
                        {!pos && <div className="h-2 rounded-l-sm bg-[#FF3B30]/80 group-hover:bg-[#FF3B30]" style={{ width: `${(Math.abs(m) / maxMove) * 100}%` }} />}
                      </div>
                      <div className="w-px h-3 bg-[#2D333B]" />
                      <div className="w-1/2">
                        {pos && <div className="h-2 rounded-r-sm bg-[#00FF66]/80 group-hover:bg-[#00FF66]" style={{ width: `${(Math.abs(m) / maxMove) * 100}%` }} />}
                      </div>
                    </div>
                    <span className={`w-14 shrink-0 text-right text-[9px] font-bold ${pos ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                      {pos ? "+" : ""}{m.toFixed(1)}pp
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Volume leaders / widest edges */}
        <div className="bg-[#1C2128]/30 border border-[#2D333B] rounded p-2.5">
          {byVolume.length > 0 ? (
            <>
              <div className="text-[9px] font-bold tracking-widest text-[#FF9900]/70 mb-2">
                <InfoTip metric="volumeLeaders">VOLUME LEADERS</InfoTip>
              </div>
              <div className="space-y-1.5">
                {byVolume.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className="cursor-pointer w-full flex items-center gap-2 group"
                    title={`${e.name} · ${fmtVol(e.volume ?? 0)} traded`}
                  >
                    <span className="w-16 shrink-0 text-left text-[9px] font-bold text-[#FF9900]/80 group-hover:text-[#FF9900] truncate">{e.ticker}</span>
                    <div className="flex-1 h-2 bg-[#050608] rounded overflow-hidden">
                      <div className="h-full bg-[#00C8FF]/70 group-hover:bg-[#00C8FF]" style={{ width: `${((e.volume ?? 0) / maxVol) * 100}%` }} />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[9px] font-bold text-white">{fmtVol(e.volume ?? 0)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : edges.length > 0 ? (
            <>
              <div className="text-[9px] font-bold tracking-widest text-[#FF9900]/70 mb-2">
                <InfoTip metric="edge">WIDEST CROSS-VENUE EDGES</InfoTip>
              </div>
              <div className="space-y-1.5">
                {edges.map((e) => {
                  const g = edgeOf(e)!;
                  return (
                    <button key={e.id} onClick={() => onSelect(e)} className="cursor-pointer w-full flex items-center gap-2 group" title={e.name}>
                      <span className="w-16 shrink-0 text-left text-[9px] font-bold text-[#FF9900]/80 group-hover:text-[#FF9900] truncate">{e.ticker}</span>
                      <div className="flex-1 h-2 bg-[#050608] rounded overflow-hidden">
                        <div className="h-full bg-[#FF9900]/70 group-hover:bg-[#FF9900]" style={{ width: `${(Math.abs(g) / maxEdge) * 100}%` }} />
                      </div>
                      <span className="w-14 shrink-0 text-right text-[9px] font-bold text-[#FF9900]">{g >= 0 ? "+" : ""}{g.toFixed(1)}pp</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-[#D1D4DC]/30 py-4 text-center">NO VOLUME / EDGE DATA IN SCOPE.</div>
          )}
        </div>
      </div>
    </div>
  );
}
