/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tickrr homepage — brand + story + features + pricing. Three.js hero globe.
 */
import { useState, useEffect } from "react";
import TickrrLogo from "./TickrrLogo";
import HeroGlobe from "./HeroGlobe";
import ThemeToggle from "./ThemeToggle";
import { fetchEventPasses, type Plan } from "../lib/premium";
import {
  Radar, GitCompareArrows, LayoutGrid, ShieldCheck, Sparkles, LineChart,
  ArrowRight, Check, Lock, Ticket,
} from "lucide-react";

interface Props {
  onEnter: () => void;
  onGoPro: (plan: string) => void;
  premium: boolean;
}

const FEATURES = [
  { icon: Radar, title: "Dislocation Radar", body: "Live edge signals — momentum, overreaction, and thin-book traps — ranked by severity the moment they appear." },
  { icon: GitCompareArrows, title: "Cross-Venue Divergence", body: "Polymarket vs Kalshi on the same outcome. We compute the gap so you see which book is mispriced." },
  { icon: LayoutGrid, title: "Every Market · One Board", body: "Sports, politics, macro & crypto — the World Cup, the Fed, the midterms, Bitcoin — unified, with category scoping and a live catalyst calendar." },
  { icon: Sparkles, title: "Deliberation Room", body: "A secure channel where two grounded AI experts argue your stance — one for, one against. Facts only.", pro: true },
  { icon: LineChart, title: "Real Price History", body: "Implied-probability charts straight from the Polymarket CLOB, with fair-value ranges and decision-quality reads." },
  { icon: ShieldCheck, title: "Intel, Not Advice", body: "Tickrr never tells you to bet. It tells you whether a price is decision-quality — and why it moved." },
];

const PLANS = [
  {
    id: "free", name: "Free", price: "$0", cadence: "forever", highlight: false,
    hook: "See the board.", cta: "Launch free terminal", note: "No card required",
    perks: ["Full live terminal + Dislocation Radar", "Market & player tickers", "Fair value + real price history", "Instant baseline market reads"],
  },
  {
    id: "pro", name: "Pro", price: "$19", cadence: "/ month", highlight: true,
    hook: "Get the edge.", cta: "Unlock Pro", note: "Less than one mispriced bet",
    perks: [
      "Everything in Free",
      "Deliberation Room — 2 AI experts debate your call",
      "Live Gemini analysis, grounded by Google Search",
      "Ask-anything advisory + cross-venue gap alerts",
      "Priority data refresh",
    ],
  },
  {
    id: "founder", name: "Founder's Pass", price: "$99", cadence: "once · lifetime", highlight: false,
    hook: "Own it forever.", cta: "Become a Founder", note: "One-time — never pay again",
    perks: ["Everything in Pro — for life", "≈5 months of Pro, paid once", "Founding-member badge", "Locked launch pricing + roadmap input"],
  },
];

export default function Home({ onEnter, onGoPro, premium }: Props) {
  const act = (id: string) => (id === "free" ? onEnter() : onGoPro(id));
  const [passes, setPasses] = useState<Array<Plan & { price: string }>>([]);
  useEffect(() => { fetchEventPasses().then(setPasses).catch(() => setPasses([])); }, []);

  return (
    <div className="min-h-screen bg-[#050608] text-[#D1D4DC] font-sans scanline-overlay relative overflow-x-hidden">
      {/* Nav */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 border-b border-[#2D333B]/60">
        <TickrrLogo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {premium && (
            <span className="text-[9px] font-mono font-black bg-[#00FF66] text-black px-2 py-1 rounded">PRO ACTIVE</span>
          )}
          <button
            onClick={onEnter}
            className="cursor-pointer flex items-center gap-1.5 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-mono text-[11px] font-black px-3.5 py-1.5 rounded transition"
          >
            LAUNCH TERMINAL <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[78vh] flex items-center overflow-hidden">
        {/* Globe lives on the right so it never sits under the headline */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-[60%] pointer-events-none">
          <HeroGlobe />
        </div>
        {/* Readability fade — solid behind the text, clearing toward the globe */}
        <div className="absolute inset-0 hero-fade pointer-events-none" />
        <div className="relative z-10 px-6 md:px-12 max-w-2xl">
          <div className="font-mono text-[11px] tracking-widest text-[#FF9900] mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] led-blink" />
            KRITXLABS · SPORTS · POLITICS · MACRO · CRYPTO
          </div>
          <h1 className="font-sans font-black text-4xl md:text-6xl leading-[1.05] tracking-tight text-white">
            Trade prediction markets on <span className="text-[#00FF66] terminal-glow-green">information</span>, not vibes.
          </h1>
          <p className="mt-5 text-[#D1D4DC]/70 text-base md:text-lg leading-relaxed max-w-2xl">
            Tickrr is the <span className="text-white font-semibold">Bloomberg Terminal for prediction markets</span> — turning live
            Polymarket &amp; Kalshi data into decision-quality intelligence across sports, politics, macro &amp; crypto:
            fair value, dislocations, cross-venue gaps, catalyst calendars, and an AI deliberation room.
            <span className="text-[#FF9900]"> Intel only. Never picks.</span>
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={onEnter}
              className="cursor-pointer flex items-center gap-2 bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-mono text-sm font-black px-5 py-3 rounded transition shadow-[0_0_24px_rgba(0,255,102,0.25)]"
            >
              LAUNCH TERMINAL <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#pricing"
              className="cursor-pointer flex items-center gap-2 border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC] font-mono text-sm font-bold px-5 py-3 rounded transition"
            >
              <Lock className="w-4 h-4 text-[#FF9900]" /> SEE PRO
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] text-[#D1D4DC]/40">
            <span><span className="text-[#00FF66] font-bold">$24B+/mo</span> across prediction markets</span>
            <span><span className="text-white font-bold">Polymarket</span> + <span className="text-white font-bold">Kalshi</span>, side by side</span>
            <span>Grounded by <span className="text-white font-bold">Gemini</span></span>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="relative z-10 px-6 md:px-12 py-16 border-t border-[#2D333B]/60">
        <div className="max-w-5xl mx-auto text-center">
        <div className="font-mono text-[11px] tracking-widest text-[#FF9900] mb-3">THE GAP</div>
        <p className="text-xl md:text-2xl font-sans leading-relaxed text-[#D1D4DC]/90">
          Prediction markets are exploding — billions trade daily across sports, politics, macro and crypto — but
          retail flies blind: stale prices, thin books, and headline overreactions hide in plain sight. Tickrr reads
          both major venues at once, scores every market for <span className="text-[#00FF66]">decision quality</span>,
          and flags the <span className="text-[#FF9900]">dislocations</span> the moment they open.
        </p>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-panel rounded p-5 relative">
              {f.pro && (
                <span className="absolute top-3 right-3 text-[8px] font-mono font-black bg-[#FF9900] text-black px-1.5 py-0.5 rounded">PRO</span>
              )}
              <f.icon className="w-5 h-5 text-[#FF9900] mb-3" />
              <h3 className="font-sans font-bold text-white text-sm mb-1.5">{f.title}</h3>
              <p className="text-[12px] text-[#D1D4DC]/60 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 px-6 md:px-12 py-16 border-t border-[#2D333B]/60">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="font-mono text-[11px] tracking-widest text-[#FF9900] mb-2">PRICING</div>
          <h2 className="font-sans font-black text-3xl text-white">Start free. Go Pro when you want the edge.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-lg p-6 pt-7 flex flex-col border ${
                p.highlight ? "border-[#00FF66]/60 bg-[#0B0E11]/70 shadow-[0_0_30px_rgba(0,255,102,0.12)]" : "border-[#2D333B] bg-[#0B0E11]/40"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono font-black bg-[#00FF66] text-black px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(0,255,102,0.4)]">MOST POPULAR</span>
              )}
              <h3 className="font-sans font-bold text-white text-lg">{p.name}</h3>
              <div className="text-[#FF9900] font-mono text-[11px] font-bold mt-0.5">{p.hook}</div>
              <div className="mt-2 mb-5 flex items-end gap-1.5">
                <span className="font-sans font-black text-4xl text-white leading-none">{p.price}</span>
                <span className="text-[#D1D4DC]/40 font-mono text-[11px] mb-1">{p.cadence}</span>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-[12px] text-[#D1D4DC]/75 leading-snug">
                    <Check className="w-3.5 h-3.5 text-[#00FF66] mt-0.5 shrink-0" /> <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => act(p.id)}
                disabled={premium && p.id !== "free"}
                className={`cursor-pointer flex items-center justify-center gap-1.5 font-mono text-xs font-black px-4 py-2.5 rounded transition disabled:opacity-50 disabled:cursor-default ${
                  p.highlight
                    ? "bg-[#00FF66] hover:bg-[#00FF66]/90 text-black"
                    : "border border-[#2D333B] hover:border-[#00FF66]/50 text-[#D1D4DC] hover:text-[#00FF66]"
                }`}
              >
                {premium && p.id !== "free" ? (
                  <><Check className="w-3.5 h-3.5" /> ACTIVE</>
                ) : (
                  <>{p.cta} <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
              <p className="text-center text-[9px] text-[#D1D4DC]/40 font-mono mt-2">{p.note}</p>
            </div>
          ))}
        </div>
        {passes.length > 0 && (
          <div className="mt-8 border-t border-[#2D333B]/60 pt-6">
            <div className="flex items-center justify-center gap-2 font-mono text-[11px] tracking-widest text-[#FF9900] mb-1">
              <Ticket className="w-3.5 h-3.5" /> EVENT PASSES
            </div>
            <p className="text-center text-[12px] text-[#D1D4DC]/50 font-sans mb-4">
              Not ready to subscribe? Unlock Pro for a single spectacle — pay once, ride the whole event.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {passes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => act(p.id)}
                  disabled={premium}
                  className="cursor-pointer flex items-center gap-1.5 border border-[#FF9900]/40 hover:bg-[#FF9900]/10 text-[#FF9900] font-mono text-[11px] font-bold px-3 py-1.5 rounded transition disabled:opacity-40 disabled:cursor-default"
                >
                  {p.label} <span className="text-white">{p.price}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-center text-[10px] text-[#D1D4DC]/30 font-mono mt-6">
          Secure checkout via Razorpay. Cancel anytime. Prices in USD.
        </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-12 py-8 border-t border-[#2D333B]/60 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[10px] text-[#D1D4DC]/40">
        <div className="flex items-center gap-4">
          <span className="font-bold text-[#D1D4DC]/60">KRITXLABS LTD.</span>
          <a href="/blog" className="hover:text-[#00FF66] transition">Blog</a>
          <a href="/faq" className="hover:text-[#00FF66] transition">FAQ</a>
          <a href="/compliance" className="hover:text-[#00FF66] transition">Compliance</a>
          <a href="mailto:support4u@tickrr.tech" className="hover:text-[#00FF66] transition">Support</a>
        </div>
        <span className="text-center sm:text-right max-w-xl">
          Tickrr provides informational market analytics only. Not financial, investment, or betting advice;
          it does not execute trades. Prediction markets involve risk. 18+/21+ where applicable.
        </span>
      </footer>
    </div>
  );
}
