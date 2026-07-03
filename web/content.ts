/**
 * SEO / AEO content for the crawlable, server-rendered marketing pages (FAQ, compliance, blog).
 *
 * These are rendered as real HTML by server.ts (see seo.ts) so search engines AND answer engines
 * (Google AI Overviews, Perplexity, ChatGPT, Gemini) can index and cite them — a client-only SPA
 * can't be crawled. Everything here is INTEL-ONLY: no advice to bet/buy/sell/size, no promises.
 */

export const SITE = {
  name: "Tickrr",
  company: "Ticker Labs",
  tagline: "The Bloomberg Terminal for prediction markets",
  // Public origin, used for canonical URLs + sitemap. Override per-deploy with APP_URL.
  url: (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, ""),
  description:
    "Real-time trading analytics for prediction markets — sports, politics, macro & crypto. " +
    "Fair value, dislocations, cross-venue gaps (Polymarket vs Kalshi), catalysts, and AI intel. " +
    "Intel only, never picks.",
  twitter: "@tickrr",
  sameAs: [] as string[], // fill with real social URLs when live
};

export interface QA {
  q: string;
  a: string; // plain text; answer-first for AEO
}

export const FAQS: QA[] = [
  {
    q: "What is Tickrr?",
    a: "Tickrr is a real-time intelligence terminal for prediction markets — the 'Bloomberg Terminal for prediction markets.' It turns live Polymarket and Kalshi data into decision-quality analytics across sports, politics, macro and crypto: fair-value reads, dislocations, cross-venue gaps, and a catalyst calendar. Tickrr is intel only — it never tells you to bet and never places trades.",
  },
  {
    q: "Is Tickrr financial, investment, or betting advice?",
    a: "No. Tickrr is informational analytics only. It never recommends that you bet, buy, sell, hedge, or size a position, and it never promises an outcome. Everything is presented as probabilistic intelligence to help you understand markets — decisions are entirely your own.",
  },
  {
    q: "What is a cross-venue divergence (Polymarket vs Kalshi)?",
    a: "A cross-venue divergence is when the same real-world question is priced differently on two prediction-market venues — for example Polymarket implying a 10% chance and Kalshi implying 13.5% for the same event. Tickrr surfaces the gap in percentage points, but only for verified like-for-like pairs (same team, same price threshold, same meeting outcome), so the comparison is always apples-to-apples.",
  },
  {
    q: "What markets does Tickrr cover?",
    a: "Tickrr unifies four categories on one board: sports (the World Cup, NFL, NBA, MLB, F1), politics (elections), macro (Federal Reserve rate decisions), and crypto (Bitcoin and Ethereum price markets). Each market carries a fair-value read; where a counterpart exists on another venue, Tickrr also shows the cross-venue gap.",
  },
  {
    q: "How does Tickrr calculate fair value and implied probability?",
    a: "A prediction-market price maps directly to an implied probability (a 62¢ 'Yes' ≈ a 62% implied chance). Tickrr adjusts for the bid/ask spread and liquidity to produce a liquidity-adjusted fair range, then rates the quote's decision quality. A price sitting outside its fair range is flagged as a possible dislocation.",
  },
  {
    q: "What is a dislocation?",
    a: "A dislocation is a signal that a market price may be mispriced or fragile: price moving without news (or news without price movement), a thin-liquidity trap where the quote can't absorb size, an overreaction, or a cross-venue gap. Tickrr's Dislocation Radar flags these live, most severe first — as information, not a recommendation to act.",
  },
  {
    q: "Does Tickrr place trades or execute orders?",
    a: "No. Tickrr never executes trades and has no brokerage or wallet integration. It is a pure decision-support and analytics layer — you take any action on the venue of your choice, entirely at your own discretion.",
  },
  {
    q: "Where does Tickrr get its data?",
    a: "Live market microstructure comes from Polymarket's public Gamma and CLOB APIs, whose terms permit derived analytics and customer-facing products. Kalshi figures are shown as derived cross-venue analytics with an attributed link back to Kalshi; Tickrr does not redistribute Kalshi's raw feed. Tickrr is not affiliated with, or endorsed by, Polymarket or Kalshi.",
  },
  {
    q: "Is Tickrr free?",
    a: "Tickrr has a free tier that covers the live board, fair-value reads, and the catalyst calendar. Pro unlocks deeper tools such as the AI Deliberation Room and grounded 'why did it move?' analysis. Event Passes unlock Pro for a single spectacle's window (for example a World Cup Pass).",
  },
  {
    q: "What is the Deliberation Room?",
    a: "The Deliberation Room is a Pro feature where AI models argue both sides of a market — an advocate builds the fact-based case, a skeptic pressure-tests it, and each cites grounded evidence. You get the full reasoning to inform your own view. It never issues a pick and never tells you to bet.",
  },
  {
    q: "Can AI agents use Tickrr?",
    a: "Yes. Tickrr exposes a public REST API and an MCP (Model Context Protocol) server, so AI agents like Claude and Gemini can call tools such as list_markets, list_dislocations, list_divergences and get_calendar to consume the same intelligence the terminal shows. Responses are intel-only by design.",
  },
  {
    q: "What is a catalyst calendar?",
    a: "The catalyst calendar is the schedule of upcoming market-moving events — FOMC rate decisions, CPI prints, tournament finals, elections — with countdowns, scoped to the category you're viewing. It answers 'what moves this market next?' so you can see context behind a price, not just the number.",
  },
];

export interface ComplianceSection {
  h: string;
  p: string;
}

export const COMPLIANCE: { updated: string; sections: ComplianceSection[] } = {
  updated: "2026-07-03",
  sections: [
    {
      h: "Informational only — not advice",
      p: "Tickrr (a product of Ticker Labs) provides informational analytics about prediction markets. Nothing on Tickrr is financial, investment, legal, tax, or betting advice, an offer or solicitation, or a recommendation to bet, buy, sell, hedge, or size any position. All content is general information presented in probabilistic terms.",
    },
    {
      h: "Intel only — no execution",
      p: "Tickrr does not execute trades, take orders, custody funds, or connect to any brokerage or wallet. It is a decision-support layer. Any action you take on any venue is solely your own decision and responsibility.",
    },
    {
      h: "No guarantees",
      p: "Prediction-market prices and derived analytics are uncertain and can be wrong, stale, or illiquid. Implied probabilities are not promises. Past patterns do not guarantee future results. Verify independently before relying on any figure.",
    },
    {
      h: "Data sources & attribution",
      p: "Market microstructure is sourced from Polymarket's public APIs, which permit derived analytics and customer-facing outputs. Kalshi figures are presented as derived cross-venue analytics with an attributed link to Kalshi; Tickrr does not redistribute Kalshi's raw market feed. Tickrr is independent and not affiliated with, sponsored by, or endorsed by Polymarket, Kalshi, or any exchange.",
    },
    {
      h: "Eligibility & local law",
      p: "Prediction-market participation is restricted or prohibited in some jurisdictions. Tickrr is an information service and does not verify your eligibility to participate in any market. You are responsible for complying with all laws that apply to you.",
    },
    {
      h: "Responsible use",
      p: "Prediction markets carry real financial risk and should be treated as entertainment, not income. Never risk money you cannot afford to lose. If participation stops being fun or feels compulsive, step back and seek support (in the US, call or text 1-800-GAMBLER).",
    },
    {
      h: "Contact",
      p: "Questions about this notice? Contact Ticker Labs at hello@tickrr.app.",
    },
  ],
};

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO YYYY-MM-DD
  tags: string[];
  body: string; // minimal markdown (see seo.ts renderer)
  faqs?: QA[]; // optional per-post Q&A -> FAQPage schema (AEO)
  generated?: boolean; // true if authored by the AI SEO agent
}

// Evergreen, answer-first seed posts. The AI SEO agent appends fresh posts to the store on top.
export const SEED_POSTS: BlogPost[] = [
  {
    slug: "what-is-a-cross-venue-divergence",
    title: "What Is a Cross-Venue Divergence in Prediction Markets?",
    description:
      "A plain-English guide to cross-venue divergences — when Polymarket and Kalshi price the same question differently — and how Tickrr surfaces the gap without comparing apples to oranges.",
    date: "2026-07-01",
    tags: ["prediction markets", "polymarket", "kalshi", "divergence"],
    body: `## The short answer

A **cross-venue divergence** is when the *same* real-world question is priced differently on two prediction-market venues. If Polymarket implies a 10% chance that Bitcoin reaches $100,000 this year and Kalshi implies 13.5%, that **3.5 percentage-point gap** is a divergence.

## Why gaps happen

Prediction markets are venue-specific order books with different traders, fees, and liquidity. The same event can settle at slightly different implied probabilities on each — until arbitrage and information close the gap. Watching the gap is watching two crowds disagree in real time.

## The catch: it must be the same question

A gap is only meaningful if the two markets ask the *identical* question. "Will Bitcoin reach $100k by Dec 31?" is not the same as "Will Bitcoin's yearly low dip to $100k?" Tickrr only pairs **verified like-for-like markets** — same team, same price threshold, same meeting outcome, same resolution window — so a displayed gap is always apples-to-apples.

## How Tickrr shows it

For every market with a counterpart on the other venue, Tickrr displays both implied probabilities and the gap in percentage points, with an attributed link to the source. It's presented as **information** — a prompt to compare both books before trusting either price — never as a recommendation to act.

> Intel only. Tickrr never tells you to bet and never promises an outcome.`,
    faqs: [
      {
        q: "Is a cross-venue divergence an arbitrage opportunity?",
        a: "Not necessarily. A gap reflects different order books, fees, and liquidity; it can persist or close. Tickrr shows the gap as information for comparing venues, not as a trade recommendation.",
      },
      {
        q: "Which venues does Tickrr compare?",
        a: "Polymarket and Kalshi, for verified like-for-like questions in sports, macro (Fed decisions), and crypto (Bitcoin and Ethereum price markets).",
      },
    ],
  },
  {
    slug: "how-to-read-prediction-market-fair-value",
    title: "How to Read Prediction-Market Fair Value",
    description:
      "Implied probability, spread, liquidity, and decision quality — how to read what a prediction-market price is really telling you, and when to distrust it.",
    date: "2026-07-02",
    tags: ["prediction markets", "fair value", "implied probability", "liquidity"],
    body: `## Price is a probability

On a prediction market, a contract that pays $1 if an event happens and trades at 62¢ is the crowd's **implied probability**: about 62%. That's the first thing to read off any price.

## Adjust for spread and liquidity

The headline price hides two costs. The **bid/ask spread** is what you pay to enter and exit — a wide spread means it's easy to overpay. **Liquidity** (book depth) tells you whether the quote survives size or moves the moment you act. Tickrr combines these into a **liquidity-adjusted fair range** and a **decision-quality** rating for each market.

## Spot the dislocation

When a price sits *outside* its fair range — or moves sharply without news, or barely moves despite big news — that's a **dislocation**. It's a flag that the number may be fragile, not a signal to trade.

## Reading it in practice

- **Implied probability**: the crowd's odds, in percent.
- **Fair range**: where the price should sit given spread and liquidity.
- **Decision quality**: good / fair / poor — how much to trust the quote.
- **1-week move**: is conviction strengthening or softening?

> Intel only. These are informational reads, not advice to bet, buy, or sell.`,
    faqs: [
      {
        q: "What does a 62¢ contract price mean?",
        a: "It maps to roughly a 62% implied probability that the event resolves 'Yes' — before adjusting for spread and liquidity.",
      },
    ],
  },
  {
    slug: "prediction-market-catalysts-fomc-cpi",
    title: "Prediction-Market Catalysts: FOMC, CPI, and the Events That Move Prices",
    description:
      "Catalysts are the scheduled events that reprice prediction markets — Fed decisions, CPI prints, finals, elections. Here's how to use a catalyst calendar for context.",
    date: "2026-07-03",
    tags: ["macro", "catalysts", "FOMC", "prediction markets"],
    body: `## What is a catalyst?

A **catalyst** is a scheduled event that can reprice a market the moment it lands: an FOMC rate decision, a CPI inflation print, a tournament final, an election. Between catalysts, prices drift; on the catalyst, they jump.

## Why a calendar matters

A price without context is just a number. Knowing that an **FOMC decision is 25 days out** — or that a **CPI print drops next week** — tells you *why* a macro market is where it is and *what* could move it next. Tickrr's catalyst calendar shows upcoming events with countdowns, scoped to the category you're viewing.

## The big macro catalysts

- **FOMC rate decisions** (~8 per year): the Fed's rate call reprices rate and rate-adjacent markets instantly.
- **CPI prints** (monthly): inflation surprises move macro expectations.
- **Jobs reports**: labor-market data shifts the rate path.

## Using catalysts with divergences

Cross-venue gaps often widen *into* a catalyst as the two crowds disagree about the outcome, then snap shut when the result lands. Watching the calendar alongside the gap is watching the setup and the trigger together — as information, never as a prompt to act.

> Intel only. Tickrr never tells you to bet and never promises an outcome.`,
    faqs: [
      {
        q: "How many times a year does the Fed decide rates?",
        a: "The FOMC holds about eight scheduled meetings per year; each rate decision can reprice rate-sensitive prediction markets immediately.",
      },
    ],
  },
];
