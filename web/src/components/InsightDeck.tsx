/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * InsightDeck — aesthetic, filter-reactive intelligence charts for the terminal.
 * Everything here is derived from the currently filtered market universe so the
 * right pane always answers the left-rail selection (never a blank board).
 */
import type { ReactNode } from "react";
import { SportsEntity } from "../types";
import {
  BarChart3, TrendingUp, Droplets, Crosshair, Activity, Layers,
} from "lucide-react";
import InfoTip from "./InfoTip";

interface Props {
  entities: SportsEntity[];
  active: SportsEntity;
  onSelect: (e: SportsEntity) => void;
}

function Panel({
  title,
  icon,
  tip,
  children,
  right,
}: {
  title: string;
  icon: ReactNode;
  tip?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="bg-[#0B0E11]/40 border border-[#2D333B] rounded overflow-hidden backdrop-blur-md flex flex-col min-h-0">
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2 flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className="font-sans text-[11px] font-bold tracking-widest text-[#D1D4DC] truncate">{title}</h3>
          {tip}
        </div>
        {right}
      </div>
      <div className="p-3 flex-1">{children}</div>
    </div>
  );
}

function HBar({
  label,
  value,
  max,
  color,
  suffix = "",
  onClick,
  active,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
  onClick?: () => void;
  active?: boolean;
}): ReactNode {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left group cursor-pointer ${onClick ? "" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className={`font-mono text-[10px] truncate ${active ? "text-[#FF9900] font-bold" : "text-[#D1D4DC]/70 group-hover:text-white"}`}>
          {label}
        </span>
        <span className="font-mono text-[10px] font-bold shrink-0" style={{ color }}>
          {value >= 0 && suffix.includes("pp") ? "+" : ""}{typeof value === "number" ? value.toFixed(1) : value}{suffix}
        </span>
      </div>
      <div className="h-1.5 bg-[#1C2128] rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </button>
  );
}

/** Fair-value position meter for the active market. */
function FairMeter({ entity }: { entity: SportsEntity }) {
  const price = entity.impliedProb ?? entity.value;
  const lo = entity.fairLow ?? price - 2;
  const hi = entity.fairHigh ?? price + 2;
  const span = Math.max(hi - lo, 0.5);
  const pad = span * 0.4;
  const axisLo = Math.max(0, Math.min(price, lo) - pad);
  const axisHi = Math.min(100, Math.max(price, hi) + pad);
  const axis = Math.max(axisHi - axisLo, 1);
  const pct = (v: number) => `${(((v - axisLo) / axis) * 100).toFixed(2)}%`;
  const inBand = price >= lo && price <= hi;

  return (
    <div>
      <div className="relative h-10 mb-2">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#2D333B]" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm bg-[#FF9900]/18 border border-[#FF9900]/30"
          style={{ left: pct(lo), width: `max(4px, calc(${pct(hi)} - ${pct(lo)}))` }}
          title={`Fair ${lo.toFixed(1)}–${hi.toFixed(1)}%`}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-[#00FF66] z-10 shadow-[0_0_8px_rgba(0,255,102,0.45)]"
          style={{ left: pct(price) }}
          title={`Last ${price.toFixed(1)}%`}
        />
        <span className="absolute left-0 top-full font-mono text-[9px] text-[#D1D4DC]/35">{axisLo.toFixed(0)}%</span>
        <span className="absolute right-0 top-full font-mono text-[9px] text-[#D1D4DC]/35">{axisHi.toFixed(0)}%</span>
      </div>
      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className="text-[#D1D4DC]/45">BID/ASK BAND</span>
        <span className={`font-bold ${inBand ? "text-[#00FF66]" : "text-[#FF9900]"}`}>
          {inBand ? "INSIDE FAIR" : price < lo ? "BELOW FAIR" : "ABOVE FAIR"}
        </span>
      </div>
    </div>
  );
}

/** Compact SVG spark for breadth (up vs down). */
function BreadthBars({ up, down, flat }: { up: number; down: number; flat: number }) {
  const total = Math.max(1, up + down + flat);
  const segs = [
    { n: up, c: "#00FF66", label: "UP" },
    { n: flat, c: "#D1D4DC55", label: "FLAT" },
    { n: down, c: "#FF3B30", label: "DOWN" },
  ];
  let x = 0;
  return (
    <div>
      <svg viewBox="0 0 200 14" className="w-full h-3.5 mb-2" preserveAspectRatio="none">
        {segs.map((s) => {
          const w = (s.n / total) * 200;
          const el = <rect key={s.label} x={x} y={0} width={Math.max(w, s.n ? 1 : 0)} height={14} fill={s.c} rx={1} />;
          x += w;
          return el;
        })}
      </svg>
      <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
        <div><span className="text-[#00FF66] font-bold">{up}</span> <span className="text-[#D1D4DC]/40">UP</span></div>
        <div className="text-center"><span className="text-[#D1D4DC]/60 font-bold">{flat}</span> <span className="text-[#D1D4DC]/40">FLAT</span></div>
        <div className="text-right"><span className="text-[#FF3B30] font-bold">{down}</span> <span className="text-[#D1D4DC]/40">DOWN</span></div>
      </div>
    </div>
  );
}

function QualityMix({ entities }: { entities: SportsEntity[] }) {
  const counts = { good: 0, fair: 0, thin: 0, unknown: 0 };
  entities.forEach((e) => {
    const q = (e.decisionQuality || "").toLowerCase();
    if (q === "good") counts.good++;
    else if (q === "fair") counts.fair++;
    else if (q === "thin") counts.thin++;
    else counts.unknown++;
  });
  const total = Math.max(1, entities.length);
  const rows = [
    { k: "GOOD", n: counts.good, c: "#00FF66" },
    { k: "FAIR", n: counts.fair, c: "#FF9900" },
    { k: "THIN", n: counts.thin, c: "#FF3B30" },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.k}>
          <div className="flex justify-between font-mono text-[10px] mb-0.5">
            <span className="text-[#D1D4DC]/55">{r.k}</span>
            <span className="font-bold" style={{ color: r.c }}>{r.n} · {Math.round((r.n / total) * 100)}%</span>
          </div>
          <div className="h-2 bg-[#1C2128] rounded-sm overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${(r.n / total) * 100}%`, background: r.c }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InsightDeck({ entities, active, onSelect }: Props) {
  const up = entities.filter((e) => e.change > 0.05).length;
  const down = entities.filter((e) => e.change < -0.05).length;
  const flat = Math.max(0, entities.length - up - down);

  const gaps = [...entities]
    .map((e) => ({ e, gap: e.divergence?.booksGapPP ?? e.divergence?.gapPP ?? 0 }))
    .filter((x) => Math.abs(x.gap) >= 0.5)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 6);
  const maxGap = Math.max(1, ...gaps.map((g) => Math.abs(g.gap)));

  const movers = [...entities]
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 6);
  const maxMove = Math.max(1, ...movers.map((m) => Math.abs(m.change)));

  const liquid = [...entities]
    .filter((e) => (e.liquidityScore ?? e.efficiency ?? 0) > 0)
    .sort((a, b) => (b.liquidityScore ?? b.efficiency ?? 0) - (a.liquidityScore ?? a.efficiency ?? 0))
    .slice(0, 6);
  const maxLiq = Math.max(1, ...liquid.map((e) => e.liquidityScore ?? e.efficiency ?? 0));

  const signals = entities.filter((e) => e.dislocation).length;
  const avgGap = gaps.length
    ? gaps.reduce((s, g) => s + Math.abs(g.gap), 0) / gaps.length
    : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {/* Active fair meter */}
      <Panel
        title={`FAIR METER · ${active.ticker}`}
        icon={<Crosshair className="w-3.5 h-3.5 text-[#FF9900]" />}
        tip={<InfoTip metric="fairValue" />}
        right={
          <span className="font-mono text-[10px] text-[#00FF66] font-bold">{(active.impliedProb ?? active.value).toFixed(1)}%</span>
        }
      >
        <FairMeter entity={active} />
      </Panel>

      {/* Breadth */}
      <Panel
        title="MARKET BREADTH"
        icon={<Layers className="w-3.5 h-3.5 text-[#FF9900]" />}
        right={<span className="font-mono text-[9px] text-[#D1D4DC]/40">{entities.length} SCOPED</span>}
      >
        {entities.length === 0 ? (
          <div className="font-mono text-[11px] text-[#D1D4DC]/30 py-4 text-center">No markets in scope</div>
        ) : (
          <>
            <BreadthBars up={up} down={down} flat={flat} />
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
              <div className="bg-[#1C2128]/50 border border-[#2D333B] rounded px-2 py-1.5">
                <div className="text-[#D1D4DC]/35">SIGNALS</div>
                <div className="text-[#FF9900] font-bold text-sm">{signals}</div>
              </div>
              <div className="bg-[#1C2128]/50 border border-[#2D333B] rounded px-2 py-1.5">
                <div className="text-[#D1D4DC]/35">AVG |GAP|</div>
                <div className="text-[#00C8FF] font-bold text-sm">{avgGap.toFixed(1)}pp</div>
              </div>
            </div>
          </>
        )}
      </Panel>

      {/* Quality mix */}
      <Panel
        title="DECISION QUALITY"
        icon={<Activity className="w-3.5 h-3.5 text-[#FF9900]" />}
        tip={<InfoTip metric="quality" />}
      >
        {entities.length === 0 ? (
          <div className="font-mono text-[11px] text-[#D1D4DC]/30 py-4 text-center">No markets in scope</div>
        ) : (
          <QualityMix entities={entities} />
        )}
      </Panel>

      {/* Top gaps */}
      <Panel
        title="CROSS-VENUE GAPS"
        icon={<BarChart3 className="w-3.5 h-3.5 text-[#FF9900]" />}
        tip={<InfoTip metric="crossVenue" />}
      >
        {gaps.length === 0 ? (
          <div className="font-mono text-[11px] text-[#D1D4DC]/30 py-4 text-center">No material gaps in scope</div>
        ) : (
          <div className="space-y-2.5">
            {gaps.map(({ e, gap }) => (
              <div key={e.id}>
                <HBar
                  label={e.ticker}
                  value={gap}
                  max={maxGap}
                  color={gap >= 0 ? "#00FF66" : "#FF3B30"}
                  suffix="pp"
                  onClick={() => onSelect(e)}
                  active={e.id === active.id}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Top movers */}
      <Panel
        title="TOP MOVERS"
        icon={<TrendingUp className="w-3.5 h-3.5 text-[#FF9900]" />}
        tip={<InfoTip metric="change1w" />}
      >
        {movers.length === 0 ? (
          <div className="font-mono text-[11px] text-[#D1D4DC]/30 py-4 text-center">No movers</div>
        ) : (
          <div className="space-y-2.5">
            {movers.map((e) => (
              <div key={e.id}>
                <HBar
                  label={e.ticker}
                  value={e.change}
                  max={maxMove}
                  color={e.change >= 0 ? "#00FF66" : "#FF3B30"}
                  suffix=""
                  onClick={() => onSelect(e)}
                  active={e.id === active.id}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Liquidity ladder */}
      <Panel
        title="LIQUIDITY LADDER"
        icon={<Droplets className="w-3.5 h-3.5 text-[#FF9900]" />}
        tip={<InfoTip metric="liquidity" />}
      >
        {liquid.length === 0 ? (
          <div className="font-mono text-[11px] text-[#D1D4DC]/30 py-4 text-center">No liquidity data</div>
        ) : (
          <div className="space-y-2.5">
            {liquid.map((e) => {
              const v = e.liquidityScore ?? e.efficiency ?? 0;
              return (
                <div key={e.id}>
                  <HBar
                    label={e.ticker}
                    value={v}
                    max={maxLiq}
                    color="#00C8FF"
                    suffix=""
                    onClick={() => onSelect(e)}
                    active={e.id === active.id}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
