/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tickrr paywall — shown when a free user hits a Pro-gated feature (live Gemini analysis,
 * ask-anything advisory, Deliberation Room). States the concrete unlock and routes to checkout.
 */
import { useState, useEffect } from "react";
import { X, Lock, Scale, Sparkles, GitCompareArrows, Zap, Ticket } from "lucide-react";
import { fetchEventPasses, type Plan } from "../lib/premium";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (plan: string) => void;
  reason?: string;
}

const UNLOCKS = [
  { icon: Scale, text: "Deliberation Room — two grounded AI experts debate your call, with sources" },
  { icon: Sparkles, text: "Live Gemini analysis — Google-Search-grounded “why it moved,” on demand" },
  { icon: GitCompareArrows, text: "Ask-anything advisory + cross-venue gap alerts" },
  { icon: Zap, text: "Priority data refresh" },
];

export default function UpgradeModal({ open, onClose, onSelect, reason }: Props) {
  const [passes, setPasses] = useState<Array<Plan & { price: string }>>([]);
  useEffect(() => {
    if (open) fetchEventPasses().then(setPasses).catch(() => setPasses([]));
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
      <div className="relative w-full max-w-md bg-[#050608] border border-[#00FF66]/40 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,255,102,0.18)] scanline-overlay">
        <button onClick={onClose} className="cursor-pointer absolute top-3 right-3 text-[#00FF66]/60 hover:text-[#00FF66] z-10">
          <X className="w-4 h-4" />
        </button>
        <div className="p-6 text-center relative z-10">
          <Lock className="w-10 h-10 text-[#00FF66] mx-auto mb-3 terminal-glow-green" />
          <div className="text-[#00FF66] text-sm font-black tracking-widest">UNLOCK TICKRR PRO</div>
          <p className="text-[#D1D4DC]/60 text-[11px] mt-2 mb-4 font-sans leading-relaxed">
            {reason || "Free shows you the board. Pro gives you the edge — the live, grounded decision-support tools."}
          </p>
          <ul className="text-left space-y-2 mb-5">
            {UNLOCKS.map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-[#D1D4DC]/85 font-sans">
                <u.icon className="w-4 h-4 text-[#00FF66] mt-0.5 shrink-0" />
                <span>{u.text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => onSelect("pro")}
            className="cursor-pointer w-full bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-black text-xs px-5 py-2.5 rounded tracking-wider transition mb-2 terminal-glow-green"
          >
            GO PRO — $19/MO →
          </button>
          <button
            onClick={() => onSelect("founder")}
            className="cursor-pointer w-full border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC] hover:text-[#00FF66] font-bold text-xs px-5 py-2 rounded transition"
          >
            Founder's Pass — $99 once, lifetime
          </button>

          {passes.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#2D333B]">
              <div className="flex items-center justify-center gap-1.5 text-[#FF9900] text-[9px] font-bold tracking-widest mb-2">
                <Ticket className="w-3 h-3" /> OR GRAB AN EVENT PASS
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {passes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className="cursor-pointer text-[10px] border border-[#FF9900]/40 text-[#FF9900] hover:bg-[#FF9900]/10 font-bold px-2.5 py-1 rounded transition"
                  >
                    {p.label} · {p.price}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[#D1D4DC]/30 text-[9px] mt-3">Secure checkout via Razorpay · cancel anytime · intel only, never advice</p>
        </div>
      </div>
    </div>
  );
}
