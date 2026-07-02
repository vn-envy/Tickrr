/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * My Space — the user's personal dashboard of saved markets (teams / players they follow),
 * with live prices, moves, and any dislocation signal. Backed by the watchlist (localStorage now;
 * per-user Firestore once signed in). Intel only.
 */
import { SportsEntity } from "../types";
import { getFavorites, toggleFavorite } from "../lib/watchlist";
import { Star, X, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  entities: SportsEntity[];
  onSelect: (e: SportsEntity) => void;
  user?: { name?: string | null } | null;
}

export default function MySpace({ open, onClose, entities, onSelect, user }: Props) {
  const [favorites, setFavorites] = useState<Set<string>>(() => getFavorites());

  // Refresh from the store each time the panel opens (it stays mounted while closed).
  useEffect(() => {
    if (open) setFavorites(getFavorites());
  }, [open]);

  if (!open) return null;

  const saved = entities.filter((e) => favorites.has(e.id));
  const remove = (id: string) => setFavorites(new Set(toggleFavorite(id)));

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-mono">
      <div className="relative w-full max-w-3xl h-[82vh] bg-[#050608] border border-[#FF9900]/40 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(255,153,0,0.15)] scanline-overlay flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#FF9900]/30 bg-[#050608]/80">
          <div className="flex items-center gap-2 text-[#FF9900] terminal-glow-orange">
            <Star className="w-4 h-4 fill-[#FF9900]" />
            <span className="text-xs font-bold tracking-widest">MY SPACE · WATCHLIST</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-[#D1D4DC]/40">
              {user?.name ? `Synced · ${user.name}` : "Saved on this device"}
            </span>
            <button onClick={onClose} className="cursor-pointer text-[#FF9900]/60 hover:text-[#FF9900]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {saved.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-8">
              <Star className="w-10 h-10 text-[#FF9900]/40" />
              <div className="text-[#FF9900] text-sm font-bold tracking-widest">YOUR SPACE IS EMPTY</div>
              <p className="text-[#D1D4DC]/50 text-[11px] font-sans max-w-sm leading-relaxed">
                Tap the ★ on any market in the screener to follow a team or player. They'll live here
                with their price, move, and any edge signal — your own board.
              </p>
            </div>
          ) : (
            saved.map((e) => (
              <div
                key={e.id}
                onClick={() => { onSelect(e); onClose(); }}
                className="group cursor-pointer bg-[#0B0E11]/60 border border-[#2D333B] hover:border-[#FF9900]/40 rounded p-3 flex items-center justify-between gap-3 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#FF9900] font-bold tracking-wider text-sm">{e.ticker}</span>
                    {e.league && <span className="text-[8px] uppercase text-[#D1D4DC]/40 border border-[#2D333B] rounded px-1">{e.league}</span>}
                  </div>
                  <div className="text-[11px] text-[#D1D4DC]/60 font-sans truncate">{e.name} · {(e.team || e.sport).toUpperCase()}</div>
                  {e.dislocation && (
                    <span className="mt-1 inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded bg-[#FF9900]/15 text-[#FF9900]">
                      ⚡ {e.dislocation.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-white font-bold text-sm">{e.value.toFixed(1)}%</div>
                    <div className={`text-[10px] font-bold ${e.change >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]"}`}>
                      {e.change >= 0 ? "+" : ""}{e.change.toFixed(2)}%
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#D1D4DC]/30 group-hover:text-[#FF9900]" />
                  <button
                    onClick={(ev) => { ev.stopPropagation(); remove(e.id); }}
                    title="Remove from watchlist"
                    className="cursor-pointer text-[#FF9900] hover:text-[#FF3B30]"
                  >
                    <Star className="w-4 h-4 fill-[#FF9900]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-center text-[#FF9900]/25 text-[8px] pb-1.5 pt-1 tracking-wider border-t border-[#2D333B]">
          YOUR FOLLOWED MARKETS · INTEL ONLY, NOT ADVICE
        </div>
      </div>
    </div>
  );
}
