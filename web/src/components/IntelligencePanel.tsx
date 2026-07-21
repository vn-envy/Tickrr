/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { SportsEntity, InsightReport } from "../types";
import { Cpu, ChevronRight, FileText, BarChart3, Coins, Sparkles, Send, Lock } from "lucide-react";
import InfoTip from "./InfoTip";
import { GLOSSARY } from "../lib/glossary";
import { geminiRemaining, consumeGemini, LIMITS } from "../lib/quota";
import { signInWithGoogle, type AuthUser } from "../lib/auth";
import { authEnabled } from "../lib/firebase";

// Map a Gemini market-quality dimension name to its glossary entry (best-effort by keyword).
function metricKey(name: string): keyof typeof GLOSSARY | undefined {
  const n = name.toLowerCase();
  if (n.includes("liquid")) return "liquidity";
  if (n.includes("spread")) return "spread";
  if (n.includes("moment")) return "momentum";
  if (n.includes("consensus")) return "consensus";
  return undefined;
}

interface IntelligencePanelProps {
  entity: SportsEntity;
  premium?: boolean;
  user?: AuthUser | null;
  onUpgrade?: () => void; // waitlist-phase: opens the Pro waitlist modal
}

type TabType = "report" | "metrics" | "valuation" | "advisory";

// Market context sent to the Gemini-backed /api/insights endpoint.
function marketBody(entity: SportsEntity, extra: Record<string, unknown> = {}) {
  return {
    name: entity.name,
    event: entity.team,
    impliedProb: entity.impliedProb ?? entity.value,
    fairLow: entity.fairLow,
    fairHigh: entity.fairHigh,
    spreadCost: entity.spreadCost,
    oneWeekChange: entity.oneWeekChange ?? entity.change,
    liquidityScore: entity.liquidityScore ?? entity.efficiency,
    decisionQuality: entity.decisionQuality,
    ...extra,
  };
}

export default function IntelligencePanel({ entity, premium = false, user, onUpgrade }: IntelligencePanelProps) {
  const [loading, setLoading] = useState(false);
  // Free-tier allowance (waitlist phase): 5 Gemini queries per signed-in user, hard-capped.
  const [freeLeft, setFreeLeft] = useState(geminiRemaining());
  useEffect(() => { setFreeLeft(geminiRemaining()); }, [user]);

  /** Gate a Gemini action: sign-in first (capture the user), then consume quota, else waitlist. */
  const gate = async (): Promise<boolean> => {
    if (premium) return true;
    if (authEnabled && !user) {
      // Sign up before any free query. If sign-in completes we continue this same click —
      // the user shouldn't have to press the button twice.
      const signedIn = await signInWithGoogle();
      if (!signedIn) return false;
    }
    if (!consumeGemini()) { onUpgrade?.(); return false; }
    setFreeLeft(geminiRemaining());
    return true;
  };
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("report");
  const [report, setReport] = useState<InsightReport | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [advisoryChat, setAdvisoryChat] = useState<{ role: "user" | "terminal"; text: string }[]>([
    { role: "terminal", text: "TICKRR INTEL ADVISORY ONLINE. Ask why a price moved, whether it's decision-quality, or what to watch." }
  ]);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Loading messages while the grounded analysis runs.
  const loadingMessages = [
    "AUTHENTICATING MARKET DATA FEED...",
    "PULLING GROUNDED NEWS VIA GOOGLE SEARCH...",
    "RECONCILING PRICE VS FAIR-VALUE RANGE...",
    "SCORING LIQUIDITY, SPREAD & MOMENTUM...",
    "DETECTING DISLOCATION & HEADLINE RISK...",
    "COMPILING GEMINI INTELLIGENCE REPORT..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
      }, 900);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Instant market-themed baseline so the panel is populated before the deep Gemini run.
  useEffect(() => {
    const p = entity.impliedProb ?? entity.value;
    const liq = Math.round(entity.liquidityScore ?? entity.efficiency);
    const spread = entity.spreadCost ?? 0;
    const mom = entity.oneWeekChange ?? entity.change;
    const dq = (entity.decisionQuality || "fair").toUpperCase();
    const tight = Math.max(0, Math.min(100, Math.round(100 - spread * 8)));
    const consensus = Math.max(0, Math.min(100, Math.round(Math.abs(p - 50) * 1.6 + 30)));
    const momScore = Math.max(0, Math.min(100, Math.round(50 + mom * 3)));

    const baseline: InsightReport = {
      summary: `MARKET READ — ${entity.name.toUpperCase()} (${entity.team}). The market implies a ${p.toFixed(1)}% probability. Liquidity is ${liq >= 60 ? "deep" : liq >= 30 ? "moderate" : "thin"} (${liq}/100) with a ~${spread.toFixed(2)}% round-trip spread, rating the quote ${dq} for decision-making. 1-week move ${mom >= 0 ? "+" : ""}${mom.toFixed(2)}%. Run the deep analysis for live, Google-Search-grounded context.`,
      metrics: [
        { name: "Liquidity Depth", score: liq, comment: `Depth proxy ${liq}/100 — ${liq >= 60 ? "supports size" : "size will move the price"}.` },
        { name: "Spread Tightness", score: tight, comment: `Round-trip spread ~${spread.toFixed(2)}% — ${tight >= 70 ? "cheap to transact" : "execution cost is material"}.` },
        { name: "Momentum (1W)", score: momScore, comment: `1-week change ${mom >= 0 ? "+" : ""}${mom.toFixed(2)}% — ${Math.abs(mom) < 1 ? "range-bound" : "trending"}.` },
        { name: "Consensus Strength", score: consensus, comment: `Distance from a coin-flip — ${consensus >= 60 ? "opinionated" : "contested"}.` },
      ],
      strengths: [
        liq >= 50 ? "Liquidity supports decision-quality pricing" : "Small edges matter at this price level",
        Math.abs(mom) < 1 ? "Stable price — low whipsaw risk" : "Clear momentum signal to study",
        "Cross-checkable against the fair-value range",
      ],
      weaknesses: [
        liq < 40 ? "Thin book — may not be executable at size" : "Crowded favorite — limited upside vs headline risk",
        spread > 5 ? "Wide spread — easy to overpay" : "Watch pre-match spread widening",
        "Single-venue pricing until Kalshi cross-market is live",
      ],
      careerTrajectory: `Watch the next fixture, confirmed lineup ~1h pre-match, and injury/suspension news for ${entity.name}. A surprising result is the likeliest catalyst to reprice this market.`,
      historicalComparisons: ["Comparable WC favorites at similar prices", "Group-stage repricing base rates", "Knockout volatility profile"],
      financialValuation: `Versus its fair range${entity.fairLow != null ? ` [${entity.fairLow}%, ${entity.fairHigh}%]` : ""}, the ${p.toFixed(1)}% quote looks broadly in-line given ${liq}/100 liquidity. A price outside the band would flag a possible dislocation. Informational only — not advice.`,
      recommendedActions: [
        "Monitor the confirmed starting XI ~1 hour before kickoff.",
        liq < 40 ? "Wait for deeper liquidity before trusting the price." : "Track the spread for pre-match widening.",
        "Compare against Kalshi once cross-market is live.",
      ],
    };
    setReport(baseline);
    setActiveTab("report");
    setAdvisoryChat([
      { role: "terminal", text: `TICKRR INTEL ADVISORY ONLINE FOR ${entity.name.toUpperCase()}. Ask why it moved, if the price is decision-quality, or what to watch.` }
    ]);
  }, [entity]);

  // Deep, Google-Search-grounded analysis from the Gemini-backed server.
  // Free tier: sign in, then 5 queries total (analysis + advisory) before the waitlist gate.
  const handleExecuteAnalysis = async () => {
    if (!(await gate())) return;
    setLoading(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marketBody(entity)),
      });
      const data = await response.json();
      if (data.error && data.data) {
        setReport(data.data); // server fell back to template
      } else {
        setReport(data);
      }
    } catch (err) {
      console.error("Failed to fetch Gemini market insights", err);
    } finally {
      setLoading(false);
    }
  };

  // Custom advisory question, answered with the same market context.
  const handleSubmitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    const cleanQuery = customQuestion.trim();
    if (!cleanQuery) return;
    if (!(await gate())) return;

    setAdvisoryChat((prev) => [...prev, { role: "user", text: cleanQuery }]);
    setCustomQuestion("");
    setAdvisoryLoading(true);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(marketBody(entity, { question: cleanQuery })),
      });
      const data = await response.json();
      const outputText = data.summary || data.data?.summary || "ANALYSIS FEED TIMEOUT. PLEASE TRY AGAIN.";
      setAdvisoryChat((prev) => [...prev, { role: "terminal", text: outputText }]);
    } catch (err) {
      setAdvisoryChat((prev) => [...prev, { role: "terminal", text: "ERROR COMMUNICATING WITH TICKRR ENGINE." }]);
    } finally {
      setAdvisoryLoading(false);
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#0B0E11]/40 border border-[#2D333B] rounded shadow-xl overflow-hidden relative min-h-[300px] backdrop-blur-md"
      id="terminal-intelligence-panel"
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#050608]/95 z-50 flex flex-col items-center justify-center p-6 text-center select-none animate-pulse">
          <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
            <Cpu className="w-10 h-10 text-[#FF9900] animate-spin" />
            <div className="absolute inset-0 rounded-full border border-dashed border-[#FF9900]/40 animate-ping" />
          </div>
          <div className="font-mono text-xs text-[#FF9900] tracking-widest mb-2 font-bold">
            TICKRR INTELLIGENCE COMPILATION ACTIVE
          </div>
          <div className="font-mono text-[10px] text-[#D1D4DC]/50 max-w-sm h-6">
            &gt; {loadingMessages[loadingStep]}
          </div>
          <div className="w-48 bg-[#1C2128] border border-[#2D333B] h-1.5 rounded mt-4 overflow-hidden">
            <div
              className="bg-[#FF9900] h-full transition-all duration-300"
              style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#0B0E11] border-b border-[#2D333B] px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[#FF9900]" />
          <h2 className="font-sans text-xs font-bold tracking-widest text-[#D1D4DC]">
            TICKRR INTEL ENGINE · GEMINI
          </h2>
        </div>
        <button
          onClick={handleExecuteAnalysis}
          type="button"
          title={
            premium
              ? "Run live Google-Search-grounded analysis"
              : authEnabled && !user
              ? "Sign in with Google to use your free Gemini queries"
              : freeLeft > 0
              ? `Run live analysis — ${freeLeft} of ${LIMITS.gemini} free queries left`
              : "Free queries used — join the Pro waitlist"
          }
          className="cursor-pointer bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-mono text-[10px] font-black px-3 py-1 rounded transition duration-150 flex items-center gap-1.5 self-start sm:self-auto shadow-md"
        >
          {premium || freeLeft > 0 ? <Sparkles className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {premium
            ? "RUN GEMINI MARKET ANALYSIS"
            : authEnabled && !user
            ? "SIGN IN · RUN GEMINI ANALYSIS"
            : freeLeft > 0
            ? `RUN GEMINI ANALYSIS · ${freeLeft} FREE LEFT`
            : "GEMINI ANALYSIS · JOIN PRO WAITLIST"}
        </button>
      </div>

      {/* Navigation Tabs (scrollable on narrow screens) */}
      <div className="flex border-b border-[#2D333B] bg-[#0B0E11]/40 font-mono text-[10px] p-1.5 gap-1 select-none overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab("report")}
          type="button"
          className={`cursor-pointer shrink-0 px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "report" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <FileText className="w-3 h-3" />
          INTELLIGENCE REPORT
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          type="button"
          className={`cursor-pointer shrink-0 px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "metrics" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <BarChart3 className="w-3 h-3" />
          MARKET QUALITY
        </button>
        <button
          onClick={() => setActiveTab("valuation")}
          type="button"
          className={`cursor-pointer shrink-0 px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "valuation" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <Coins className="w-3 h-3" />
          FAIR VALUE
        </button>
        <button
          onClick={() => setActiveTab("advisory")}
          type="button"
          className={`cursor-pointer shrink-0 px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "advisory" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <Sparkles className="w-3 h-3 animate-pulse text-[#FF9900]" />
          ADVISORY
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-3 text-[#D1D4DC]">
        {report ? (
          <>
            {/* Tab: Intelligence Report */}
            {activeTab === "report" && (
              <div className="space-y-4 animate-fade-in text-xs font-mono">
                {/* Executive Summary */}
                <div className="bg-[#1C2128]/50 border border-[#2D333B] rounded p-3 leading-relaxed">
                  <div className="text-[#FF9900] font-bold mb-1.5 flex items-center gap-1 terminal-glow-orange">
                    <ChevronRight className="w-3.5 h-3.5 text-[#FF9900]" />
                    MARKET INTELLIGENCE SUMMARY
                    <InfoTip metric="intelReport" />
                  </div>
                  <p className="text-[#D1D4DC] leading-relaxed font-sans whitespace-pre-line">{report.summary}</p>
                </div>

                {/* Edge signals & Risk flags (2 Column Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                    <div className="text-[#00FF66] font-bold mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66]" />
                      EDGE SIGNALS
                    </div>
                    <ul className="space-y-1.5 font-sans text-[#D1D4DC]/80 text-[11px] list-disc pl-4 leading-normal">
                      {report.strengths.map((str, i) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                    <div className="text-[#FF3B30] font-bold mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
                      RISK FLAGS
                    </div>
                    <ul className="space-y-1.5 font-sans text-[#D1D4DC]/80 text-[11px] list-disc pl-4 leading-normal">
                      {report.weaknesses.map((weak, i) => (
                        <li key={i}>{weak}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* What to watch */}
                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3 leading-normal">
                  <div className="text-[#FF9900] font-bold mb-1.5">WHAT TO WATCH NEXT</div>
                  <p className="font-sans text-[11px] text-[#D1D4DC]/80">{report.careerTrajectory}</p>
                </div>
              </div>
            )}

            {/* Tab: Market Quality */}
            {activeTab === "metrics" && (
              <div className="space-y-3.5 animate-fade-in font-mono text-xs">
                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-2.5 mb-2 text-[10px] text-[#D1D4DC]/50 select-none">
                  MARKET-QUALITY DIMENSIONS — HOW DECISION-GRADE THIS PRICE IS (LIQUIDITY, SPREAD, MOMENTUM, CONSENSUS).
                </div>
                {report.metrics.map((metric, i) => (
                  <div key={i} className="bg-[#1C2128]/40 border border-[#2D333B] p-3 rounded">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-white font-bold text-xs uppercase flex items-center gap-1">
                        {metric.name}
                        {metricKey(metric.name) && <InfoTip metric={metricKey(metric.name)} />}
                      </span>
                      <span className="text-[#FF9900] font-bold text-xs">{metric.score} / 100</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#050608] border border-[#2D333B] rounded overflow-hidden mb-2">
                      <div
                        className="bg-[#FF9900] h-full transition-all duration-500"
                        style={{ width: `${metric.score}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#D1D4DC]/70 font-sans leading-relaxed">{metric.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Fair Value */}
            {activeTab === "valuation" && (
              <div className="space-y-4 animate-fade-in font-mono text-xs">
                <div className="bg-[#1C2128]/40 border border-[#2D333B] rounded p-3">
                  <div className="text-[#FF9900] font-bold mb-1.5 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-[#FF9900]" />
                    FAIR-VALUE READ
                    <InfoTip metric="fairRange" />
                  </div>
                  <p className="font-sans text-[11px] text-[#D1D4DC] leading-relaxed">{report.financialValuation}</p>
                </div>

                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                  <div className="text-white font-bold mb-2.5">ANALYST WATCHLIST</div>
                  <ul className="space-y-2">
                    {report.recommendedActions.map((act, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-[#D1D4DC]/80 font-sans leading-normal">
                        <span className="text-[#FF9900] text-xs font-mono">[{i+1}]</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                  <div className="text-[#D1D4DC]/50 font-bold mb-1.5">COMPARABLE MARKETS / BASE RATES</div>
                  <div className="flex flex-wrap gap-2">
                    {report.historicalComparisons.map((comp, i) => (
                      <span key={i} className="bg-[#050608] border border-[#2D333B] text-[#FF9900] font-mono text-[10px] px-2.5 py-1 rounded">
                        {comp.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Advisory — free while queries remain (shared 5-query allowance), then waitlist */}
            {activeTab === "advisory" && !premium && freeLeft <= 0 && (
              <div className="flex flex-col items-center justify-center h-[280px] border border-[#2D333B] rounded bg-[#050608] text-center px-6 gap-3 animate-fade-in">
                <Lock className="w-8 h-8 text-[#00FF66] terminal-glow-green" />
                <div className="text-[#00FF66] text-[11px] font-bold tracking-widest font-mono">FREE QUERIES USED · PRO COMING SOON</div>
                <p className="text-[#D1D4DC]/50 text-[10px] font-sans max-w-xs leading-relaxed">
                  You've used your {LIMITS.gemini} free Gemini queries. Pro removes the limits —
                  join the waitlist and we'll ping you first, with launch pricing locked.
                </p>
                <button
                  onClick={onUpgrade}
                  className="cursor-pointer bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-black text-[10px] px-4 py-1.5 rounded tracking-wider transition font-mono terminal-glow-green"
                >
                  JOIN THE PRO WAITLIST →
                </button>
              </div>
            )}
            {activeTab === "advisory" && (premium || freeLeft > 0) && (
              <div className="flex flex-col h-[280px] border border-[#2D333B] rounded bg-[#050608] overflow-hidden animate-fade-in font-mono text-[11px]">
                <div className="flex-1 overflow-auto p-2.5 space-y-2.5">
                  {advisoryChat.map((chat, i) => (
                    <div
                      key={i}
                      className={`flex flex-col rounded p-2 border ${
                        chat.role === "user"
                          ? "bg-[#1C2128] border-[#2D333B] ml-8 text-white"
                          : "bg-[#1C2128]/30 border-[#2D333B] mr-8 text-[#FF9900] leading-relaxed font-sans"
                      }`}
                    >
                      <span className="text-[9px] text-[#D1D4DC]/40 uppercase font-mono font-bold mb-0.5">
                        {chat.role === "user" ? "QUERY" : "TICKRR INTEL FEED"}
                      </span>
                      <p className="whitespace-pre-line">{chat.text}</p>
                    </div>
                  ))}
                  {advisoryLoading && (
                    <div className="bg-[#1C2128]/20 border border-[#2D333B]/50 p-2 mr-8 rounded text-[#D1D4DC]/40 led-blink">
                      QUERYING GEMINI + GOOGLE SEARCH...
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>

                <form onSubmit={handleSubmitQuestion} className="border-t border-[#2D333B] p-1.5 bg-[#0B0E11]/90 flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    disabled={advisoryLoading}
                    placeholder={premium ? `Ask about ${entity.name}...` : `Ask about ${entity.name}... (${freeLeft} free ${freeLeft === 1 ? "query" : "queries"} left)`}
                    className="flex-1 bg-[#1C2128] border border-[#2D333B] rounded px-3 py-1.5 text-xs text-white placeholder-white/20 font-mono focus:outline-none focus:border-[#FF9900]/50"
                  />
                  <button
                    type="submit"
                    disabled={advisoryLoading || !customQuestion.trim()}
                    className="cursor-pointer bg-[#FF9900] hover:bg-[#FF9900]/90 disabled:bg-[#1C2128] disabled:text-[#D1D4DC]/30 text-black px-3.5 py-1.5 rounded font-black transition flex items-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10 font-mono text-[#D1D4DC]/30">
            SELECT A MARKET TO LOAD INTELLIGENCE.
          </div>
        )}
      </div>
    </div>
  );
}
