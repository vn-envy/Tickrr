/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * VenueStrip — the "where is the value?" visual for the active market.
 *
 * One horizontal probability axis, three venues plotted on it:
 *   ◆ Polymarket (orange) with its fair-value band (the real bid/ask range),
 *   ● Kalshi (cyan) when the same outcome trades there,
 *   ▲ Sportsbook consensus (green) — de-vigged mean across DraftKings/FanDuel/Pinnacle/etc.
 *
 * When the marks separate, someone is mispricing the outcome — that separation IS the edge.
 * Rendered with percentage-positioned HTML (not stretched SVG) so marks and labels stay
 * crisp and undistorted at every viewport width. Intel only: we show where prices disagree,
 * never what to do about it.
 */
import { SportsEntity } from "../types";
import { ExternalLink, GitCompareArrows } from "lucide-react";
import InfoTip from "./InfoTip";

interface Props {
  entity: SportsEntity;
}

export default function VenueStrip({ entity }: Props) {
  const poly = entity.impliedProb ?? entity.value;
  const kalshi = entity.divergence?.kalshi;
  const books = entity.divergence?.books;
  const bookCount = entity.divergence?.bookCount ?? 0;
  const bestBook = entity.divergence?.bestBook;
  const bestPrice = entity.divergence?.bestPrice;
  const lo = entity.fairLow ?? poly;
  const hi = entity.fairHigh ?? poly;

  const marks = [poly, kalshi, books].filter((v): v is number => typeof v === "number");
  if (marks.length < 2) {
    return (
      <div className="bg-[#0B0E11]/40 border border-[#2D333B] rounded px-3 py-3 flex flex-wrap items-center gap-2">
        <GitCompareArrows className="w-3.5 h-3.5 text-[#FF9900]" />
        <span className="font-mono text-[10px] font-bold">SINGLE-VENUE MARKET · {poly.toFixed(1)}%</span>
        <span className="text-[10px] text-[#D1D4DC]/40">Comparison will activate when a matching Kalshi or sportsbook quote is available.</span>
        {entity.url && (
          <a href={entity.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[9px] text-[#FF9900] hover:underline">
            OPEN MARKET <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // Zoom the axis around the marks so small separations stay readable.
  const min = Math.max(0, Math.min(...marks, lo) - 6);
  const max = Math.min(100, Math.max(...marks, hi) + 6);
  const pct = (v: number) => `${(((v - min) / Math.max(1e-6, max - min)) * 100).toFixed(2)}%`;

  const gapVs = kalshi != null ? "KALSHI" : "BOOKS";
  const gap = kalshi != null ? poly - kalshi : books != null ? poly - books : 0;

  return (
    <div className="bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl overflow-hidden backdrop-blur-md">
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompareArrows className="w-3.5 h-3.5 text-[#FF9900] shrink-0" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC] truncate">
            CROSS-VENUE VALUE: <span className="text-[#FF9900]">{entity.ticker}</span>
          </h2>
          <InfoTip metric="venues" />
        </div>
        <span
          className={`font-mono text-[10px] font-black whitespace-nowrap shrink-0 ${Math.abs(gap) >= 2 ? "text-[#FF9900]" : "text-[#D1D4DC]/50"}`}
          title={`Polymarket minus ${gapVs.toLowerCase()} in percentage points`}
        >
          Δ {gapVs} {gap >= 0 ? "+" : ""}{gap.toFixed(1)}pp
        </span>
      </div>

      {/* Axis track — percentage-positioned, immune to viewport stretching */}
      <div className="px-6 pt-3 pb-1 select-none">
        <div className="relative h-9">
          {/* baseline */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#2D333B]" />

          {/* scale labels */}
          <span className="absolute left-0 top-full -mt-1 font-mono text-[9px] text-[#D1D4DC]/35">{min.toFixed(0)}%</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 font-mono text-[9px] text-[#D1D4DC]/35">{((min + max) / 2).toFixed(0)}%</span>
          <span className="absolute right-0 top-full -mt-1 font-mono text-[9px] text-[#D1D4DC]/35">{max.toFixed(0)}%</span>

          {/* fair-value band (Polymarket bid/ask range) */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm bg-[#FF9900]/15 border border-[#FF9900]/20"
            style={{ left: pct(lo), width: `max(3px, calc(${pct(hi)} - ${pct(lo)}))` }}
            title={`Fair range ${lo.toFixed(1)}–${hi.toFixed(1)}% (bid/ask)`}
          />

          {/* venue marks — fixed-size, centered on their probability */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-[#FF9900] rounded-[2px] z-30"
            style={{ left: pct(poly) }}
            title={`Polymarket ${poly.toFixed(1)}%`}
          />
          {kalshi != null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#00C8FF] z-20"
              style={{ left: pct(kalshi) }}
              title={`Kalshi ${kalshi.toFixed(1)}%`}
            />
          )}
          {books != null && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#00FF66]"
              style={{ left: pct(books) }}
              title={`Sportsbook consensus ${books.toFixed(1)}% (${bookCount} quotes)`}
            />
          )}
        </div>
      </div>

      {/* readout */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] px-3 pb-2.5 pt-1.5 select-none">
        <span className="text-[#FF9900] font-bold whitespace-nowrap">◆ POLYMARKET {poly.toFixed(1)}%</span>
        {kalshi != null && <span className="text-[#00C8FF] font-bold whitespace-nowrap">● KALSHI {kalshi.toFixed(1)}%</span>}
        {books != null && (
          <span className="text-[#00FF66] font-bold whitespace-nowrap">
            ▲ BOOKS {books.toFixed(1)}%
            <span className="text-[#D1D4DC]/40 font-normal"> · {bookCount} quotes{bestBook && bestPrice ? ` · best ${bestPrice.toFixed(2)} @ ${bestBook}` : ""}</span>
          </span>
        )}
        <span className="ml-auto text-[#D1D4DC]/30 whitespace-nowrap hidden sm:inline">INTEL ONLY · NEVER A PICK</span>
      </div>
    </div>
  );
}
