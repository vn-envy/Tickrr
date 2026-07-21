import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Draft, getGrowthStore } from "./growthStore";
import { getWaitlistStore, WaitlistEntry } from "./waitlistStore";
import { captureAndHost, MEDIA_MODE, Media } from "./media";
import { getBlogStore } from "./blogStore";
import { SEED_POSTS, BlogPost } from "./content";
import {
  renderFaqPage, renderCompliancePage, renderBlogIndex, renderBlogPost,
  sitemapXml, robotsTxt, llmsTxt,
} from "./seo";

dotenv.config();

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// ---- Razorpay hosted checkout (payment links + subscriptions) -------------------------------
// Keys come from the ENVIRONMENT ONLY (Cloud Run env vars / GitHub Actions secrets / .env,
// which is gitignored). NEVER commit the key secret — this repo is public. Without keys,
// billing runs in demo mode (the client unlocks Pro locally), so the app stays fully demoable.
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
// Amounts in PLANS are in the smallest currency unit (cents for USD, paise for INR).
// International (USD) charges require international payments enabled on the Razorpay account;
// set RAZORPAY_CURRENCY=INR (and re-price PLANS) to charge domestically instead.
const RAZORPAY_CURRENCY = process.env.RAZORPAY_CURRENCY || "USD";
// Optional: a pre-created monthly Plan id (plan_...) for Tickrr Pro. If absent, one is
// created via the API on first checkout and cached for the life of the process.
const RAZORPAY_PRO_PLAN_ID = process.env.RAZORPAY_PRO_PLAN_ID || "";
const razorpayEnabled = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

/** Minimal Razorpay REST helper — Basic-auth fetch, no SDK dependency. */
async function rzp(pathname: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<any> {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com${pathname}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay ${pathname} → ${res.status}`);
  return data;
}

// Monthly-plan cache: label|amount|currency -> plan_... (created at most once per process).
const rzpPlanCache: Record<string, string> = {};
async function ensureMonthlyPlan(label: string, amount: number): Promise<string> {
  if (RAZORPAY_PRO_PLAN_ID) return RAZORPAY_PRO_PLAN_ID;
  const key = `${label}|${amount}|${RAZORPAY_CURRENCY}`;
  if (!rzpPlanCache[key]) {
    const p = await rzp("/v1/plans", "POST", {
      period: "monthly",
      interval: 1,
      item: { name: label, amount, currency: RAZORPAY_CURRENCY },
    });
    rzpPlanCache[key] = p.id;
  }
  return rzpPlanCache[key];
}

const PLANS: Record<string, { label: string; amount: number; mode: "subscription" | "payment"; interval?: "month" }> = {
  pro: { label: "Tickrr Pro", amount: 1900, mode: "subscription", interval: "month" },
  founder: { label: "Tickrr Founder's Pass — lifetime", amount: 9900, mode: "payment" },
  // Event Passes — one-time unlocks of Pro tuned to a single spectacle's window.
  pass_wc: { label: "World Cup Pass", amount: 2900, mode: "payment" },
  pass_nfl: { label: "NFL Season Pass", amount: 1900, mode: "payment" },
  pass_nba: { label: "NBA Season Pass", amount: 1900, mode: "payment" },
  pass_mlb: { label: "World Series Pass", amount: 1900, mode: "payment" },
  pass_f1: { label: "F1 Season Pass", amount: 1900, mode: "payment" },
};

// ---- Growth engine (free tier): draft from live signals -> you approve -> publish -----------
// Publishes only to Discord (webhook) + Bluesky (app password) — both free, no app review.
// Dry-runs (logs, no post) when credentials are absent, so the loop is fully demoable free.

const MARKET_API = process.env.MARKET_API || "http://localhost:8000";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE || "";
const BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD || "";
const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN || "";
const BUFFER_CHANNEL_IDS = (process.env.BUFFER_CHANNEL_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
// Scheduler: a shared secret guards the public cron trigger (Cloud Scheduler hits it over HTTP).
const GROWTH_CRON_SECRET = process.env.GROWTH_CRON_SECRET || "";
// Founder ping: a Discord webhook to notify you when new drafts land in the approval queue.
const GROWTH_NOTIFY_WEBHOOK = process.env.GROWTH_NOTIFY_WEBHOOK || "";
// The growth agent is an explicit local-only ops tool. It must never register routes or timers
// in production, even if stale Cloud Run environment variables are still present.
const growthAgentEnabled = process.env.NODE_ENV !== "production"
  && process.env.ENABLE_GROWTH_AGENT === "1";

interface Signal { market: string; label: string; prob: number; rationale: string; }

async function draftCopy(s: Signal): Promise<string> {
  const base = `⚡ ${s.market}: ${s.label}. Market implies ${s.prob.toFixed(1)}%.${s.rationale ? " " + s.rationale : ""}`;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return `${base}\n\nTracked live on Tickrr — the prediction-market terminal. Intel only, not advice. #WorldCup`;
  }
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const resp: any = await ai.models.generateContent({
      model: MODEL,
      contents: `Write ONE punchy social post (max 240 characters) about this prediction-market signal for Tickrr, a FIFA World Cup prediction-market intelligence terminal. Hook the reader with the edge/dislocation, mention it's tracked live on Tickrr, add 1-2 relevant hashtags. INTEL ONLY — never tell anyone to bet and never say "bet". Signal: ${base}`,
      config: { systemInstruction: "You are Tickrr's growth copywriter. Punchy, credible, intel-only. Never advise betting or promise outcomes." },
    });
    return (resp.text || base).trim();
  } catch {
    return base;
  }
}

// Which events the autonomous drafts pull signals from — "follow the money" across spectacles.
const GROWTH_QUERIES = (process.env.GROWTH_QUERIES || "World Cup,NFL,NBA,MLB,F1,election,Fed,Bitcoin").split(",").map((s) => s.trim()).filter(Boolean);

async function generateDrafts(count = 3): Promise<Draft[]> {
  const pools: Signal[][] = [];
  for (const q of GROWTH_QUERIES) {
    try {
      const r = await fetch(`${MARKET_API}/api/dislocations?query=${encodeURIComponent(q)}&limit=40`);
      if (r.ok) {
        const data: any[] = await r.json();
        pools.push(data.map((m) => ({
          market: m.market?.group_title || m.market?.question || "Market",
          label: m.dislocation?.label || "Signal",
          prob: (m.fair_value?.implied_prob || 0) * 100,
          rationale: m.dislocation?.rationale || "",
        })));
      }
    } catch { /* skip this event */ }
  }
  // Interleave across events so drafts span the World Cup + NFL rather than one dominating.
  let signals: Signal[] = [];
  for (let i = 0; signals.length < count && pools.some((p) => p[i]); i++) {
    for (const p of pools) { if (p[i] && signals.length < count) signals.push(p[i]); }
  }
  if (!signals.length) {
    signals = [{ market: "Prediction markets", label: "Daily read", prob: 0, rationale: "Live dislocations, cross-venue gaps, and player dossiers across the World Cup + NFL." }];
  }
  const fresh: Draft[] = [];
  for (const s of signals) {
    fresh.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      source: `${s.market} · ${s.label}`,
      text: await draftCopy(s),
      channels: ["discord", "bluesky", "buffer"],
      status: "pending",
    });
  }
  await (await getGrowthStore()).addDrafts(fresh);
  return fresh;
}

// ---- SEO / AEO content (server-rendered blog) + the AI SEO editor ---------------------------

/** Seed posts + AI-generated posts, deduped by slug, newest first. */
async function allPosts(): Promise<BlogPost[]> {
  let stored: BlogPost[] = [];
  try { stored = await (await getBlogStore()).getPosts(); } catch { /* seed-only on store error */ }
  const bySlug = new Map<string, BlogPost>();
  for (const p of [...stored, ...SEED_POSTS]) if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
  return [...bySlug.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || `post-${Date.now()}`;

// Compliance gate for generated copy — block betting/advice language before it can be published.
const SEO_BANNED = [/\byou should bet\b/i, /\bplace a bet\b/i, /\bbet on\b/i, /\bwe recommend (betting|buying|selling)\b/i, /\bguaranteed\b/i, /\bsure thing\b/i];
const compliancePass = (text: string): boolean => !SEO_BANNED.some((re) => re.test(text));

const SEO_SYSTEM =
  "You are Tickrr's SEO/AEO editor (Kritxlabs). Write concise, accurate, answer-first blog posts " +
  "about prediction markets for search engines AND answer engines. STRICTLY INTEL-ONLY: never tell " +
  "anyone to bet/buy/sell/size a position, never say 'bet', never promise an outcome. Explain in " +
  "probabilistic terms. No hype; never invent numbers beyond the data provided.";

async function fetchSeoContext(): Promise<string> {
  const out: string[] = [];
  try {
    const r = await fetch(`${MARKET_API}/api/divergences?top=6`);
    if (r.ok) {
      const d: any[] = await r.json();
      if (d.length) out.push("Top cross-venue gaps (Polymarket vs Kalshi):\n" + d.map((m) =>
        `- ${m.market?.question}: Polymarket ${m.divergence?.polymarket}% vs Kalshi ${m.divergence?.kalshi}% (gap ${m.divergence?.gap_pp}pp)`).join("\n"));
    }
  } catch { /* skip */ }
  try {
    const r = await fetch(`${MARKET_API}/api/calendar?limit=6`);
    if (r.ok) {
      const d: any = await r.json();
      const evs = d.events || [];
      if (evs.length) out.push("Upcoming catalysts:\n" + evs.map((e: any) => `- ${e.title} (${e.date}, ${e.category})`).join("\n"));
    }
  } catch { /* skip */ }
  return out.join("\n\n");
}

/** The AI SEO editor: draft a fresh, answer-first post from live market data (Gemini), compliance-
 * checked and persisted. Falls back to a templated post when no Gemini key is set (still demoable). */
async function generateBlogPost(): Promise<BlogPost> {
  const store = await getBlogStore();
  const ctx = await fetchSeoContext();
  const today = new Date().toISOString().slice(0, 10);
  const apiKey = process.env.GEMINI_API_KEY;
  let post: BlogPost | null = null;

  if (apiKey && ctx) {
    try {
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      const schema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A clear question or 'what/how' phrase for search + answer engines." },
          description: { type: Type.STRING, description: "One-sentence meta description." },
          body: { type: Type.STRING, description: "Markdown, 350-500 words, answer-first, with ## headings and bullet lists." },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          faqs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { q: { type: Type.STRING }, a: { type: Type.STRING } }, required: ["q", "a"] } },
        },
        required: ["title", "description", "body", "tags", "faqs"],
      };
      const resp: any = await ai.models.generateContent({
        model: MODEL,
        contents: `Write today's Tickrr Journal post. Base it ONLY on this live prediction-market data (do not invent other numbers):\n\n${ctx}\n\nOpen with the answer, explain what these cross-venue gaps and catalysts MEAN as intelligence, and keep it intel-only (never advise betting).`,
        config: { systemInstruction: SEO_SYSTEM, responseMimeType: "application/json", responseSchema: schema },
      });
      const j = JSON.parse((resp.text || "").trim());
      post = { slug: slugify(j.title), title: j.title, description: j.description, date: today, tags: (j.tags || []).slice(0, 5), body: j.body, faqs: (j.faqs || []).slice(0, 3), generated: true };
    } catch { /* fall through to template */ }
  }

  if (!post) {
    post = {
      slug: slugify(`prediction-market-read-${today}`),
      title: `Prediction-Market Read — ${today}`,
      description: "Today's cross-venue gaps and upcoming catalysts across sports, politics, macro and crypto. Intel only.",
      date: today, tags: ["prediction markets", "divergence", "catalysts"],
      body: `## Today's read\n\n${ctx || "Live dislocations, cross-venue gaps, and catalysts across the board."}\n\n> Intel only. Tickrr never tells you to bet and never promises an outcome.`,
      generated: true,
    };
  }

  if (!compliancePass(`${post.title} ${post.body}`)) {
    throw new Error("Generated post failed the intel-only compliance check.");
  }
  if (await store.hasSlug(post.slug)) post.slug = `${post.slug}-${today}`;
  if (await store.hasSlug(post.slug)) post.slug = `${post.slug}-${Math.random().toString(36).slice(2, 6)}`;
  await store.addPost(post);
  return post;
}

async function publishDiscord(text: string): Promise<string> {
  if (!DISCORD_WEBHOOK_URL) return "dry-run (set DISCORD_WEBHOOK_URL)";
  try {
    const r = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text.slice(0, 1900) }),
    });
    return r.ok ? "posted" : `error ${r.status}`;
  } catch (e: any) { return `error ${e?.message || e}`; }
}

async function publishBluesky(text: string): Promise<string> {
  if (!BLUESKY_HANDLE || !BLUESKY_APP_PASSWORD) return "dry-run (set BLUESKY_HANDLE + BLUESKY_APP_PASSWORD)";
  try {
    const s = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: BLUESKY_HANDLE, password: BLUESKY_APP_PASSWORD }),
    });
    if (!s.ok) return `auth error ${s.status}`;
    const sess: any = await s.json();
    const r = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.accessJwt}` },
      body: JSON.stringify({ repo: sess.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text: text.slice(0, 300), createdAt: new Date().toISOString() } }),
    });
    return r.ok ? "posted" : `error ${r.status}`;
  } catch (e: any) { return `error ${e?.message || e}`; }
}

// Buffer (free tier): one integration reaches X / Instagram / LinkedIn / etc. via Buffer's
// official-partner credentials. GraphQL at api.buffer.com; addToQueue lets Buffer publish at
// the next slot (keeps us within the free 100/24h · 3,000/30d limits).
async function bufferCreatePost(channelId: string, text: string, media?: Media): Promise<string> {
  const query = `mutation($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }`;
  const input: any = { text: text.slice(0, 900), channelId, schedulingType: "automatic", mode: "addToQueue" };
  if (media) {
    input.assets = [media.kind === "video" ? { video: { url: media.url } } : { image: { url: media.url } }];
  }
  const variables = { input };
  try {
    const r = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${BUFFER_ACCESS_TOKEN}` },
      body: JSON.stringify({ query, variables }),
    });
    if (!r.ok) return `http ${r.status}`;
    const data: any = await r.json();
    const out = data?.data?.createPost;
    if (out?.post?.id) return "queued";
    if (out?.message) return `err: ${out.message}`;
    if (data?.errors?.length) return `err: ${data.errors[0]?.message || "graphql"}`;
    return "unknown";
  } catch (e: any) {
    return `error ${e?.message || e}`;
  }
}

// Buffer GraphQL helper (throws on transport/GraphQL errors so callers can surface a message).
async function bufferGraphql(query: string): Promise<any> {
  const r = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${BUFFER_ACCESS_TOKEN}` },
    body: JSON.stringify({ query }),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Buffer HTTP ${r.status}`);
  if (data?.errors?.length) throw new Error(data.errors[0]?.message || "Buffer GraphQL error");
  return data?.data;
}

// Non-throwing variant for diagnostics — returns status + raw data + errors.
async function bufferGraphqlRaw(query: string): Promise<any> {
  const r = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${BUFFER_ACCESS_TOKEN}` },
    body: JSON.stringify({ query }),
  });
  const data: any = await r.json().catch(() => ({}));
  return { status: r.status, data: data?.data ?? null, errors: data?.errors ?? null };
}

// Buffer may return lists as plain arrays or Relay connections ({ edges: [{ node }] }).
function asList(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.edges)) return x.edges.map((e: any) => e?.node).filter(Boolean);
  return [];
}

// List connected channels + their IDs (for wiring BUFFER_CHANNEL_IDS): org first, then channels.
async function bufferListChannels(): Promise<Array<{ id: string; name: string; service: string; organization: string }>> {
  const orgData = await bufferGraphql(`query { account { organizations { id name } } }`);
  const orgs = asList(orgData?.account?.organizations);
  const out: Array<{ id: string; name: string; service: string; organization: string }> = [];
  for (const org of orgs) {
    const chData = await bufferGraphql(
      `query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name service } }`,
    );
    for (const ch of asList(chData?.channels)) {
      out.push({ id: ch.id, name: ch.name || ch.service, service: ch.service, organization: org.name || "" });
    }
  }
  return out;
}

async function publishBuffer(text: string, media?: Media): Promise<string> {
  if (!BUFFER_ACCESS_TOKEN || !BUFFER_CHANNEL_IDS.length) {
    return "dry-run (set BUFFER_ACCESS_TOKEN + BUFFER_CHANNEL_IDS)";
  }
  const parts: string[] = [];
  for (const ch of BUFFER_CHANNEL_IDS) {
    parts.push(`${ch.slice(0, 6)}=${await bufferCreatePost(ch, text, media)}`);
  }
  return parts.join(", ");
}

// Founder notification — pings a Discord webhook when the agent drafts land for approval.
// This closes the autonomy loop: the agent works on a schedule, you only get pinged to approve.
async function notifyFounder(count: number): Promise<void> {
  if (!GROWTH_NOTIFY_WEBHOOK) return;
  const content = `🔔 Tickrr Growth — ${count} new draft${count === 1 ? "" : "s"} awaiting approval in the Growth Console. Approve to publish (Discord · Bluesky · Buffer → X/LinkedIn/Instagram). Intel only.`;
  try {
    await fetch(GROWTH_NOTIFY_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch { /* best-effort */ }
}

async function publishDraft(d: Draft): Promise<void> {
  const results: Record<string, string> = {};
  // Capture a real screenshot/recording of the live app to attach to the Buffer (X/LinkedIn) post.
  let media: Media | undefined;
  if (MEDIA_MODE && d.channels.includes("buffer")) {
    try {
      media = await captureAndHost();
      d.mediaUrl = media.url;
      d.mediaType = media.kind;
    } catch (e: any) {
      results.media = `capture failed: ${e?.message || e}`;
    }
  }
  if (d.channels.includes("discord")) results.discord = await publishDiscord(d.text);
  if (d.channels.includes("bluesky")) results.bluesky = await publishBluesky(d.text);
  if (d.channels.includes("buffer")) results.buffer = await publishBuffer(d.text, media);
  d.results = results;
  d.status = "published";
}

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
  venueGap?: number;
  dislocation?: string;
  dislocationRationale?: string;
  volume?: number;
  question?: string; // optional custom advisory question
}

const SYSTEM_INSTRUCTION =
  "You are the Tickrr Intelligence Terminal (Kritxlabs), a professional prediction-market analyst covering sports event contracts (Polymarket / Kalshi style). You explain what a market price implies, why it may have moved (grounded in real, recent news), and whether the price is decision-quality given its liquidity and spread. You are STRICTLY INTEL-ONLY: never tell the user to bet, buy, sell, hedge, or size a position, and never promise an outcome. Use precise probabilistic language (implied probability, edge, variance, liquidity, spread) and ground claims in concrete facts.";

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
    `Cross-venue gap: ${ctx.venueGap ?? "n/a"} percentage points. Volume: ${ctx.volume ?? "n/a"}.`,
    `Detected signal: ${ctx.dislocation ?? "none"}${ctx.dislocationRationale ? ` — ${ctx.dislocationRationale}` : ""}.`,
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

// ---- Deliberation Room: two grounded football experts (premium) ----------------------------

const DELIB_SYSTEM =
  "You are an analyst in Tickrr's Deliberation Room. Respond with verifiable football facts ONLY — recent form, results, xG, goals, injuries, suspensions, lineups, head-to-head, historical record. Cite specifics. Never give betting, wagering, or financial advice and never tell the user to bet. Be concise (3-5 sentences) and precise.";

const ADVOCATE_PERSONA =
  "ROLE: THE ADVOCATE. You argue IN FAVOUR of the user's stance, building the strongest evidence-based case using only verifiable facts. Persuasive, but you never invent data.";

const SKEPTIC_PERSONA =
  "ROLE: THE SKEPTIC (devil's advocate). You pressure-test the stance and correct for gaps between optimism and reality, using only verifiable facts. Identify where the case overreaches and the key risks. End your reply with a line beginning 'REALITY CHECK:' giving one calibrated, fact-based bottom line.";

async function groundedExpert(ai: GoogleGenAI, persona: string, content: string): Promise<{ text: string; sources: string[] }> {
  const resp: any = await ai.models.generateContent({
    model: MODEL,
    contents: content,
    config: { systemInstruction: `${DELIB_SYSTEM}\n\n${persona}`, tools: [{ googleSearch: {} }] },
  });
  const text: string = resp.text || "";
  const chunks: any[] = resp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c) => c?.web?.uri).filter(Boolean).slice(0, 4);
  return { text, sources };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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

  // Premium: two grounded football experts deliberate a user's stance (intel only).
  app.post("/api/deliberate", async (req, res) => {
    const { entity, stance } = req.body || {};
    if (!stance) return res.status(400).json({ error: "A stance or question is required." });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.json(getMockDeliberation(entity, stance));

    try {
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
      const subject = entity || "the user's team/player";
      const advocate = await groundedExpert(ai, ADVOCATE_PERSONA,
        `Subject: ${subject}. User's stance: "${stance}". Make the strongest fact-based case FOR this stance.`);
      const skeptic = await groundedExpert(ai, SKEPTIC_PERSONA,
        `Subject: ${subject}. User's stance: "${stance}". THE ADVOCATE argued: "${advocate.text}". Now pressure-test it and correct for reality gaps, with facts.`);
      res.json({ advocate, skeptic });
    } catch (error: any) {
      console.error("[TICKRR] Deliberation failed:", error);
      res.status(500).json({ error: "Deliberation failed.", details: error?.message || String(error), mocked: true, data: getMockDeliberation(entity, stance) });
    }
  });

  // Pro waitlist (pre-billing phase): capture real intent + the usage that preceded it.
  // Google stack only — Firestore on Cloud Run, file JSON locally. One row per email.
  app.post("/api/waitlist", async (req, res) => {
    const { email, name, uid, intent, reason, usage, source } = req.body || {};
    const em = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    try {
      const entry: WaitlistEntry = {
        id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        email: em,
        name: name ? String(name).slice(0, 120) : null,
        uid: uid ? String(uid).slice(0, 128) : null,
        intent: String(intent || "pro").slice(0, 40),
        reason: reason ? String(reason).slice(0, 200) : null,
        source: source ? String(source).slice(0, 200) : null,
        usage: usage && typeof usage === "object" ? usage : null,
      };
      const store = await getWaitlistStore();
      await store.add(entry);
      res.json({ ok: true, store: store.kind });
    } catch (e: any) {
      console.error("[TICKRR] waitlist add failed:", e);
      res.status(500).json({ error: e?.message || "Waitlist unavailable." });
    }
  });

  // Ops peek: how many have raised their hand (no PII returned).
  app.get("/api/waitlist/health", async (_req, res) => {
    try {
      const store = await getWaitlistStore();
      res.json({ store: store.kind, count: await store.count() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "health failed" });
    }
  });

  // Billing: plans + Razorpay hosted checkout (intel-only product; hosted page = no card data here).
  // NOTE: dormant during the waitlist phase — the UI routes all upgrade intents to /api/waitlist.
  app.get("/api/plans", (_req, res) => {
    res.json({
      razorpay: razorpayEnabled,
      currency: RAZORPAY_CURRENCY,
      plans: Object.entries(PLANS).map(([id, p]) => ({
        id, label: p.label, amount: p.amount, mode: p.mode, interval: p.interval,
      })),
    });
  });

  app.post("/api/checkout", async (req, res) => {
    const { plan } = req.body || {};
    const cfg = PLANS[plan];
    if (!cfg) return res.status(400).json({ error: "Unknown plan." });
    if (!razorpayEnabled) {
      // No keys configured → demo mode: the client unlocks Pro locally.
      return res.json({ demo: true });
    }
    try {
      if (cfg.mode === "subscription") {
        // Pro monthly → Razorpay Subscription (hosted page via short_url).
        const planId = await ensureMonthlyPlan(cfg.label, cfg.amount);
        const sub = await rzp("/v1/subscriptions", "POST", {
          plan_id: planId,
          total_count: 120, // billing cycles cap (10 years); cancellable anytime
          customer_notify: 1,
          notes: { tickrr_plan: plan },
        });
        return res.json({ url: sub.short_url, id: sub.id });
      }
      // Founder / event passes → one-time Payment Link that bounces back to ?pro=1.
      const link = await rzp("/v1/payment_links", "POST", {
        amount: cfg.amount,
        currency: RAZORPAY_CURRENCY,
        description: cfg.label,
        callback_url: `${APP_URL}/?pro=1`,
        callback_method: "get",
        notes: { tickrr_plan: plan },
      });
      res.json({ url: link.short_url, id: link.id });
    } catch (error: any) {
      console.error("[TICKRR] Checkout failed:", error);
      res.status(500).json({ error: error?.message || "Checkout failed." });
    }
  });

  // Verify a checkout: works for both payment links (plink_...) and subscriptions (sub_...).
  app.get("/api/checkout/session", async (req, res) => {
    const id = String(req.query.id || req.query.session_id || "");
    if (!razorpayEnabled || !id) return res.json({ paid: false });
    try {
      if (id.startsWith("sub_")) {
        const s = await rzp(`/v1/subscriptions/${id}`);
        return res.json({ paid: ["authenticated", "active", "completed"].includes(s.status) });
      }
      const l = await rzp(`/v1/payment_links/${id}`);
      res.json({ paid: l.status === "paid" });
    } catch {
      res.json({ paid: false });
    }
  });

  if (growthAgentEnabled) {
  // Growth engine: local-only approval queue + generate + approve/reject.
  // Status endpoint — which store is active (firestore/file) + channel/AI wiring. Handy for
  // confirming durable Firestore persistence on Cloud Run and for the ops demo.
  app.get("/api/growth/health", async (_req, res) => {
    try {
      const store = await getGrowthStore();
      const drafts = await store.getDrafts();
      res.json({
        store: store.kind,
        total: drafts.length,
        pending: drafts.filter((d) => d.status === "pending").length,
        published: drafts.filter((d) => d.status === "published").length,
        gemini: Boolean(process.env.GEMINI_API_KEY),
        media: MEDIA_MODE || "off",
        channels: {
          discord: Boolean(DISCORD_WEBHOOK_URL),
          bluesky: Boolean(BLUESKY_HANDLE && BLUESKY_APP_PASSWORD),
          buffer: Boolean(BUFFER_ACCESS_TOKEN && BUFFER_CHANNEL_IDS.length),
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "health failed" });
    }
  });

  app.get("/api/growth/drafts", async (_req, res) => {
    let drafts: Draft[] = [];
    try { drafts = (await (await getGrowthStore()).getDrafts()).slice(0, 50); } catch { /* empty on store error */ }
    res.json({
      discord: Boolean(DISCORD_WEBHOOK_URL),
      bluesky: Boolean(BLUESKY_HANDLE && BLUESKY_APP_PASSWORD),
      buffer: Boolean(BUFFER_ACCESS_TOKEN && BUFFER_CHANNEL_IDS.length),
      drafts,
    });
  });

  // Helper: list your Buffer channels + IDs so you can fill BUFFER_CHANNEL_IDS (X/LinkedIn/IG).
  app.get("/api/growth/buffer/channels", async (req, res) => {
    if (!BUFFER_ACCESS_TOKEN) {
      return res.status(400).json({ error: "Set BUFFER_ACCESS_TOKEN first — get a key at publish.buffer.com/settings/api." });
    }
    try {
      if (req.query.debug) {
        // Reveal the raw Buffer response shape so we can see orgs/channels or auth issues.
        const account = await bufferGraphqlRaw(`query { account { id organizations { id name } } }`);
        return res.json({ debug: account });
      }
      res.json({ channels: await bufferListChannels() });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || "Buffer channel lookup failed." });
    }
  });

  app.post("/api/growth/generate", async (req, res) => {
    const count = Math.max(1, Math.min(5, Number(req.body?.count) || 3));
    try { res.json({ created: await generateDrafts(count) }); }
    catch (error: any) { res.status(500).json({ error: error?.message || "generate failed" }); }
  });

  app.post("/api/growth/drafts/:id/:action", async (req, res) => {
    const { id, action } = req.params;
    const store = await getGrowthStore();
    const draft = (await store.getDrafts()).find((d) => d.id === id);
    if (!draft) return res.status(404).json({ error: "Draft not found." });
    if (draft.status !== "pending") return res.json(draft);
    if (action === "reject") {
      draft.status = "rejected";
      await store.updateDraft(draft);
      return res.json(draft);
    }
    if (action === "approve") {
      await publishDraft(draft); // publishes now; dry-runs if creds absent
      await store.updateDraft(draft);
      return res.json(draft);
    }
    res.status(400).json({ error: "Unknown action." });
  });

  // Autonomous drafting trigger for external schedulers (Cloud Scheduler, cron, GitHub Actions…).
  // Guarded by GROWTH_CRON_SECRET. Generates drafts + pings you — approval still gates publishing.
  app.post("/api/growth/cron", async (req, res) => {
    if (!GROWTH_CRON_SECRET) return res.status(403).json({ error: "Cron disabled — set GROWTH_CRON_SECRET." });
    const key = req.get("x-cron-key") || String(req.query.key || "");
    if (key !== GROWTH_CRON_SECRET) return res.status(401).json({ error: "Unauthorized." });
    const count = Math.max(1, Math.min(5, Number(req.query.count) || Number(req.body?.count) || 3));
    try {
      const created = await generateDrafts(count);
      if (created.length) await notifyFounder(created.length);
      const pending = (await (await getGrowthStore()).getDrafts()).filter((d) => d.status === "pending").length;
      res.json({ created: created.length, pending });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "cron failed" });
    }
  });

  // Optional in-process cadence (free, local) — same behavior without an external scheduler.
  if (process.env.GROWTH_AUTODRAFT === "1") {
    const hours = Number(process.env.GROWTH_AUTODRAFT_HOURS) || 6;
    setInterval(() => {
      generateDrafts(3).then((c) => { if (c.length) return notifyFounder(c.length); }).catch(() => {});
    }, hours * 3600 * 1000);
    console.log(`[TICKRR] Growth auto-draft enabled every ${hours}h (approval required to publish).`);
  }
  }

  // Proxy read-only market data from the FastAPI backend so the browser stays same-origin
  // (no CORS, no compile-time backend URL). MARKET_API is a runtime env var.
  for (const p of ["/api/markets", "/api/history", "/api/player", "/api/calendar"]) {
    app.get(p, async (req, res) => {
      try {
        const r = await fetch(`${MARKET_API}${req.originalUrl}`);
        const body = await r.text();
        res.status(r.status).type("application/json").send(body);
      } catch (error: any) {
        res.status(502).json({ error: `Market backend unavailable: ${error?.message || error}` });
      }
    });
  }

  // ---- SEO / AEO: server-rendered content + crawl files (MUST precede the SPA catch-all) ----
  app.get("/faq", (_req, res) => res.type("html").send(renderFaqPage()));
  app.get("/compliance", (_req, res) => res.type("html").send(renderCompliancePage()));
  app.get("/blog", async (_req, res) => res.type("html").send(renderBlogIndex(await allPosts())));
  app.get("/blog/:slug", async (req, res) => {
    const post = (await allPosts()).find((p) => p.slug === req.params.slug);
    if (!post) return res.status(404).type("html").send(renderBlogIndex(await allPosts()));
    res.type("html").send(renderBlogPost(post));
  });
  app.get("/robots.txt", (_req, res) => res.type("text/plain").send(robotsTxt()));
  app.get("/sitemap.xml", async (_req, res) => res.type("application/xml").send(sitemapXml(await allPosts())));
  app.get("/llms.txt", async (_req, res) => res.type("text/plain").send(llmsTxt(await allPosts())));

  // SEO automation — the AI SEO editor: manual generate + secret-guarded cron (Cloud Scheduler).
  app.post("/api/seo/generate", async (_req, res) => {
    try { res.json({ post: await generateBlogPost() }); }
    catch (e: any) { res.status(500).json({ error: e?.message || "seo generate failed" }); }
  });
  app.post("/api/seo/cron", async (req, res) => {
    const secret = process.env.SEO_CRON_SECRET || "";
    if (!secret) return res.status(403).json({ error: "Cron disabled — set SEO_CRON_SECRET." });
    const key = req.get("x-cron-key") || String(req.query.key || "");
    if (key !== secret) return res.status(401).json({ error: "Unauthorized." });
    try { const p = await generateBlogPost(); res.json({ created: p.slug }); }
    catch (e: any) { res.status(500).json({ error: e?.message || "seo cron failed" }); }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

function getMockDeliberation(entity: string | undefined, stance: string) {
  const subj = entity || "your pick";
  return {
    advocate: {
      text: `THE ADVOCATE: I'll back your read on ${subj} — "${stance}". On the supporting evidence, recent results and underlying numbers trend your way and the matchup profile is favourable. [Connect GEMINI_API_KEY for live, Google-Search-grounded facts.]`,
      sources: [],
    },
    skeptic: {
      text: `THE SKEPTIC: Not so fast. The optimism outruns the sample — form is noisy, key-player availability is uncertain, and the base rate for this claim is lower than it feels. REALITY CHECK: plausible but unproven — watch the next result and the confirmed lineup before trusting it.`,
      sources: [],
    },
  };
}

startServer();
