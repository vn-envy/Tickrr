import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface MarketContext {
  name: string;
  event?: string;
  impliedProb?: number;
  fairLow?: number;
  fairHigh?: number;
  spreadCost?: number;
  oneWeekChange?: number;
  liquidityScore?: number;
  decisionQuality?: string;
  question?: string; // optional custom advisory question
}

const SYSTEM_INSTRUCTION =
  "You are the Tickrr Intelligence Terminal (Ticker Labs), a professional prediction-market analyst covering sports event contracts (Polymarket / Kalshi style). You explain what a market price implies, why it may have moved (grounded in real, recent news), and whether the price is decision-quality given its liquidity and spread. You are STRICTLY INTEL-ONLY: never tell the user to bet, buy, sell, hedge, or size a position, and never promise an outcome. Use precise probabilistic language (implied probability, edge, variance, liquidity, spread) and ground claims in concrete facts.";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "One-paragraph read: what the current price implies and the headline takeaway. Precise, non-advisory." },
    metrics: {
      type: Type.ARRAY,
      description: "Four market-quality dimensions scored 0-100: Liquidity Depth, Spread Tightness, Momentum (1W), Consensus Strength.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Dimension name, e.g. 'Liquidity Depth', 'Spread Tightness', 'Momentum (1W)', 'Consensus Strength'." },
          score: { type: Type.INTEGER, description: "0-100." },
          comment: { type: Type.STRING, description: "Why this score, referencing the data." },
        },
      },
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Edge signals: reasons the current price may be reliable or interesting (informational)." },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Risk flags: reasons to distrust the price (thin book, stale, possible overreaction, headline/lineup risk)." },
    careerTrajectory: { type: Type.STRING, description: "What to watch next that could move this market (fixtures, lineups, results, news)." },
    historicalComparisons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Comparable markets or base rates for context." },
    financialValuation: { type: Type.STRING, description: "Fair-value read: does the price look rich or cheap vs fundamentals and liquidity? Informational only, never advice." },
    recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Analyst watch-list items (e.g. 'monitor starting XI 1h pre-match'). Never betting instructions." },
  },
  required: ["summary", "metrics", "strengths", "weaknesses", "careerTrajectory", "historicalComparisons", "financialValuation", "recommendedActions"],
};

function ctxBlock(ctx: MarketContext): string {
  const pct = (v?: number) => (v === undefined || v === null ? "n/a" : `${v}%`);
  return [
    `Market: "${ctx.name}"${ctx.event ? ` — ${ctx.event}` : ""}.`,
    `Implied probability: ${pct(ctx.impliedProb)}.`,
    `Fair range: [${pct(ctx.fairLow)}, ${pct(ctx.fairHigh)}].`,
    `1-week move: ${pct(ctx.oneWeekChange)}.`,
    `Liquidity score: ${ctx.liquidityScore ?? "n/a"}/100. Spread cost: ${pct(ctx.spreadCost)}. Decision quality: ${ctx.decisionQuality ?? "n/a"}.`,
  ].join(" ");
}

// Step 1 of grounding: pull recent, real news via Google Search (cannot be combined with a
// response schema in a single call, so we ground first, then structure).
async function gatherGroundedNews(ai: GoogleGenAI, ctx: MarketContext): Promise<{ text: string; sources: string[] }> {
  try {
    const resp: any = await ai.models.generateContent({
      model: MODEL,
      contents: `2026 FIFA World Cup. Summarize the most important developments from the last 7 days affecting "${ctx.name}"${ctx.event ? ` (${ctx.event})` : ""}: match results, injuries, suspensions, lineup or manager news, and momentum. 4-6 concise dated bullets. If nothing material, say "No material news.".`,
      config: { tools: [{ googleSearch: {} }] },
    });
    const text: string = resp.text || "";
    const chunks: any[] = resp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((c) => c?.web?.uri).filter(Boolean).slice(0, 5);
    return { text, sources };
  } catch {
    return { text: "", sources: [] };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", model: MODEL, gemini: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Prediction-market intelligence with Gemini + Google Search grounding (intel only).
  app.post("/api/insights", async (req, res) => {
    const ctx: MarketContext = req.body || {};
    if (!ctx.name) {
      return res.status(400).json({ error: "Market name is required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[TICKRR] GEMINI_API_KEY not set — returning market-intel template.");
      return res.json(getMockInsights(ctx));
    }

    try {
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      const news = await gatherGroundedNews(ai, ctx);

      const ask = ctx.question
        ? `The analyst asked: "${ctx.question}". Center the summary on answering it, grounded in the data and news below.`
        : "";

      const prompt = `${ctxBlock(ctx)}

Recent grounded news (from Google Search):
${news.text || "No material news retrieved."}

${ask}
Produce a prediction-market intelligence report on this market. Explain what the price implies, what likely moved it (reference the news), whether the price is decision-quality given liquidity and spread, the key risks, and what to watch. Intel only — never advise betting or position sizing.`;

      const response: any = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const responseText = response.text;
      if (!responseText) throw new Error("Empty response from Gemini.");

      const report = JSON.parse(responseText.trim());
      if (news.sources.length) {
        report.summary = `${report.summary}\n\nSOURCES: ${news.sources.join("  ·  ")}`;
      }
      res.json(report);
    } catch (error: any) {
      console.error("[TICKRR] Gemini API call failed:", error);
      res.status(500).json({
        error: "Failed to generate AI insights.",
        details: error?.message || String(error),
        mocked: true,
        data: getMockInsights(ctx),
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TICKRR] Terminal server listening on http://localhost:${PORT}`);
  });
}

// Market-themed fallback so the panel is useful even without a Gemini key.
function getMockInsights(ctx: MarketContext) {
  const name = (ctx.name || "MARKET").toUpperCase();
  const p = ctx.impliedProb ?? 50;
  const liq = Math.round(ctx.liquidityScore ?? 60);
  const spread = ctx.spreadCost ?? 4;
  const mom = ctx.oneWeekChange ?? 0;
  const dq = (ctx.decisionQuality || "fair").toUpperCase();
  const tight = Math.max(0, Math.min(100, Math.round(100 - spread * 8)));
  const consensus = Math.max(0, Math.min(100, Math.round(Math.abs(p - 50) * 1.6 + 30)));
  const momScore = Math.max(0, Math.min(100, Math.round(50 + mom * 3)));

  return {
    summary: `MARKET READ — ${name}. The market prices roughly a ${p.toFixed(1)}% implied probability${ctx.event ? ` in "${ctx.event}"` : ""}. Liquidity is ${liq >= 60 ? "deep" : liq >= 30 ? "moderate" : "thin"} (${liq}/100) and the round-trip spread is ~${spread.toFixed(2)}%, so the quoted price is rated ${dq} for decision-making. The 1-week move of ${mom >= 0 ? "+" : ""}${mom.toFixed(2)}% suggests ${Math.abs(mom) < 1 ? "a stable consensus" : mom > 0 ? "strengthening conviction" : "softening conviction"}. [Connect GEMINI_API_KEY for live, Google-Search-grounded analysis.]`,
    metrics: [
      { name: "Liquidity Depth", score: liq, comment: `Depth proxy ${liq}/100 — ${liq >= 60 ? "supports size without heavy slippage" : "size will move the price"}.` },
      { name: "Spread Tightness", score: tight, comment: `Round-trip spread ~${spread.toFixed(2)}% — ${tight >= 70 ? "cheap to enter/exit" : "execution cost is material"}.` },
      { name: "Momentum (1W)", score: momScore, comment: `1-week change ${mom >= 0 ? "+" : ""}${mom.toFixed(2)}% — ${Math.abs(mom) < 1 ? "range-bound" : "trending"}.` },
      { name: "Consensus Strength", score: consensus, comment: `Distance from a coin-flip — ${consensus >= 60 ? "market is opinionated" : "market is contested/undecided"}.` },
    ],
    strengths: [
      liq >= 50 ? "Liquidity supports decision-quality pricing" : "Even a small edge is meaningful at this price level",
      Math.abs(mom) < 1 ? "Price is stable — low whipsaw risk" : "Clear momentum signal worth studying",
      "Quoted price is cross-checkable against the fair-value range",
    ],
    weaknesses: [
      liq < 40 ? "Thin book — quoted price may not be executable at size" : "Crowded favorite — limited upside vs. headline risk",
      spread > 5 ? "Wide spread — easy to overpay on entry" : "Spread acceptable, but watch pre-match widening",
      "Single-venue pricing until Kalshi cross-market is enabled",
    ],
    careerTrajectory: `Watch the next fixture, the confirmed lineup ~1h pre-match, and any injury or suspension news for ${ctx.name}. A surprising result or key-player update is the likeliest catalyst to reprice this market.`,
    historicalComparisons: ["Comparable WC favorites at similar prices", "Group-stage repricing base rates", "Knockout-round volatility profile"],
    financialValuation: `Versus its fair range, the ${p.toFixed(1)}% quote looks broadly in-line given ${liq}/100 liquidity and a ${spread.toFixed(2)}% spread. A price outside the fair band would flag a possible dislocation. Informational only — not advice.`,
    recommendedActions: [
      "Monitor the confirmed starting XI ~1 hour before kickoff.",
      liq < 40 ? "Wait for deeper liquidity before treating the price as reliable." : "Track the spread for pre-match widening.",
      "Compare against Kalshi once cross-market is live to spot divergence.",
    ],
  };
}

startServer();
