/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { SportsEntity } from "../types";
import { Activity, TrendingUp, Info } from "lucide-react";

interface TelemetryChartProps {
  entity: SportsEntity;
}

type MetricType = "stamina" | "efficiency" | "speed" | "playmaking" | "defense";

export default function TelemetryChart({ entity }: TelemetryChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricType>("efficiency");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Get matching history data based on selected metric
  const getHistory = (): number[] => {
    switch (activeMetric) {
      case "stamina":
        return entity.staminaHistory || [80, 81, 82, 83, 84, 85, 84, 83, 82, 82];
      case "efficiency":
        return entity.efficiencyHistory || [25, 26, 27, 28, 27, 26, 28, 29, 30, 27.8];
      case "speed":
        return entity.speedHistory || [78, 79, 80, 81, 80, 79, 81, 82, 83, 85];
      case "playmaking":
        return entity.playmakingHistory || [85, 86, 87, 88, 89, 90, 91, 92, 93, 94];
      case "defense":
        return entity.defenseHistory || [75, 76, 75, 74, 76, 77, 78, 77, 76, 75];
    }
  };

  const history = getHistory();
  const maxVal = Math.max(...history) * 1.05;
  const minVal = Math.min(...history) * 0.95;
  const range = maxVal - minVal;

  // Chart layout dimensions
  const width = 600;
  const height = 220;
  const paddingX = 40;
  const paddingY = 25;

  // Map coordinates to SVG viewbox
  const points = history.map((val, i) => {
    const x = paddingX + (i / (history.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((val - minVal) / range) * (height - paddingY * 2);
    return { x, y, val };
  });

  // Build the SVG path string for the line
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Build the SVG path string for the gradient area under the line
  const areaPath = `
    ${linePath} 
    L ${points[points.length - 1].x} ${height - paddingY} 
    L ${points[0].x} ${height - paddingY} 
    Z
  `;

  // Standard Bloomberg Terminal metrics helpers
  const averageValue = history.reduce((a, b) => a + b, 0) / history.length;
  const highValue = Math.max(...history);
  const lowValue = Math.min(...history);

  const metricLabel = (type: MetricType): string => {
    switch (type) {
      case "stamina": return "STAMINA LOAD INDEX";
      case "efficiency": return "PER SYSTEM EFFICIENCY";
      case "speed": return "BURST VELOCITY CAP (KM/H)";
      case "playmaking": return "PLAYMAKING RATIO (EXPECTED THREAT)";
      case "defense": return "SPATIAL DEFENSIVE COVERAGE";
    }
  };

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
            REAL-TIME TELEMETRY VECTORS: <span className="text-[#FF9900] terminal-glow-orange">{entity.ticker}</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="w-2 h-2 rounded-full bg-[#00FF66] led-blink" />
          <span className="text-[#00FF66] font-semibold">FEED ACTIVE</span>
        </div>
      </div>

      {/* Metric Selectors */}
      <div className="p-2 border-b border-[#2D333B] bg-[#0B0E11]/30 flex flex-wrap gap-1.5 font-mono text-[10px]">
        {(["efficiency", "stamina", "speed", "playmaking", "defense"] as MetricType[]).map((metric) => (
          <button
            key={metric}
            type="button"
            onClick={() => {
              setActiveMetric(metric);
              setHoverIndex(null);
            }}
            className={`cursor-pointer px-2.5 py-1 rounded border transition ${
              activeMetric === metric
                ? "border-[#FF9900]/50 bg-[#FF9900]/10 text-[#FF9900] font-bold"
                : "border-[#2D333B] hover:bg-[#1C2128]/60 text-[#D1D4DC]/50"
            }`}
          >
            {metric.toUpperCase()}
          </button>
        ))}
      </div>

      {/* SVG Interactive Chart Stage */}
      <div className="flex-1 min-h-[220px] p-2 relative flex flex-col justify-between">
        {/* Metric Label indicator overlay */}
        <div className="absolute top-3 left-4 select-none pointer-events-none">
          <span className="font-sans text-[11px] text-[#FF9900] tracking-widest font-bold">
            {metricLabel(activeMetric)}
          </span>
        </div>

        {/* The SVG Canvas */}
        <div className="flex-1 w-full relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            id="telemetry-chart-canvas"
          >
            {/* Gradient Definitions */}
            <defs>
              <linearGradient id="chart-glow-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FF66" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#00FF66" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y = paddingY + (i / 4) * (height - paddingY * 2);
              const gridVal = maxVal - (i / 4) * range;
              return (
                <g key={i}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="#2D333B"
                    strokeWidth="0.5"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    fill="#D1D4DC"
                    fillOpacity="0.3"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    textAnchor="end"
                  >
                    {gridVal.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Bottom X Axis line */}
            <line
              x1={paddingX}
              y1={height - paddingY}
              x2={width - paddingX}
              y2={height - paddingY}
              stroke="#2D333B"
              strokeWidth="1"
            />

            {/* X Axis Time Labels */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={height - paddingY + 14}
                fill="#D1D4DC"
                fillOpacity="0.3"
                fontSize="9"
                fontFamily="JetBrains Mono"
                textAnchor="middle"
              >
                t-{10 - i}
              </text>
            ))}

            {/* Gradient Area under curve */}
            <path d={areaPath} fill="url(#chart-glow-gradient)" />

            {/* Telemetry Main Line */}
            <path
              d={linePath}
              fill="none"
              stroke="#00FF66" // Bright matrix green
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Render interactive hover crosshair and points */}
            {points.map((p, i) => {
              const isHovered = hoverIndex === i;
              return (
                <g key={i}>
                  {/* Invisible wide mouse-catcher areas */}
                  <rect
                    x={p.x - 20}
                    y={0}
                    width={40}
                    height={height}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />

                  {/* Draw grid marker dots */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6 : 3.5}
                    fill={isHovered ? "#00FF66" : "#050608"}
                    stroke="#00FF66"
                    strokeWidth="2"
                    className="transition-all duration-100"
                  />

                  {/* Interactive crosshair */}
                  {isHovered && (
                    <g>
                      {/* Vertical line to baseline */}
                      <line
                        x1={p.x}
                        y1={p.y}
                        x2={p.x}
                        y2={height - paddingY}
                        stroke="#00FF66"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      {/* Horizontal line to left scale */}
                      <line
                        x1={paddingX}
                        y1={p.y}
                        x2={p.x}
                        y2={p.y}
                        stroke="#00FF66"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
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
            <span className="font-sans font-bold tracking-wider text-[#FF9900]/70">HIGH METRIC INDEX</span>
            <span className="text-[#00FF66] font-bold font-mono text-xs">{highValue.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-0.5 pl-3 justify-center">
            <span className="font-sans font-bold tracking-wider text-[#FF9900]/70">AVERAGE COEF (MA-10)</span>
            <span className="text-[#FF9900] font-bold font-mono text-xs">{averageValue.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-0.5 pl-3 justify-center">
            <span className="font-sans font-bold tracking-wider text-[#FF9900]/70">LOW RANGE BASE</span>
            <span className="text-white font-bold font-mono text-xs">{lowValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Floating coordinates Tooltip */}
      {hoverIndex !== null && (
        <div className="absolute top-12 right-4 bg-[#1C2128] border border-[#FF9900]/50 rounded p-2.5 shadow-2xl font-mono text-[10px] z-15 pointer-events-none text-[#D1D4DC] animate-fade-in">
          <div className="text-[9px] text-[#D1D4DC]/40 font-bold mb-1">TELEMETRY READING</div>
          <div className="font-bold flex items-center gap-1.5 mb-0.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#00FF66]" />
            <span className="text-[#D1D4DC]/70">VALUE:</span>
            <span className="text-[#00FF66] font-bold">{points[hoverIndex].val.toFixed(2)}</span>
          </div>
          <div className="text-[#D1D4DC]/50">EPOCH: t-{10 - hoverIndex}</div>
        </div>
      )}
    </div>
  );
}
