/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { SportsEntity } from "../types";
import { fetchHistory } from "../api";
import { Activity, TrendingUp } from "lucide-react";

interface TelemetryChartProps {
  entity: SportsEntity;
}

type Timeframe = "1w" | "1m" | "max";
interface Point { t: number; v: number } // v = implied probability in %

export default function TelemetryChart({ entity }: TelemetryChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [series, setSeries] = useState<Point[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Pull the real implied-probability series for this market's Yes token.
  useEffect(() => {
    let cancelled = false;
    const token = entity.clobTokenId;
    const current = entity.impliedProb ?? entity.value;

    if (!token) {
      setSeries([{ t: 0, v: Number(current.toFixed(2)) }]);
      setLive(false);
      return;
    }
    setLoading(true);
    fetchHistory(token, timeframe)
      .then((pts) => {
        if (cancelled) return;
        const mapped = pts.map((p) => ({ t: p.t, v: Number((p.p * 100).toFixed(2)) }));
        if (mapped.length) {
          setSeries(mapped);
          setLive(true);
        } else {
          setSeries([{ t: 0, v: Number(current.toFixed(2)) }]);
          setLive(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [entity.clobTokenId, entity.impliedProb, entity.value, timeframe]);

  const values = series.map((p) => p.v);
  const hasData = values.length > 0;
  const maxVal = hasData ? Math.max(...values) * 1.05 + 0.001 : 1;
  const minVal = hasData ? Math.min(...values) * 0.95 : 0;
  const dataRange = maxVal - minVal || 1;

  const width = 600;
  const height = 220;
  const paddingX = 44;
  const paddingY = 25;
  const denom = Math.max(1, series.length - 1);

  const points = series.map((pt, i) => {
    const x = paddingX + (i / denom) * (width - paddingX * 2);
    const y = height - paddingY - ((pt.v - minVal) / dataRange) * (height - paddingY * 2);
    return { x, y, v: pt.v, t: pt.t };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
    : "";

  const highValue = hasData ? Math.max(...values) : 0;
  const lowValue = hasData ? Math.min(...values) : 0;
  const avgValue = hasData ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const lastValue = hasData ? values[values.length - 1] : 0;
  const firstValue = hasData ? values[0] : 0;
  const netChange = lastValue - firstValue;

  const fmtDate = (t: number) => (t > 100000 ? new Date(t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : `t-${points.length - 1}`);

  return (
    <div
      className="flex flex-col h-full bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl overflow-hidden relative backdrop-blur-md"
      id="terminal-telemetry-chart"
    >
      {/* Header Panel */}
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">
            IMPLIED PROBABILITY: <span className="text-[#FF9900] terminal-glow-orange">{entity.ticker}</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className={`w-2 h-2 rounded-full ${live ? "bg-[#00FF66] led-blink" : "bg-[#FF9900]"}`} />
          <span className={live ? "text-[#00FF66] font-semibold" : "text-[#FF9900] font-semibold"}>
            {loading ? "LOADING…" : live ? "POLYMARKET CLOB" : "MODELED"}
          </span>
        </div>
      </div>

      {/* Timeframe Selectors */}
      <div className="p-2 border-b border-[#2D333B] bg-[#0B0E11]/30 flex flex-wrap gap-1.5 font-mono text-[10px]">
        {([["1w", "1W"], ["1m", "1M"], ["max", "ALL"]] as [Timeframe, string][]).map(([tf, label]) => (
          <button
            key={tf}
            type="button"
            onClick={() => { setTimeframe(tf); setHoverIndex(null); }}
            className={`cursor-pointer px-2.5 py-1 rounded border transition ${
              timeframe === tf
                ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900] font-bold"
                : "border-[#2D333B] hover:bg-[#1C2128]/60 text-[#D1D4DC]/50"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-1 text-[#D1D4DC]/40">
          <span className="font-sans">NET</span>
          <span className={netChange >= 0 ? "text-[#00FF66] font-bold" : "text-[#FF3B30] font-bold"}>
            {netChange >= 0 ? "+" : ""}{netChange.toFixed(2)}pp
          </span>
        </div>
      </div>

      {/* SVG Interactive Chart Stage */}
      <div className="flex-1 min-h-[220px] p-2 relative flex flex-col justify-between">
        <div className="absolute top-3 left-4 select-none pointer-events-none">
          <span className="font-sans text-[11px] text-[#FF9900] tracking-widest font-bold">
            IMPLIED PROBABILITY (%)
          </span>
        </div>

        <div className="flex-1 w-full relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" id="telemetry-chart-canvas">
            <defs>
              <linearGradient id="chart-glow-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FF66" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#00FF66" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid Lines + Y labels */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y = paddingY + (i / 4) * (height - paddingY * 2);
              const gridVal = maxVal - (i / 4) * dataRange;
              return (
                <g key={i}>
                  <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#2D333B" strokeWidth="0.5" strokeDasharray="2 3" />
                  <text x={paddingX - 8} y={y + 3} fill="#D1D4DC" fillOpacity="0.3" fontSize="9" fontFamily="JetBrains Mono" textAnchor="end">
                    {gridVal.toFixed(1)}
                  </text>
                </g>
              );
            })}

            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#2D333B" strokeWidth="1" />

            {/* Sparse X date labels */}
            {points.length > 0 && [0, Math.floor(points.length / 2), points.length - 1]
              .filter((v, idx, arr) => arr.indexOf(v) === idx)
              .map((idx) => (
                <text key={idx} x={points[idx].x} y={height - paddingY + 14} fill="#D1D4DC" fillOpacity="0.3" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">
                  {fmtDate(points[idx].t)}
                </text>
              ))}

            {areaPath && <path d={areaPath} fill="url(#chart-glow-gradient)" />}
            {linePath && <path d={linePath} fill="none" stroke="#00FF66" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

            {points.map((p, i) => {
              const isHovered = hoverIndex === i;
              return (
                <g key={i}>
                  <rect x={p.x - (width / Math.max(points.length, 1)) / 2} y={0} width={width / Math.max(points.length, 1)} height={height} fill="transparent" className="cursor-pointer"
                    onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} />
                  {(isHovered || points.length <= 1 || i === points.length - 1) && (
                    <circle cx={p.x} cy={p.y} r={isHovered ? 6 : 3.5} fill={isHovered ? "#00FF66" : "#050608"} stroke="#00FF66" strokeWidth="2" className="transition-all duration-100" />
                  )}
                  {isHovered && (
                    <g>
                      <line x1={p.x} y1={p.y} x2={p.x} y2={height - paddingY} stroke="#00FF66" strokeWidth="1" strokeDasharray="2 2" />
                      <line x1={paddingX} y1={p.y} x2={p.x} y2={p.y} stroke="#00FF66" strokeWidth="1" strokeDasharray="2 2" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Quantitative statistics board */}
        <div className="bg-[#0B0E11] border-t border-[#2D333B] px-3 py-2.5 grid grid-cols-3 divide-x divide-[#2D333B] font-mono text-[10px] select-none text-[#D1D4DC]/40">
          <div className="flex flex-col gap-0.5 justify-center">
            <span className="font-sans font-bold tracking-wider text-[#FF9900]/70">PERIOD HIGH</span>
            <span className="text-[#00FF66] font-bold font-mono text-xs">{highValue.toFixed(2)}%</span>
          </div>
          <div className="flex flex-col gap-0.5 pl-3 justify-center">
            <span className="font-sans font-bold tracking-wider text-[#FF9900]/70">MEAN</span>
            <span className="text-[#FF9900] font-bold font-mono text-xs">{avgValue.toFixed(2)}%</span>
          </div>
          <div className="flex flex-col gap-0.5 pl-3 justify-center">
            <span className="font-sans font-bold tracking-wider text-[#FF9900]/70">PERIOD LOW</span>
            <span className="text-white font-bold font-mono text-xs">{lowValue.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Floating tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div className="absolute top-12 right-4 bg-[#1C2128] border border-[#FF9900]/50 rounded p-2.5 shadow-2xl font-mono text-[10px] z-15 pointer-events-none text-[#D1D4DC] animate-fade-in">
          <div className="text-[9px] text-[#D1D4DC]/40 font-bold mb-1">MARKET READING</div>
          <div className="font-bold flex items-center gap-1.5 mb-0.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#00FF66]" />
            <span className="text-[#D1D4DC]/70">PROB:</span>
            <span className="text-[#00FF66] font-bold">{points[hoverIndex].v.toFixed(2)}%</span>
          </div>
          <div className="text-[#D1D4DC]/50">{fmtDate(points[hoverIndex].t)}</div>
        </div>
      )}
    </div>
  );
}
