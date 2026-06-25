/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Player Dossier — shown when a player ticker is active. Surfaces country, Golden Boot price
 * + fair range, scorer rank in the field, cross-venue (Polymarket vs Kalshi goal-leader) gap,
 * and a link to the player's national team (with that team's attacking-threat rollup).
 */
import { useState, useEffect } from "react";
import { SportsEntity } from "../types";
import { fetchPlayer, PlayerCard } from "../api";
import { User, Flag, Trophy, ArrowRight } from "lucide-react";

interface Props {
  entity: SportsEntity;
  entities: SportsEntity[];
  onSelect: (e: SportsEntity) => void;
}

const norm = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function Sparkline({ series }: { series: { t: string; v: number }[] }) {
  if (!series || series.length < 2) return null;
  const w = 120;
  const h = 28;
  const vals = series.map((p) => p.v);
  const mn = Math.min(...vals);
  const rng = Math.max(...vals) - mn || 1;
  const d = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((p.v - mn) / rng) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible shrink-0">
      <path d={d} fill="none" stroke="#00FF66" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PlayerDossier({ entity, entities, onSelect }: Props) {
  const players = entities
    .filter((e) => e.category === "athlete")
    .sort((a, b) => b.value - a.value);
  const rank = players.findIndex((e) => e.id === entity.id) + 1;
  const total = players.length;

  const country = entity.playerCountry;
  const team = country
    ? entities.find((e) => e.category === "team" && norm(e.name) === norm(country))
    : undefined;

  const div = entity.divergence;

  const [card, setCard] = useState<PlayerCard>({});
  useEffect(() => {
    let on = true;
    fetchPlayer(entity.name).then((c) => { if (on) setCard(c); });
    return () => { on = false; };
  }, [entity.name]);

  return (
    <div className="bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl backdrop-blur-md overflow-hidden">
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">PLAYER DOSSIER</h2>
        </div>
        <span className="font-mono text-[10px] text-[#FF9900] font-bold">{entity.ticker}</span>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="col-span-2">
          <div className="text-white font-bold text-sm font-sans">{entity.name}</div>
          {country && (
            <div className="text-[#D1D4DC]/50 text-[11px] flex items-center gap-1 mt-0.5">
              <Flag className="w-3 h-3 text-[#00FF66]" /> {country}
            </div>
          )}
        </div>
        <div>
          <div className="text-[9px] text-[#FF9900]/70 font-bold tracking-wider">GOLDEN BOOT</div>
          <div className="text-[#00FF66] font-black text-lg leading-tight">{entity.value.toFixed(1)}%</div>
          <div className="text-[9px] text-[#D1D4DC]/40">
            fair [{(entity.fairLow ?? entity.value).toFixed(1)}–{(entity.fairHigh ?? entity.value).toFixed(1)}]
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#FF9900]/70 font-bold tracking-wider">SCORER RANK</div>
          <div className="text-white font-black text-lg leading-tight flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[#FF9900]" />#{rank || "—"}
          </div>
          <div className="text-[9px] text-[#D1D4DC]/40">of {total} in field</div>
        </div>
      </div>

      <div className="px-3 pb-3 flex flex-col sm:flex-row gap-2 font-mono text-[11px]">
        {div && (
          <div className="flex-1 bg-[#1C2128]/40 border border-[#2D333B] rounded p-2">
            <div className="text-[9px] text-[#D1D4DC]/50 font-bold tracking-wider mb-0.5">CROSS-VENUE (vs KALSHI)</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span>POLY <span className="text-white font-bold">{div.polymarket.toFixed(1)}%</span></span>
              <span className="text-[#D1D4DC]/30">/</span>
              <span>KALSHI <span className="text-white font-bold">{div.kalshi.toFixed(1)}%</span></span>
              <span className={`font-black ${div.gapPP >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                {div.gapPP >= 0 ? "+" : ""}{div.gapPP.toFixed(1)}pp
              </span>
            </div>
          </div>
        )}
        {team && (
          <button
            onClick={() => onSelect(team)}
            className="cursor-pointer flex-1 text-left bg-[#1C2128]/40 border border-[#2D333B] rounded p-2 hover:border-[#FF9900]/50 transition"
          >
            <div className="text-[9px] text-[#D1D4DC]/50 font-bold tracking-wider mb-0.5">NATIONAL TEAM</div>
            <div className="flex items-center justify-between">
              <span className="text-[#FF9900] font-bold">
                {team.name} <span className="text-white">{team.value.toFixed(1)}%</span> to win
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#FF9900]" />
            </div>
            {team.enrichment?.attackingThreat != null && (
              <div className="text-[9px] text-[#00FF66]/70 mt-0.5">
                attacking threat {team.enrichment.attackingThreat.toFixed(0)}%
              </div>
            )}
          </button>
        )}
      </div>

      {(card.goalLeader || card.toScore || card.scoreOrAssist || card.assists) && (
        <div className="px-3 pb-3">
          <div className="text-[9px] text-[#D1D4DC]/50 font-bold tracking-wider mb-1 font-mono">KALSHI PLAYER MARKETS</div>
          <div className="flex gap-2 flex-wrap font-mono text-[11px] items-center">
            {[
              { k: card.goalLeader, label: "Goal Leader" },
              { k: card.toScore, label: "To Score" },
              { k: card.scoreOrAssist, label: "Goal+Assist" },
              { k: card.assists, label: card.assists?.threshold ? `${card.assists.threshold} Assists` : "Assists" },
            ]
              .filter((c) => c.k)
              .map((c, i) => (
                <a key={i} href={c.k!.url} target="_blank" rel="noreferrer" className="bg-[#1C2128]/40 border border-[#2D333B] rounded px-2 py-1 hover:border-[#FF9900]/50 transition">
                  <span className="text-[#D1D4DC]/50">{c.label} </span>
                  <span className="text-white font-bold">{c.k!.prob.toFixed(1)}%</span>
                </a>
              ))}
            <span className="text-[8px] text-[#D1D4DC]/30">via Kalshi</span>
          </div>
        </div>
      )}

      {card.buzz && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] text-[#D1D4DC]/50 font-bold tracking-wider font-mono">ATTENTION · WIKIPEDIA</div>
            {card.buzz.spike >= 1.5 && (
              <span className="text-[9px] font-mono font-bold text-[#00FF66] terminal-glow-green">▲ {card.buzz.spike.toFixed(1)}× BUZZ</span>
            )}
          </div>
          <div className="flex items-center gap-3 bg-[#1C2128]/40 border border-[#2D333B] rounded p-2">
            <Sparkline series={card.buzz.series} />
            <div className="font-mono text-[10px] text-[#D1D4DC]/60 leading-tight">
              <div><span className="text-white font-bold">{card.buzz.latest.toLocaleString()}</span> peak/day</div>
              <div className="text-[#D1D4DC]/40">base {card.buzz.baseline.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {card.news && card.news.articles.length > 0 && (
        <div className="px-3 pb-3">
          <div className="text-[9px] text-[#D1D4DC]/50 font-bold tracking-wider mb-1 font-mono">RECENT NEWS · GDELT</div>
          <ul className="space-y-1">
            {card.news.articles.map((a, i) => (
              <li key={i} className="text-[11px] leading-tight font-sans">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-[#D1D4DC]/80 hover:text-[#00FF66] transition">
                  • {a.title}
                </a>
                {a.domain && <span className="text-[#D1D4DC]/30 text-[9px]"> — {a.domain}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
