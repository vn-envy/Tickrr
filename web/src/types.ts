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
  value: number; // Valuation / Index score (e.g., 92.4)
  change: number; // 24h performance delta (%)
  efficiency: number; // PER or true efficiency
  stamina: number; // Athletic stamina index (1-100)
  speed: number; // Speed rating (km/h or relative score)
  staminaHistory: number[]; // For interactive charts
  efficiencyHistory: number[];
  speedHistory: number[];
  playmakingHistory: number[];
  defenseHistory: number[];
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
    kalshi: number;
    gapPP: number;
    url?: string;
  };
  enrichment?: {
    topScorer?: string;
    topScorerProb?: number;
    attackingThreat?: number;
  };
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
