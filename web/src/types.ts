/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SportsEntity {
  id: string;
  name: string;
  ticker: string;
  sport: "Basketball" | "Football" | "Soccer" | "F1" | "Tennis";
  team: string;
  league?: string; // event universe this market came from (e.g. "World Cup", "NFL")
  value: number; // Valuation / Index score (e.g., 92.4)
  change: number; // 24h performance delta (%)
  efficiency: number; // PER or true efficiency
  stamina: number; // Athletic stamina index (1-100)
  speed: number; // Speed rating (km/h or relative score)
  // Legacy demo-only series (seed data). Live markets never synthesize these — the
  // telemetry chart plots the REAL implied-probability history from the Polymarket CLOB.
  staminaHistory?: number[];
  efficiencyHistory?: number[];
  speedHistory?: number[];
  playmakingHistory?: number[];
  defenseHistory?: number[];
  category: "athlete" | "team";
  // --- Live prediction-market fields (Tickrr); optional so seed data still type-checks ---
  impliedProb?: number;      // %, 0..100
  fairLow?: number;          // % band low (real bid when published)
  fairHigh?: number;         // % band high (real ask when published)
  spreadCost?: number;       // % round-trip spread
  liquidityScore?: number;   // 0..100
  decisionQuality?: string;  // "good" | "fair" | "thin"
  oneWeekChange?: number;    // % over 1 week
  url?: string;
  volume?: number;
  liquidity?: number;
  dislocation?: {
    kind: string;
    label: string;
    severity: number;
    direction: string;
    action: string;
    rationale: string;
    link?: string;
  };
  divergence?: {
    polymarket: number;
    kalshi?: number;
    gapPP: number;
    url?: string;
    books?: number;      // sportsbook consensus implied prob % (The Odds API, de-vigged)
    bookCount?: number;  // quotes behind the consensus
    bestBook?: string;   // who offers the best raw price
    bestPrice?: number;  // best decimal price on offer
    booksGapPP?: number; // polymarket - books, pp
  };
  enrichment?: {
    topScorer?: string;
    topScorerProb?: number;
    attackingThreat?: number;
  };
  playerCountry?: string;
  clobTokenId?: string;
}

export interface MetricDetail {
  name: string;
  score: number;
  comment: string;
}

export interface InsightReport {
  summary: string;
  metrics: MetricDetail[];
  strengths: string[];
  weaknesses: string[];
  careerTrajectory: string;
  historicalComparisons: string[];
  financialValuation: string;
  recommendedActions: string[];
}
