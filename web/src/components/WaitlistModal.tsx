/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pro waitlist modal — shown when a user hits a free-tier limit (5 Gemini queries,
 * 1 deliberation round) or clicks any Pro/Founder/event-pass CTA. Captures real intent
 * (plan interest + email + usage snapshot) into Firestore via /api/waitlist instead of
 * charging — we validate demand before wiring live payments.
 */
import { useState, useEffect, FormEvent } from "react";
import { X, Lock, Scale, Sparkles, GitCompareArrows, Zap, Check, Loader2, LogIn } from "lucide-react";
import { joinWaitlist, hasJoinedWaitlist } from "../lib/waitlist";
import { signInWithGoogle, type AuthUser } from "../lib/auth";
import { authEnabled } from "../lib/firebase";

interface Props {
  open: boolean;
  onClose: () => void;
  user?: AuthUser | null;
  reason?: string;   // what tripped the modal, e.g. "You've used your 5 free Gemini queries."
  intent?: string;   // preselected plan interest ("pro" | "founder" | "pass_*")
}

const UNLOCKS = [
  { icon: Scale, text: "Deliberation Room — two grounded AI experts debate your call, with sources" },
  { icon: Sparkles, text: "Live Gemini analysis — Google-Search-grounded “why it moved,” on demand" },
  { icon: GitCompareArrows, text: "Ask-anything advisory + cross-venue gap alerts" },
  { icon: Zap, text: "Priority data refresh" },
];

const INTENTS = [
  { id: "pro", label: "PRO · $19/MO" },
  { id: "founder", label: "FOUNDER · $99 LIFETIME" },
  { id: "pass", label: "EVENT PASS" },
];

export default function WaitlistModal({ open, onClose, user, reason, intent }: Props) {
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState(intent && intent.startsWith("pass") ? "pass" : intent || "pro");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDone(hasJoinedWaitlist());
      setError("");
      setPicked(intent && intent.startsWith("pass") ? "pass" : intent || "pro");
      if (user?.email) setEmail(user.email);
    }
  }, [open, user, intent]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const em = (user?.email || email).trim();
    if (!em) { setError("Enter your email to join."); return; }
    setBusy(true);
    setError("");
    const ok = await joinWaitlist({ email: em, name: user?.name, uid: user?.uid, intent: picked, reason });
    setBusy(false);
    if (ok) setDone(true);
    else setError("Couldn't reach the waitlist — try again in a moment.");
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
      <div className="relative w-full max-w-md bg-[#050608] border border-[#00FF66]/40 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(0,255,102,0.18)] scanline-overlay">
        <button onClick={onClose} className="cursor-pointer absolute top-3 right-3 text-[#00FF66]/60 hover:text-[#00FF66] z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 text-center relative z-10">
          {done ? (
            <>
              <Check className="w-10 h-10 text-[#00FF66] mx-auto mb-3 terminal-glow-green" />
              <div className="text-[#00FF66] text-sm font-black tracking-widest">YOU'RE ON THE LIST</div>
              <p className="text-[#D1D4DC]/60 text-[11px] mt-2 font-sans leading-relaxed">
                Pro is launching soon. We'll email you first — with launch pricing locked in.
                Until then, the free terminal stays fully live.
              </p>
              <button
                onClick={onClose}
                className="cursor-pointer mt-5 w-full bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-black text-xs px-5 py-2.5 rounded tracking-wider transition terminal-glow-green"
              >
                BACK TO THE TERMINAL
              </button>
            </>
          ) : (
            <>
              <Lock className="w-10 h-10 text-[#00FF66] mx-auto mb-3 terminal-glow-green" />
              <div className="text-[#00FF66] text-sm font-black tracking-widest">TICKRR PRO — JOIN THE WAITLIST</div>
              <p className="text-[#D1D4DC]/60 text-[11px] mt-2 mb-4 font-sans leading-relaxed">
                {reason || "Pro launches soon. Join the waitlist to lock launch pricing and get first access."}
              </p>

              <ul className="text-left space-y-2 mb-4">
                {UNLOCKS.map((u, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-[#D1D4DC]/85 font-sans">
                    <u.icon className="w-4 h-4 text-[#00FF66] mt-0.5 shrink-0" />
                    <span>{u.text}</span>
                  </li>
                ))}
              </ul>

              {/* Intent — which plan would they pay for? */}
              <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                {INTENTS.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setPicked(it.id)}
                    className={`cursor-pointer text-[10px] font-bold px-2.5 py-1 rounded border transition ${
                      picked === it.id
                        ? "bg-[#00FF66] text-black border-[#00FF66]"
                        : "border-[#2D333B] text-[#D1D4DC]/60 hover:border-[#00FF66]/50 hover:text-[#00FF66]"
                    }`}
                  >
                    {it.label}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-2">
                {user?.email ? (
                  <div className="text-[11px] text-[#D1D4DC]/70 bg-[#0B0E11] border border-[#2D333B] rounded px-3 py-2">
                    {user.email}
                  </div>
                ) : (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full bg-[#0B0E11] border border-[#2D333B] rounded px-3 py-2 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#00FF66]/50"
                  />
                )}
                {error && <p className="text-[#FF3B30] text-[10px]">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="cursor-pointer w-full bg-[#00FF66] hover:bg-[#00FF66]/90 disabled:opacity-60 text-black font-black text-xs px-5 py-2.5 rounded tracking-wider transition terminal-glow-green flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  JOIN THE PRO WAITLIST →
                </button>
              </form>

              {authEnabled && !user && (
                <button
                  onClick={() => void signInWithGoogle().catch((error) => console.warn("[Tickrr] sign-in failed:", error))}
                  className="cursor-pointer mt-2 w-full border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC] hover:text-[#00FF66] font-bold text-[10px] px-5 py-2 rounded transition flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" /> OR SIGN IN WITH GOOGLE TO AUTOFILL
                </button>
              )}

              <p className="text-[#D1D4DC]/30 text-[9px] mt-3">
                No card, no charge — just intent. Launch pricing locked for the waitlist · intel only, never advice
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
