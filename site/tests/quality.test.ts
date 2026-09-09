import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  probability,
  normalizeBook,
  executeBuy,
  fairProbabilities,
  normalizeOpticOdds,
  timestamp,
} from '../lib/data/quality';
const now = Date.parse('2026-09-09T00:00:00Z');
const book = (bids: unknown[], asks: unknown[], time = now) =>
  normalizeBook({ bids, asks, timestamp: String(time) }, now);
test('unknown and impossible prices remain unavailable', () => {
  for (const v of [null, undefined, '', -1, 1.2, 'NaN'])
    assert.equal(probability(v), null);
  assert.equal(probability(0), 0);
});
test('crossed book cannot produce execution estimate', () => {
  const b = book(
    [{ price: '.8', size: '100' }],
    [{ price: '.2', size: '100' }],
  );
  assert.equal(b.valid, false);
  assert.equal(executeBuy(b, 100), null);
});
test('stale, future and missing source time fail closed', () => {
  assert.equal(
    book(
      [{ price: '.4', size: '100' }],
      [{ price: '.5', size: '100' }],
      now - 121000,
    ).valid,
    false,
  );
  assert.equal(
    book(
      [{ price: '.4', size: '100' }],
      [{ price: '.5', size: '100' }],
      now + 31000,
    ).valid,
    false,
  );
  assert.equal(normalizeBook({ bids: [], asks: [] }, now).valid, false);
});
test('depth calculation sorts prices and does not fabricate a full fill', () => {
  const b = book(
    [{ price: '.4', size: '10' }],
    [
      { price: '.6', size: '10' },
      { price: '.5', size: '20' },
    ],
  );
  assert.deepEqual(executeBuy(b, 40), {
    shares: 40,
    filledShares: 30,
    averagePrice: 16 / 30,
    cost: 16,
    complete: false,
    feeIncluded: false,
  });
  assert.equal(executeBuy(b, 20)?.cost, 10);
});
test('single or duplicate outcomes cannot become 100% fair value', () => {
  assert.equal(fairProbabilities([{ name: 'A', odds: 10 }], ['A']).size, 0);
  assert.equal(
    fairProbabilities(
      [
        { name: 'A', odds: 2 },
        { name: 'A', odds: 2 },
      ],
      ['A', 'B'],
    ).size,
    0,
  );
  assert.equal(
    fairProbabilities(
      [
        { name: 'A', odds: 2 },
        { name: 'B', odds: 2 },
      ],
      ['A', 'B'],
    ).get('A'),
    0.5,
  );
});
test('timestamp normalization preserves source time', () => {
  assert.equal(timestamp(now / 1000), new Date(now).toISOString());
  assert.equal(timestamp('invalid'), null);
});
test('OpticOdds rejects stale lines and keeps opposing books separate', () => {
  const base = {
    market_id: 'moneyline',
    is_main: true,
    timestamp: now / 1000,
    price: 2,
  };
  const data = {
    data: [
      {
        id: 'fixture-1',
        home_competitors: [{ name: 'A' }],
        away_competitors: [{ name: 'B' }],
        odds: [
          { ...base, sportsbook: 'one', selection: 'A' },
          { ...base, sportsbook: 'two', selection: 'B' },
          {
            ...base,
            sportsbook: 'stale',
            selection: 'A',
            timestamp: (now - 121000) / 1000,
          },
        ],
      },
    ],
  };
  const rows = normalizeOpticOdds(data, now);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.fairProbability === null));
  assert.notEqual(rows[0].group, rows[1].group);
});
