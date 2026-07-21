/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tickrr Deliberation Room — a Matrix-style secure channel where two grounded
 * football experts deliberate the user's stance: THE ADVOCATE argues for it, THE SKEPTIC
 * corrects for the gap with reality. Facts only — never betting advice.
 *
 * Waitlist phase: sign in → ONE free round, capped at 6 turns. When the round is done the
 * channel blocks and routes to the Pro waitlist (real usage → real intent, before billing).
 */
import { useState, useRef, useEffect, FormEvent } from "react";
import { SportsEntity } from "../types";
import { delibTurnsRemaining, consumeDelibTurn, LIMITS } from "../lib/quota";
import { signInWithGoogle, type AuthUser } from "../lib/auth";
import { authEnabled } from "../lib/firebase";
import { Lock, X, ShieldCheck, Send, Scale, Swords, Loader2, LogIn } from "lucide-react";

interface Msg {
  role: "user" | "advocate" | "skeptic" | "system";
  text: string;
  sources?: string[];
}

interface Props {
  entity: SportsEntity;
  open: boolean;
  onClose: () => void;
  premium?: boolean;
  user?: AuthUser | null;
  onWaitlist?: () => void; // opens the Pro waitlist modal
}

// Lightweight canvas "digital rain" backdrop.
function MatrixRain() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, cols = 0;
    let drops: number[] = [];
    const chars = "アイウエオカキクケコサシスセソタチツテト0123456789TICKRR".split("");
    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      cols = Math.max(1, Math.floor(w / 14));
      drops = Array(cols).fill(0).map(() => Math.random() * -50);
    };
    resize();
    const timer = window.setInterval(() => {
      ctx.fillStyle = "rgba(5,6,8,0.10)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#00FF66";
      ctx.font = "12px JetBrains Mono, monospace";
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 14, drops[i] * 14);
        if (drops[i] * 14 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }, 55);
    window.addEventListener("resize", resize);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" />;
}

export default function DeliberationRoom({ entity, open, onClose, premium = false, user, onWaitlist }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Free-tier round state (waitlist phase): 1 round, hard-capped turns.
  const [turnsLeft, setTurnsLeft] = useState(delibTurnsRemaining());
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setTurnsLeft(delibTurnsRemaining());
      setMessages([
        {
          role: "system",
          text: `SECURE CHANNEL ESTABLISHED // ENCRYPTED\nTwo football experts on the line for ${entity.name.toUpperCase()} (${entity.team}). State a claim — they return facts only.`,
        },
      ]);
    }
  }, [open, entity, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  const needsSignIn = authEnabled && !user && !premium;
  const roundOver = !premium && turnsLeft <= 0;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const stance = input.trim();
    if (!stance || busy) return;
    // Consume a free turn; when the round is spent, route to the waitlist instead.
    if (!premium) {
      if (!consumeDelibTurn()) { onWaitlist?.(); return; }
      const left = delibTurnsRemaining();
      setTurnsLeft(left);
      if (left === 0) {
        setTimeout(() => setMessages((m) => [...m, {
          role: "system",
          text: "FREE ROUND COMPLETE — CHANNEL CLOSING.\nJoin the Pro waitlist for unlimited deliberations at launch.",
        }]), 400);
      }
    }
    setMessages((m) => [...m, { role: "user", text: stance }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/deliberate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: entity.name, stance }),
      });
      const data = await res.json();
      const d = data.advocate ? data : data.data; // tolerate server error-fallback shape
      if (d?.advocate) setMessages((m) => [...m, { role: "advocate", text: d.advocate.text, sources: d.advocate.sources }]);
      if (d?.skeptic) setMessages((m) => [...m, { role: "skeptic", text: d.skeptic.text, sources: d.skeptic.sources }]);
      if (!d?.advocate && !d?.skeptic) setMessages((m) => [...m, { role: "system", text: "NO SIGNAL RETURNED — RETRY." }]);
    } catch {
      setMessages((m) => [...m, { role: "system", text: "CHANNEL ERROR — RETRY." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-mono">
      <div className="relative w-full max-w-3xl h-[80vh] bg-[#050608] border border-[#00FF66]/40 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,255,102,0.18)] scanline-overlay flex flex-col">
        <MatrixRain />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[#00FF66]/30 bg-[#050608]/80">
          <div className="flex items-center gap-2 text-[#00FF66] terminal-glow-green">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest">SECURE DELIBERATION CHANNEL</span>
            {premium ? (
              <span className="text-[9px] bg-[#00FF66] text-black px-1.5 rounded font-black">PRO</span>
            ) : (
              <span className="text-[9px] bg-[#FF9900] text-black px-1.5 rounded font-black">
                FREE ROUND · {turnsLeft}/{LIMITS.delibTurns} TURNS LEFT
              </span>
            )}
          </div>
          <button onClick={onClose} className="cursor-pointer text-[#00FF66]/60 hover:text-[#00FF66] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {needsSignIn ? (
          /* Sign-in gate — capture the user before the free round starts */
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <Lock className="w-12 h-12 text-[#00FF66] terminal-glow-green" />
            <div className="text-[#00FF66] text-sm font-bold tracking-widest">SIGN IN TO OPEN THE CHANNEL</div>
            <p className="text-[#00FF66]/60 text-[11px] max-w-sm leading-relaxed">
              One free deliberation round per account ({LIMITS.delibTurns} turns): two grounded football
              experts — one argues your stance, one corrects for reality. Facts only, with sources.
            </p>
            <button
              onClick={() => void signInWithGoogle().catch((error) => console.warn("[Tickrr] sign-in failed:", error))}
              className="cursor-pointer mt-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-black text-xs px-5 py-2 rounded tracking-wider transition terminal-glow-green flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> SIGN IN WITH GOOGLE
            </button>
            <span className="text-[#00FF66]/30 text-[9px]">Free round · no card · never betting advice</span>
          </div>
        ) : roundOver && messages.length <= 1 ? (
          /* Round already spent on a previous visit — straight to the waitlist */
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
            <Lock className="w-12 h-12 text-[#00FF66] terminal-glow-green" />
            <div className="text-[#00FF66] text-sm font-bold tracking-widest">FREE ROUND USED</div>
            <p className="text-[#00FF66]/60 text-[11px] max-w-sm leading-relaxed">
              You've completed your free deliberation. Pro opens unlimited rounds — join the
              waitlist and we'll ping you first, with launch pricing locked.
            </p>
            <button
              onClick={onWaitlist}
              className="cursor-pointer mt-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-black text-xs px-5 py-2 rounded tracking-wider transition terminal-glow-green"
            >
              JOIN THE PRO WAITLIST →
            </button>
            <span className="text-[#00FF66]/30 text-[9px]">No card, no charge — just first access</span>
          </div>
        ) : (
          <>
            {/* Feed */}
            <div className="relative z-10 flex-1 overflow-auto p-4 space-y-3 text-[12px]">
              {messages.map((m, i) => {
                if (m.role === "system") {
                  return (
                    <div key={i} className="text-center text-[#00FF66]/50 text-[10px] whitespace-pre-line tracking-wide py-1">
                      {m.text}
                    </div>
                  );
                }
                if (m.role === "user") {
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[80%] bg-[#0B0E11] border border-[#2D333B] rounded px-3 py-2 text-[#D1D4DC]">
                        <div className="text-[9px] text-[#D1D4DC]/40 font-bold mb-0.5">YOUR STANCE</div>
                        {m.text}
                      </div>
                    </div>
                  );
                }
                const isAdvocate = m.role === "advocate";
                const accent = isAdvocate ? "#00FF66" : "#FF9900";
                return (
                  <div key={i} className="flex justify-start">
                    <div
                      className="max-w-[88%] rounded px-3 py-2 leading-relaxed border bg-[#0B0E11]/70"
                      style={{ borderColor: `${accent}55` }}
                    >
                      <div className="flex items-center gap-1.5 mb-1 font-bold" style={{ color: accent }}>
                        {isAdvocate ? <Scale className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                        {isAdvocate ? "THE ADVOCATE" : "THE SKEPTIC"}
                      </div>
                      <p className="text-[#D1D4DC]/90 font-sans whitespace-pre-line">{m.text}</p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.sources.map((s, j) => (
                            <a
                              key={j}
                              href={s}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] underline truncate max-w-[140px]"
                              style={{ color: `${accent}aa` }}
                            >
                              {(() => { try { return new URL(s).hostname.replace("www.", ""); } catch { return "source"; } })()}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {busy && (
                <div className="flex items-center gap-2 text-[#00FF66]/60 text-[10px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  EXPERTS DELIBERATING · QUERYING GEMINI + GOOGLE SEARCH...
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input — or the waitlist CTA once the free round is spent */}
            {roundOver ? (
              <div className="relative z-10 border-t border-[#00FF66]/30 bg-[#050608]/80 p-2.5 flex items-center justify-center gap-3">
                <span className="text-[#00FF66]/50 text-[10px] tracking-wider">FREE ROUND COMPLETE</span>
                <button
                  onClick={onWaitlist}
                  className="cursor-pointer bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-black text-[10px] px-4 py-1.5 rounded tracking-wider transition terminal-glow-green"
                >
                  JOIN THE PRO WAITLIST →
                </button>
              </div>
            ) : (
              <form onSubmit={send} className="relative z-10 border-t border-[#00FF66]/30 bg-[#050608]/80 p-2 flex gap-2 items-center">
                <span className="text-[#00FF66] text-sm pl-1">&gt;</span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  placeholder={premium ? `State a claim about ${entity.name}...` : `State a claim about ${entity.name}... (${turnsLeft} ${turnsLeft === 1 ? "turn" : "turns"} left)`}
                  className="flex-1 bg-transparent text-[#00FF66] placeholder-[#00FF66]/30 text-xs focus:outline-none caret-[#00FF66]"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="cursor-pointer bg-[#00FF66] hover:bg-[#00FF66]/90 disabled:bg-[#1C2128] disabled:text-[#00FF66]/30 text-black px-3 py-1.5 rounded font-black transition flex items-center"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
            <div className="relative z-10 text-center text-[#00FF66]/25 text-[8px] pb-1.5 tracking-wider">
              FACTS ONLY · NOT BETTING ADVICE · GROUNDED VIA GOOGLE SEARCH
            </div>
          </>
        )}
      </div>
    </div>
  );
}
