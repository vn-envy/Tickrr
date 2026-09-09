export type Category = 'Sports' | 'Crypto' | 'Politics' | 'Other';
export type Market = {
  id: string;
  title: string;
  category: Category;
  venue: string;
  sourceUrl: string;
  endAt: string | null;
  observedAt: string;
  sourceUpdatedAt: string | null;
  probability: number | null;
  volume24h: number | null;
  tokenId: string | null;
  rules: string;
  league?: string;
  fixtureId?: string;
  tags: string[];
};
export type SourceState = {
  name: string;
  status: 'available' | 'unavailable' | 'not_configured';
  observedAt: string | null;
  detail: string;
};
export type MarketFeed = {
  markets: Market[];
  sources: SourceState[];
  observedAt: string;
  expiresAt: string;
  stale: boolean;
  nextCursor: string | null;
};
export type Level = { price: number; size: number };
export type Book = {
  bids: Level[];
  asks: Level[];
  sourceUpdatedAt: string | null;
  observedAt: string;
  valid: boolean;
  issues: string[];
};
export type Execution = {
  shares: number;
  filledShares: number;
  averagePrice: number | null;
  cost: number;
  complete: boolean;
  feeIncluded: false;
};
export type Comparison = {
  outcome: string;
  venue: string;
  decimalOdds: number;
  sourceUpdatedAt: string | null;
  fairProbability: number | null;
  group: string;
};
export type Detail = {
  intelligence?: import('./intelligence').Intelligence;
  market: Market;
  book: Book | null;
  execution: Execution | null;
  history: { time: number; price: number }[];
  comparisons: Comparison[];
  context: { title: string; detail: string; sourceUrl: string }[];
  warnings: string[];
  observedAt: string;
};
