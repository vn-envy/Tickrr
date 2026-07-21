import { Activity, BarChart3, Gauge, Waves } from "lucide-react";
import { SportsEntity } from "../types";
import { marketEdge } from "./TerminalSidebar";

interface Props {
  entities: SportsEntity[];
}

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export default function MarketPulse({ entities }: Props) {
  const up = entities.filter((entity) => (entity.oneWeekChange ?? entity.change) > 0).length;
  const down = entities.filter((entity) => (entity.oneWeekChange ?? entity.change) < 0).length;
  const flat = Math.max(0, entities.length - up - down);
  const breadth = entities.length ? Math.round((up / entities.length) * 100) : 0;
  const avgLiquidity = average(entities.map((entity) => entity.liquidityScore ?? 0));
  const avgEdge = average(entities.map(marketEdge));
  const totalVolume = entities.reduce((sum, entity) => sum + (entity.volume ?? 0), 0);
  const signals = entities.filter((entity) => entity.dislocation).length;
  const maxMove = Math.max(1, ...entities.map((entity) => Math.abs(entity.oneWeekChange ?? entity.change)));
  const leaders = [...entities]
    .sort((a, b) => Math.abs(b.oneWeekChange ?? b.change) - Math.abs(a.oneWeekChange ?? a.change))
    .slice(0, 5);

  const metrics = [
    { label: "ADVANCE BREADTH", value: `${breadth}%`, sub: `${up} up · ${down} down · ${flat} flat`, icon: Activity, color: "#00FF66" },
    { label: "MEAN LIQUIDITY", value: avgLiquidity.toFixed(0), sub: "decision-depth score", icon: Gauge, color: "#00C8FF" },
    { label: "MEAN VENUE GAP", value: `${avgEdge.toFixed(1)}pp`, sub: `${signals} dislocation signals`, icon: Waves, color: "#FF9900" },
    { label: "SCREENED VOLUME", value: compact(totalVolume), sub: `${entities.length} contracts`, icon: BarChart3, color: "#D1D4DC" },
  ];

  return (
    <section className="bg-[#0B0E11]/50 border border-[#2D333B] rounded overflow-hidden shadow-xl">
      <div className="px-3 py-2 border-b border-[#2D333B] bg-[#0B0E11] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest">MARKET PULSE</h2>
        </div>
        <span className="font-mono text-[9px] text-[#D1D4DC]/40">FILTER-AWARE · LIVE SNAPSHOT</span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-y xl:divide-y-0 divide-[#2D333B]">
        {metrics.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="p-3 min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[8px] tracking-wider text-[#D1D4DC]/40">
              <Icon className="w-3 h-3" style={{ color }} /> {label}
            </div>
            <div className="mt-1 font-mono text-xl font-black" style={{ color }}>{value}</div>
            <div className="text-[9px] text-[#D1D4DC]/35 truncate">{sub}</div>
          </div>
        ))}
      </div>
      {leaders.length > 0 && (
        <div className="border-t border-[#2D333B] p-3">
          <div className="terminal-label mb-2">MOMENTUM DISTRIBUTION · TOP ABSOLUTE MOVES</div>
          <div className="space-y-1.5">
            {leaders.map((entity) => {
              const move = entity.oneWeekChange ?? entity.change;
              return (
                <div key={entity.id} className="grid grid-cols-[72px_1fr_52px] items-center gap-2 font-mono text-[9px]">
                  <span className="truncate text-[#D1D4DC]/60">{entity.ticker}</span>
                  <div className="h-1.5 bg-[#050608] rounded overflow-hidden">
                    <div
                      className={`h-full rounded ${move >= 0 ? "bg-[#00FF66]" : "bg-[#FF3B30]"}`}
                      style={{ width: `${Math.max(3, Math.abs(move) / maxMove * 100)}%` }}
                    />
                  </div>
                  <span className={`text-right font-bold ${move >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                    {move >= 0 ? "+" : ""}{move.toFixed(1)}pp
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
