import type { Book, Execution, Level, Comparison } from './types';
export function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function probability(value: unknown): number | null {
  const n = finite(value);
  return n !== null && n >= 0 && n <= 1 ? n : null;
}
export function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const n =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  const t = new Date(
    typeof n === 'number' && n < 1e11 ? n * 1000 : n,
  ).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const a = JSON.parse(value);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }
  return [];
}
export function levels(value: unknown): Level[] {
  return array(value).flatMap((x) => {
    const o = object(x),
      p = probability(o.price),
      s = finite(o.size);
    return p !== null && s !== null && s > 0 ? [{ price: p, size: s }] : [];
  });
}
export function normalizeBook(value: unknown, now = Date.now()): Book {
  const o = object(value),
    bids = levels(o.bids).sort((a, b) => b.price - a.price),
    asks = levels(o.asks).sort((a, b) => a.price - b.price),
    sourceUpdatedAt = timestamp(o.timestamp);
  const issues: string[] = [];
  if (!bids.length || !asks.length)
    issues.push('One side of the order book is empty.');
  if (bids.length && asks.length && bids[0].price > asks[0].price)
    issues.push('Crossed order book: prices cannot be compared.');
  if (!sourceUpdatedAt) issues.push('Source timestamp is missing.');
  else if (
    now - Date.parse(sourceUpdatedAt) > 120000 ||
    Date.parse(sourceUpdatedAt) > now + 30000
  )
    issues.push('Order-book timestamp is outside the freshness window.');
  return {
    bids,
    asks,
    sourceUpdatedAt,
    observedAt: new Date(now).toISOString(),
    valid: issues.length === 0,
    issues,
  };
}
export function executeBuy(book: Book, shares: number): Execution | null {
  if (!book.valid || !Number.isFinite(shares) || shares <= 0 || shares > 100000)
    return null;
  let remaining = shares,
    cost = 0;
  for (const level of book.asks) {
    const fill = Math.min(remaining, level.size);
    cost += fill * level.price;
    remaining -= fill;
    if (remaining <= 1e-8) break;
  }
  const filledShares = shares - remaining;
  return {
    shares,
    filledShares,
    cost,
    averagePrice: filledShares ? cost / filledShares : null,
    complete: remaining <= 1e-8,
    feeIncluded: false,
  };
}
// Only a complete, named outcome set from ONE bookmaker can be de-vigged.
export function fairProbabilities(
  outcomes: { name: string; odds: number }[],
  expected: string[],
): Map<string, number> {
  if (
    expected.length < 2 ||
    expected.length > 3 ||
    outcomes.length !== expected.length ||
    new Set(outcomes.map((x) => x.name)).size !== expected.length ||
    !expected.every((n) => outcomes.some((x) => x.name === n)) ||
    outcomes.some((x) => !Number.isFinite(x.odds) || x.odds <= 1)
  )
    return new Map();
  const sum = outcomes.reduce((s, x) => s + 1 / x.odds, 0);
  if (sum < 0.9 || sum > 1.4) return new Map();
  return new Map(outcomes.map((x) => [x.name, 1 / x.odds / sum]));
}
export function normalizeOpticOdds(
  value: unknown,
  now = Date.now(),
): Comparison[] {
  const fixtures = array(object(value).data);
  const result: Comparison[] = [];
  for (const raw of fixtures) {
    const fixture = object(raw);
    const names = [
      ...array(fixture.home_competitors),
      ...array(fixture.away_competitors),
    ].map((x) => String(object(x).name || ''));
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const item of array(fixture.odds)) {
      const o = object(item);
      if (
        String(o.market_id || '') !== 'moneyline' ||
        o.is_main === false ||
        o.is_live === true
      )
        continue;
      const key = [fixture.id, o.sportsbook, o.market_id, o.points ?? ''].join(
        '|',
      );
      groups.set(key, [...(groups.get(key) || []), o]);
    }
    for (const [group, rows] of groups) {
      const fresh = rows.filter((row) => {
        const t = timestamp(row.timestamp);
        return (
          t !== null &&
          now - Date.parse(t) <= 120000 &&
          Date.parse(t) <= now + 30000
        );
      });
      const expected = rows.some(
        (r) => String(r.selection).toLowerCase() === 'draw',
      )
        ? [...names, 'Draw']
        : names;
      const mapped = fresh.map((r) => ({
        name: String(r.selection || r.name || ''),
        odds: Number(r.price),
      }));
      const fair = fairProbabilities(mapped, expected);
      for (let i = 0; i < fresh.length; i++) {
        const row = fresh[i],
          t = timestamp(row.timestamp),
          p = Number(row.price);
        if (
          !t ||
          now - Date.parse(t) > 120000 ||
          Date.parse(t) > now + 30000 ||
          !Number.isFinite(p) ||
          p <= 1
        )
          continue;
        result.push({
          outcome: mapped[i].name,
          venue: String(row.sportsbook || ''),
          decimalOdds: p,
          sourceUpdatedAt: t,
          fairProbability: fair.get(mapped[i].name) ?? null,
          group,
        });
      }
    }
  }
  return result;
}
