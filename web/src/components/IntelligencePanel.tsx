/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import { SportsEntity, InsightReport } from "../types";
import { Cpu, ChevronRight, FileText, BarChart3, Coins, Sparkles, Send } from "lucide-react";

interface IntelligencePanelProps {
  entity: SportsEntity;
}

type TabType = "report" | "metrics" | "valuation" | "advisory";

export default function IntelligencePanel({ entity }: IntelligencePanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>("report");
  const [report, setReport] = useState<InsightReport | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [advisoryChat, setAdvisoryChat] = useState<{ role: "user" | "terminal"; text: string }[]>([
    { role: "terminal", text: "TICKRR INTEL ADVISORY ONLINE. Enter custom querying parameters or request tactical scouts analysis." }
  ]);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Loading screen messages to mimic real Bloomberg analysis booting up
  const loadingMessages = [
    "INITIALIZING COGNITIVE TELEMETRY ALIGNMENT...",
    "EXTRACTING SEASONAL SPATIAL DENSITY PLOTS...",
    "CONSTRUCTING STATISTICAL CORRELATIONS VIA GEMINI-3.5-FLASH...",
    "COMPUTING STANDARDIZED ATHLETIC COEF VALUE...",
    "DECODING COMPLEX VALUATION MULTIPLES...",
    "SYNCHRONIZING TACTICAL INSIGHT ARRAYS..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < loadingMessages.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 900);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Load baseline mock insights instantly upon mounting or entity change so it looks populated, 
  // but let them run deeper Gemini Analysis with a click
  useEffect(() => {
    // Generate static baseline reports that are rich
    const baseline: InsightReport = {
      summary: `BASE INTELLIGENCE PROFILE: ${entity.name.toUpperCase()} exhibits peak structural alignment with a high-tempo transition playstyle. Advanced sports index tracking maps current performance parameters in the 92nd percentile of comparative historic databases. Spatial distribution maps show high horizontal coordinate flexibility, though stamina load limits are reached during late quarters (+8.2% fatigue acceleration rate).`,
      metrics: [
        { name: "Offensive Velocity Index", score: entity.speed, comment: "Maintains optimal linear kinetic release points under tight defensive spacing." },
        { name: "Endurance Capacity", score: entity.stamina, comment: "Exhibits slight deterioration vectors past 74 minutes of continuous match uptime." },
        { name: "Execution Standard", score: Math.round(entity.value), comment: "Mechanical completion ratings correspond to historic elite benchmarks." }
      ],
      strengths: [
        "Exceptional acceleration profile and instant stop-action braking response",
        "Dual-axis visual coordination under full defensive coverage",
        "Resilient baseline metric recovery curves"
      ],
      weaknesses: [
        "Susceptibility to heavy-contact positional pressing",
        "Stamina degradation triggers minor execution delays in the late fourth",
        "Under-indexing on backward vertical tracking coordinate parameters"
      ],
      careerTrajectory: `${entity.name} is on a highly stable performance trajectory. Model curves estimate an appreciation potential of +4.8% over the standard 180-day competitive cycle, given load parameters are properly adapted.`,
      historicalComparisons: entity.category === "team" 
        ? ["2011 FC Barcelona (Spatial tactics)", "1996 Chicago Bulls (Offensive flow)"] 
        : ["Michael Jordan (Peak athletic mechanics)", "Diego Maradona (Playmaking spatial geometry)"],
      financialValuation: `Baseline Asset Index Valuation: $132,400,000. Under active metrics, drafting premium rests at a $+4.2M standard deviation offset. Structured long-term performance clauses are recommended.`,
      recommendedActions: [
        "Implement interval anaerobic recovery protocols to flatten late fatigue vectors.",
        "Adjust defensive spatial alignment width by 4.2 radial degrees.",
        "Scout advisory: Maintain asset; valuation parameters show consistent premium appreciation."
      ]
    };
    setReport(baseline);
    setActiveTab("report");
    // Clear chat on entity swap
    setAdvisoryChat([
      { role: "terminal", text: `TICKRR INTEL ADVISORY ONLINE FOR ${entity.name.toUpperCase()}. Ask any custom quantitative sports question.` }
    ]);
  }, [entity]);

  // Fetch true live AI analytics from our server API
  const handleExecuteAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: entity.name, type: entity.category }),
      });
      const data = await response.json();
      
      if (data.error && data.data) {
        // Fallback mock returned by server if API key missing
        setReport(data.data);
      } else {
        setReport(data);
      }
    } catch (err) {
      console.error("Failed to fetch true Gemini insights", err);
    } finally {
      setLoading(false);
    }
  };

  // Submit custom questions to the advisory chat (proxied to server using custom prompt)
  const handleSubmitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    const cleanQuery = customQuestion.trim();
    if (!cleanQuery) return;

    // Append user message
    setAdvisoryChat((prev) => [...prev, { role: "user", text: cleanQuery }]);
    setCustomQuestion("");
    setAdvisoryLoading(true);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: `${entity.name} (Context query: ${cleanQuery})`,
          type: entity.category
        }),
      });
      const data = await response.json();
      const outputText = data.summary || data.data?.summary || "ANALYSIS FEED TIMEOUT. PLEASE TRY AGAIN.";

      setAdvisoryChat((prev) => [...prev, { role: "terminal", text: outputText }]);
    } catch (err) {
      setAdvisoryChat((prev) => [...prev, { role: "terminal", text: "ERROR COMMUNICATING WITH TICKRR ENGINE." }]);
    } finally {
      setAdvisoryLoading(false);
      // Scroll to bottom
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
            TICKRR INTEL ENGINE (AI INSIGHTS)
          </h2>
        </div>
        <button
          onClick={handleExecuteAnalysis}
          type="button"
          className="cursor-pointer bg-[#00FF66] hover:bg-[#00FF66]/90 text-black font-mono text-[10px] font-black px-3 py-1 rounded transition duration-150 flex items-center gap-1.5 self-start sm:self-auto shadow-md"
        >
          <Sparkles className="w-3.5 h-3.5" />
          RUN DEEP GEN_AI COGNITIVE ANALYSIS
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#2D333B] bg-[#0B0E11]/40 font-mono text-[10px] p-1.5 gap-1 select-none">
        <button
          onClick={() => setActiveTab("report")}
          type="button"
          className={`cursor-pointer px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "report" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <FileText className="w-3 h-3" />
          INTELLIGENCE REPORT
        </button>
        <button
          onClick={() => setActiveTab("metrics")}
          type="button"
          className={`cursor-pointer px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "metrics" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <BarChart3 className="w-3 h-3" />
          TACTICAL METRICS
        </button>
        <button
          onClick={() => setActiveTab("valuation")}
          type="button"
          className={`cursor-pointer px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "valuation" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <Coins className="w-3 h-3" />
          ASSET VALUATION
        </button>
        <button
          onClick={() => setActiveTab("advisory")}
          type="button"
          className={`cursor-pointer px-3 py-1 rounded flex items-center gap-1.5 transition ${
            activeTab === "advisory" ? "bg-[#1C2128] text-[#FF9900] font-bold border border-[#2D333B]" : "text-[#D1D4DC]/60 hover:text-white"
          }`}
        >
          <Sparkles className="w-3 h-3 animate-pulse text-[#FF9900]" />
          ADVISORY TERMINAL
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
                    EXECUTIVE ANALYTICAL SUMMARY
                  </div>
                  <p className="text-[#D1D4DC] leading-relaxed font-sans">{report.summary}</p>
                </div>

                {/* Core Strengths & Weaknesses (2 Column Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Strengths */}
                  <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                    <div className="text-[#00FF66] font-bold mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66]" />
                      SYSTEM STRENGTH VECTORS
                    </div>
                    <ul className="space-y-1.5 font-sans text-[#D1D4DC]/80 text-[11px] list-disc pl-4 leading-normal">
                      {report.strengths.map((str, i) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                    <div className="text-[#FF3B30] font-bold mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
                      TACTICAL EXPOSURE POINTS
                    </div>
                    <ul className="space-y-1.5 font-sans text-[#D1D4DC]/80 text-[11px] list-disc pl-4 leading-normal">
                      {report.weaknesses.map((weak, i) => (
                        <li key={i}>{weak}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Trajectory */}
                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3 leading-normal">
                  <div className="text-[#FF9900] font-bold mb-1.5">PERFORMANCE TRAJECTORY PROJECTION</div>
                  <p className="font-sans text-[11px] text-[#D1D4DC]/80">{report.careerTrajectory}</p>
                </div>
              </div>
            )}

            {/* Tab: Tactical Metrics */}
            {activeTab === "metrics" && (
              <div className="space-y-3.5 animate-fade-in font-mono text-xs">
                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-2.5 mb-2 text-[10px] text-[#D1D4DC]/50 select-none">
                  THE FOLLOWING QUANTITATIVE DIMENSIONS ARE EXTRACTED VIA COGNITIVE MAPPING TO EVALUATE PEAK ATHLETIC DEVIATIONS.
                </div>
                {report.metrics.map((metric, i) => (
                  <div key={i} className="bg-[#1C2128]/40 border border-[#2D333B] p-3 rounded">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-white font-bold text-xs uppercase">{metric.name}</span>
                      <span className="text-[#FF9900] font-bold text-xs">{metric.score} / 100</span>
                    </div>
                    {/* Visual Meter Bar */}
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

            {/* Tab: Asset Valuation */}
            {activeTab === "valuation" && (
              <div className="space-y-4 animate-fade-in font-mono text-xs">
                {/* Financial Assessment */}
                <div className="bg-[#1C2128]/40 border border-[#2D333B] rounded p-3">
                  <div className="text-[#FF9900] font-bold mb-1.5 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-[#FF9900]" />
                    ASSET VALUATION METRICS
                  </div>
                  <p className="font-sans text-[11px] text-[#D1D4DC] leading-relaxed">{report.financialValuation}</p>
                </div>

                {/* Scouting & Management Advisory Actions */}
                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                  <div className="text-white font-bold mb-2.5">EXECUTIVE DECISION ADVISORY</div>
                  <ul className="space-y-2">
                    {report.recommendedActions.map((act, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-[#D1D4DC]/80 font-sans leading-normal">
                        <span className="text-[#FF9900] text-xs font-mono">[{i+1}]</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Historical Comparisons */}
                <div className="bg-[#1C2128]/20 border border-[#2D333B] rounded p-3">
                  <div className="text-[#D1D4DC]/50 font-bold mb-1.5">HISTORIC COGNITIVE MATCH PROFILES</div>
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

            {/* Tab: Advisory Terminal (Ask custom questions) */}
            {activeTab === "advisory" && (
              <div className="flex flex-col h-[280px] border border-[#2D333B] rounded bg-[#050608] overflow-hidden animate-fade-in font-mono text-[11px]">
                {/* Chat feed */}
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
                        {chat.role === "user" ? "QUERY PARAM" : "TICKRR INTEL FEED"}
                      </span>
                      <p className="whitespace-pre-line">{chat.text}</p>
                    </div>
                  ))}
                  {advisoryLoading && (
                    <div className="bg-[#1C2128]/20 border border-[#2D333B]/50 p-2 mr-8 rounded text-[#D1D4DC]/40 led-blink">
                      QUERIES PROCESSING FROM COGNITIVE GRAPH...
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>

                {/* Prompt form */}
                <form onSubmit={handleSubmitQuestion} className="border-t border-[#2D333B] p-1.5 bg-[#0B0E11]/90 flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    disabled={advisoryLoading}
                    placeholder={`Ask advisory about ${entity.name}...`}
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
            LOAD COMPILER SYSTEM INACTIVE. SELECT EQUITY.
          </div>
        )}
      </div>
    </div>
  );
}
