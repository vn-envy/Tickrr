/**
 * Central glossary for every metric shown in the terminal. One source of truth so the
 * on-hover InfoTips read consistently — each entry says what it is AND why it matters.
 * (pp = percentage points.)
 */
export interface GlossaryEntry { title: string; tip: string; }

export const GLOSSARY: Record<string, GlossaryEntry> = {
  impliedProb: {
    title: "Implied probability",
    tip: "The market price read as a probability — a 62¢ 'Yes' ≈ a 62% chance. Why it matters: it's the crowd's single best estimate of how likely the outcome is.",
  },
  change1w: {
    title: "1-week change",
    tip: "How much the implied probability moved over the last 7 days, in percentage points (pp). Why it matters: shows whether conviction is building or fading.",
  },
  liquidity: {
    title: "Liquidity (0–100)",
    tip: "How deep the order book is. Why it matters: deep liquidity means the price can absorb size without moving — a thin book can't, so a thin-market price is fragile.",
  },
  quality: {
    title: "Decision quality",
    tip: "Our good / fair / poor rating combining liquidity and spread. Why it matters: it tells you how much to trust the quoted price for a real decision.",
  },
  spread: {
    title: "Spread cost",
    tip: "The round-trip gap between the buy and sell price. Why it matters: a wide spread means you overpay to enter and exit — it eats any edge.",
  },
  momentum: {
    title: "Momentum (1W)",
    tip: "Recent price movement over the last week. Why it matters: separates a trending market from a range-bound one.",
  },
  consensus: {
    title: "Consensus strength",
    tip: "How far the price sits from a 50/50 coin-flip. Why it matters: shows how opinionated (vs contested) the crowd is about the outcome.",
  },
  gap: {
    title: "Cross-venue gap",
    tip: "The difference in implied probability for the SAME question on Polymarket vs Kalshi, in pp. Why it matters: when two venues disagree, at least one price may be off — compare both before trusting either.",
  },
  severity: {
    title: "Signal severity",
    tip: "How strong / urgent a dislocation flag is (0–100). Why it matters: ranks which signals deserve your attention first.",
  },
  net: {
    title: "Net change",
    tip: "The implied probability's overall drift across the shown period, in pp. Why it matters: the period's direction at a glance.",
  },
  fairRange: {
    title: "Fair-value range",
    tip: "Where the price should sit once spread and liquidity are accounted for. Why it matters: a price outside this band flags a possible dislocation.",
  },
  fairValue: {
    title: "Fair-value meter",
    tip: "Where the live price sits relative to the bid/ask fair band. Why it matters: inside the band = consensus; outside = possible mispricing worth inspecting.",
  },
  liveSignals: {
    title: "Live signals",
    tip: "Single-venue dislocations we flag in real time — momentum, overreaction, or thin-liquidity traps. Why it matters: these are the spots where a price may be mispriced or fragile.",
  },
  crossVenue: {
    title: "Cross-venue gaps",
    tip: "The same question priced on both Polymarket and Kalshi, with the gap in pp and a link to Kalshi. Why it matters: cross-venue disagreement is a classic tell that a price is off.",
  },
  marketQuality: {
    title: "Market quality",
    tip: "How decision-grade this price is, scored across liquidity, spread, momentum and consensus. Why it matters: a high score means the number is trustworthy; a low one means treat it with caution.",
  },
  intelReport: {
    title: "Intelligence report",
    tip: "A Gemini-generated, Google-Search-grounded read of what the price implies, what moved it, and the risks — with sources. Intel only, never a pick.",
  },
  venues: {
    title: "Cross-venue value",
    tip: "The same outcome priced by three crowds — Polymarket, Kalshi, and the de-vigged sportsbook consensus (DraftKings, FanDuel, Pinnacle & co via The Odds API) — on one axis. Why it matters: when the marks separate, at least one crowd is mispricing the outcome; the separation is where value hides.",
  },
  edge: {
    title: "Edge vs books",
    tip: "Polymarket's implied probability minus the sportsbook consensus (falls back to the Kalshi gap when books don't price it), in pp. Why it matters: a persistent gap vs the real-money bookmaker crowd is the cleanest value signal on the board.",
  },
};
