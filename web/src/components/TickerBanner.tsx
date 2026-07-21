/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SportsEntity } from "../types";

interface TickerBannerProps {
  entities: SportsEntity[];
  onSelectEntity: (entity: SportsEntity) => void;
}

export default function TickerBanner({ entities, onSelectEntity }: TickerBannerProps) {
  // Double list to create seamless infinite scrolling marquee
  const doubleList = [...entities, ...entities, ...entities];
  // Duration scales with the list so a long board scrolls at a readable pace.
  const speed = Math.max(90, entities.length * 1.5);

  return (
    <div 
      className="w-full bg-[#0B0E11] border-y border-[#2D333B] h-10 overflow-hidden flex items-center relative z-20"
      id="ticker-banner-bar"
    >
      {/* Scroll indicator/label */}
      <div className="absolute left-0 top-0 bottom-0 bg-[#0B0E11] border-r border-[#2D333B] text-[10px] font-mono px-4 flex items-center gap-1.5 text-[#FF9900] font-bold z-10 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink" />
        TICKER FEED
      </div>

      {/* Marquee Wrapper */}
      <div className="w-full flex pl-36">
        <div
          className="flex whitespace-nowrap hover:[animation-play-state:paused] gap-8 py-1.5"
          style={{
            animation: `marquee ${speed}s linear infinite`
          }}
        >
          {doubleList.map((item, index) => {
            const isPositive = item.change >= 0;
            return (
              <button
                key={`${item.id}-${index}`}
                onClick={() => onSelectEntity(item)}
                className="flex items-center gap-2 font-mono text-[11px] cursor-pointer hover:bg-[#1C2128] px-2 py-0.5 rounded transition duration-150 select-none text-[#D1D4DC]"
              >
                <span className="text-[#D1D4DC]/60 font-medium">{item.ticker}</span>
                <span className="text-white font-bold">{item.value.toFixed(1)}</span>
                <span 
                  className={`font-semibold flex items-center gap-0.5 ${
                    isPositive ? "text-[#00FF66]" : "text-[#FF3B30]"
                  }`}
                >
                  <span>{isPositive ? "▲" : "▼"}</span>
                  <span>{Math.abs(item.change).toFixed(2)}%</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Keyframe simulation in CSS inside style block to avoid adding separate stylesheet */}
      <style>{`
        @keyframes marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(-33.3333%, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}
