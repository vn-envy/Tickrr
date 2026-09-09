import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relatedForecasts, findings } from '../lib/data/intelligence';
import type { Market, Detail } from '../lib/data/types';
const now = Date.parse('2026-09-09T00:00:00Z');
const market: Market = {
  id: 'poly:1',
  title: 'Will Bitcoin reach 100000 in 2026?',
  category: 'Crypto',
  venue: 'Polymarket',
  sourceUrl: 'https://polymarket.com',
  endAt: '2027-01-01T00:00:00Z',
  observedAt: new Date(now).toISOString(),
  sourceUpdatedAt: null,
  probability: 0.5,
  volume24h: null,
  tokenId: null,
  rules: '',
  tags: [],
};
const candidate = {
  id: 'one',
  question: market.title,
  probability: 0.8,
  closeTime: Date.parse(market.endAt!),
  outcomeType: 'BINARY',
  isResolved: false,
  token: 'MANA',
  url: 'https://manifold.markets/user/bitcoin',
};
test('identical titles remain unverified, play-money context', () => {
  const row = relatedForecasts(market, [candidate], now)[0];
  assert.equal(row.match, 'same_title');
  assert.equal(row.marketType, 'play_money');
  assert.match(row.reasons[0], /not been verified/);
});
test('different thresholds and inverted outcomes get explicit warnings', () => {
  const row = relatedForecasts(
    market,
    [{ ...candidate, question: 'Will Bitcoin not reach 120000 in 2026?' }],
    now,
  )[0];
  assert.equal(row.match, 'related');
  assert.ok(row.reasons.some((r) => r.includes('thresholds')));
  assert.ok(row.reasons.some((r) => r.includes('reverse')));
});
test('unrelated, closed, cash, invalid prices and unsafe URLs are excluded', () => {
  for (const change of [
    { question: 'Will France win the football tournament?' },
    { isResolved: true },
    { closeTime: now - 1 },
    { token: 'CASH' },
    { probability: 2 },
    { url: 'https://manifold.markets.evil.test/' },
  ])
    assert.equal(
      relatedForecasts(market, [{ ...candidate, ...change }], now).length,
      0,
    );
});
const detail: Detail = {
  market,
  book: null,
  execution: null,
  history: [],
  comparisons: [],
  context: [],
  warnings: [],
  observedAt: new Date(now).toISOString(),
};
test('24-hour movement requires genuinely comparable fresh samples', () => {
  const valid = findings(
    {
      ...detail,
      history: [
        { time: (now - 86400000) / 1000, price: 0.4 },
        { time: now / 1000, price: 0.6 },
      ],
    },
    now,
  );
  assert.ok(
    valid.some(
      (f) => f.title === '24-hour repricing' && f.detail.includes('+20.0'),
    ),
  );
  for (const history of [
    [
      { time: (now - 7 * 86400000) / 1000, price: 0.4 },
      { time: now / 1000, price: 0.6 },
    ],
    [
      { time: (now - 86400000) / 1000, price: 0.4 },
      { time: (now + 1000) / 1000, price: 0.6 },
    ],
  ])
    assert.ok(
      !findings({ ...detail, history }, now).some(
        (f) => f.title === '24-hour repricing',
      ),
    );
});
test('single-book and stale quotes do not create bookmaker disagreement', () => {
  const row = {
    outcome: 'A',
    venue: 'one',
    decimalOdds: 2,
    sourceUpdatedAt: new Date(now).toISOString(),
    fairProbability: 0.5,
    group: 'fixture',
  };
  assert.ok(
    !findings(
      { ...detail, comparisons: [row, { ...row, fairProbability: 0.8 }] },
      now,
    ).some((f) => f.title.includes('disagreement')),
  );
  assert.ok(
    !findings(
      {
        ...detail,
        comparisons: [
          row,
          {
            ...row,
            venue: 'two',
            sourceUpdatedAt: new Date(now - 121000).toISOString(),
          },
        ],
      },
      now,
    ).some((f) => f.title.includes('disagreement')),
  );
  assert.ok(
    findings(
      {
        ...detail,
        comparisons: [row, { ...row, venue: 'two', fairProbability: 0.6 }],
      },
      now,
    ).some((f) => f.title.includes('disagreement')),
  );
});
