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
 * Intel only: we show where prices disagree, never what to do about it.
 */
import { SportsEntity } from "../types";
import { GitCompareArrows } from "lucide-react";
import InfoTip from "./InfoTip";

interface Props {
  entity: SportsEntity;
}

const W = 600;
const H = 74;
const PAD = 46;

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
  if (marks.length < 2) return null; // single-venue market — nothing to compare

  // Zoom the axis around the marks so small separations stay readable.
  const min = Math.max(0, Math.min(...marks, lo) - 6);
  const max = Math.min(100, Math.max(...marks, hi) + 6);
  const x = (v: number) => PAD + ((v - min) / Math.max(1e-6, max - min)) * (W - PAD * 2);
  const midY = H / 2 + 6;

  const gapVs = kalshi != null ? "KALSHI" : "BOOKS";
  const gap = kalshi != null ? poly - kalshi : books != null ? poly - books : 0;

  return (
    <div className="bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl overflow-hidden backdrop-blur-md">
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">
            CROSS-VENUE VALUE: <span className="text-[#FF9900]">{entity.ticker}</span>
          </h2>
          <InfoTip metric="venues" />
        </div>
        <span
          className={`font-mono text-[10px] font-black ${Math.abs(gap) >= 2 ? "text-[#FF9900]" : "text-[#D1D4DC]/50"}`}
          title={`Polymarket minus ${gapVs.toLowerCase()} in percentage points`}
        >
          Δ {gapVs} {gap >= 0 ? "+" : ""}{gap.toFixed(1)}pp
        </span>
      </div>

      <div className="px-3 pt-1 pb-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[74px]" preserveAspectRatio="none">
          {/* axis */}
          <line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="#2D333B" strokeWidth={1} />
          {[min, (min + max) / 2, max].map((t, i) => (
            <g key={i}>
              <line x1={x(t)} y1={midY - 3} x2={x(t)} y2={midY + 3} stroke="#2D333B" strokeWidth={1} />
              <text x={x(t)} y={midY + 16} textAnchor="middle" fontSize={9} fill="#D1D4DC" opacity={0.35} fontFamily="monospace">
                {t.toFixed(0)}%
              </text>
            </g>
          ))}

          {/* fair-value band (Polymarket bid/ask range) */}
          <rect x={x(lo)} y={midY - 7} width={Math.max(2, x(hi) - x(lo))} height={14} rx={2} fill="#FF9900" opacity={0.14}>
            <title>{`Fair range ${lo.toFixed(1)}–${hi.toFixed(1)}% (bid/ask)`}</title>
          </rect>

          {/* venue marks */}
          <g>
            <polygon
              points={`${x(poly)},${midY - 9} ${x(poly) + 6},${midY} ${x(poly)},${midY + 9} ${x(poly) - 6},${midY}`}
              fill="#FF9900"
            >
              <title>{`Polymarket ${poly.toFixed(1)}%`}</title>
            </polygon>
            {kalshi != null && (
              <circle cx={x(kalshi)} cy={midY} r={5} fill="#00C8FF">
                <title>{`Kalshi ${kalshi.toFixed(1)}%`}</title>
              </circle>
            )}
            {books != null && (
              <polygon points={`${x(books)},${midY - 8} ${x(books) + 6},${midY + 7} ${x(books) - 6},${midY + 7}`} fill="#00FF66">
                <title>{`Sportsbook consensus ${books.toFixed(1)}% (${bookCount} quotes)`}</title>
              </polygon>
            )}
          </g>
        </svg>

        {/* readout */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] pt-0.5 select-none">
          <span className="text-[#FF9900] font-bold">◆ POLYMARKET {poly.toFixed(1)}%</span>
          {kalshi != null && <span className="text-[#00C8FF] font-bold">● KALSHI {kalshi.toFixed(1)}%</span>}
          {books != null && (
            <span className="text-[#00FF66] font-bold">
              ▲ BOOKS {books.toFixed(1)}%
              <span className="text-[#D1D4DC]/40 font-normal"> · {bookCount} quotes{bestBook && bestPrice ? ` · best ${bestPrice.toFixed(2)} @ ${bestBook}` : ""}</span>
            </span>
          )}
          <span className="ml-auto text-[#D1D4DC]/30">INTEL ONLY · NEVER A PICK</span>
        </div>
      </div>
    </div>
  );
}
