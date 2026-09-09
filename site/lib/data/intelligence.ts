import type { Detail, Market } from './types';
import { array, object, probability, timestamp } from './quality';
export type RelatedForecast = {
  id: string;
  title: string;
  sourceUrl: string;
  probability: number;
  closesAt: string;
  updatedAt: string | null;
  observedAt: string;
  venue: 'Manifold';
  marketType: 'play_money';
  match: 'same_title' | 'related';
  reasons: string[];
  rules: string;
};
export type Finding = {
  title: string;
  detail: string;
  kind: 'observation' | 'gap';
};
export type Intelligence = {
  version: '1';
  findings: Finding[];
  forecasts: RelatedForecast[];
  crossCheck: {
    status: 'available' | 'unavailable' | 'no_match';
    detail: string;
    observedAt: string;
  };
};
const stop = new Set(
  'will would could the a an of in on at to is be by for and or before after this that it have happen'.split(
    ' ',
  ),
);
export function words(s: string): string[] {
  return [
    ...new Set(
      (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !stop.has(w)),
    ),
  ];
}
export function searchTerms(title: string): string[] {
  const tokens = words(title);
  return [
    ...new Set([
      tokens.slice(0, 5).join(' '),
      tokens
        .filter((w) => !/^\d+$/.test(w))
        .slice(0, 2)
        .join(' '),
    ]),
  ].filter(Boolean);
}
export function relatedForecasts(
  market: Market,
  raw: unknown,
  now = Date.now(),
): RelatedForecast[] {
  const tokens = words(market.title);
  return array(raw)
    .flatMap((value) => {
      const row = object(value);
      const title = typeof row.question === 'string' ? row.question : '';
      const p = probability(row.probability),
        closesAt = timestamp(row.closeTime);
      // Exclude cash-denominated contracts; this source is used only for crowd context.
      if (
        row.outcomeType !== 'BINARY' ||
        row.isResolved !== false ||
        row.token !== 'MANA' ||
        p === null ||
        !closesAt ||
        Date.parse(closesAt) <= now
      )
        return [];
      const other = words(title),
        overlap = tokens.filter((w) => other.includes(w));
      if (
        overlap.length < 2 ||
        overlap.length / Math.max(tokens.length, other.length, 1) < 0.55
      )
        return [];
      let url: URL;
      try {
        url = new URL(String(row.url));
      } catch {
        return [];
      }
      if (url.protocol !== 'https:' || url.hostname !== 'manifold.markets')
        return [];
      const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const same = clean(title) === clean(market.title);
      const reasons = [
        'Resolution criteria and outcome equivalence have not been verified.',
      ];
      const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) || []).join('|');
      if (nums(title) !== nums(market.title))
        reasons.push('Dates or numeric thresholds in the question differ.');
      const updated = timestamp(row.lastUpdatedTime);
      if (
        !updated ||
        Date.parse(updated) > now + 30000 ||
        now - Date.parse(updated) > 86400000
      )
        reasons.push(
          'Source update time is missing, more than a day old, or inconsistent; the forecast may not reflect recent information.',
        );
      if (
        market.endAt &&
        Math.abs(Date.parse(market.endAt) - Date.parse(closesAt)) > 86400000
      )
        reasons.push(
          'Closing times differ by more than one day; close time may differ from the event deadline.',
        );
      if (
        /\b(not|never|won't|fail)\b/i.test(title) !==
        /\b(not|never|won't|fail)\b/i.test(market.title)
      )
        reasons.push('Question wording may reverse the outcome.');
      return [
        {
          id: String(row.id),
          title,
          sourceUrl: url.href,
          probability: p,
          closesAt,
          updatedAt: timestamp(row.lastUpdatedTime),
          observedAt: new Date(now).toISOString(),
          venue: 'Manifold' as const,
          marketType: 'play_money' as const,
          match: same ? ('same_title' as const) : ('related' as const),
          reasons,
          rules: '',
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.match === 'same_title') - Number(a.match === 'same_title'),
    )
    .slice(0, 4);
}
export function findings(detail: Detail, now = Date.now()): Finding[] {
  const result: Finding[] = [];
  const history = detail.history
    .filter((p) => p.time * 1000 <= now && p.time * 1000 >= now - 8 * 86400000)
    .sort((a, b) => a.time - b.time);
  const latest = history.at(-1);
  const baseline = history
    .filter((p) => p.time * 1000 <= now - 86400000)
    .at(-1);
  if (
    latest &&
    baseline &&
    now - latest.time * 1000 <= 7200000 &&
    now - 86400000 - baseline.time * 1000 <= 7200000
  ) {
    const change = (latest.price - baseline.price) * 100;
    result.push({
      title: '24-hour repricing',
      detail: `Yes moved ${change >= 0 ? '+' : ''}${change.toFixed(1)} percentage points between ${new Date(baseline.time * 1000).toISOString()} and ${new Date(latest.time * 1000).toISOString()}. This measures price movement, not new information or predictive accuracy.`,
      kind: 'observation',
    });
  } else
    result.push({
      title: 'Movement evidence incomplete',
      detail:
        'Fresh observations near now and 24 hours ago are needed to calculate a comparable change.',
      kind: 'gap',
    });
  const book = detail.book;
  if (
    book?.valid &&
    book.sourceUpdatedAt &&
    now - Date.parse(book.sourceUpdatedAt) <= 120000 &&
    Date.parse(book.sourceUpdatedAt) <= now + 30000
  ) {
    const spread = (book.asks[0].price - book.bids[0].price) * 100;
    result.push({
      title: spread >= 5 ? 'Wide bid–ask spread' : 'Current trading friction',
      detail: `The best buy and sell quotes differ by ${spread.toFixed(1)} percentage points before fees. An indicative price is not a guaranteed fill.`,
      kind: 'observation',
    });
    if (detail.execution)
      result.push({
        title: detail.execution.complete
          ? 'Requested size covered'
          : 'Insufficient displayed depth',
        detail: `${detail.execution.filledShares.toFixed(2)} of ${detail.execution.shares} shares are available at an average ${(100 * (detail.execution.averagePrice || 0)).toFixed(1)}¢ before fees. Depth can change before execution.`,
        kind: 'observation',
      });
  } else
    result.push({
      title: 'Executable price unverified',
      detail:
        'A fresh, valid order book is missing. No executable edge can be calculated.',
      kind: 'gap',
    });
  const groups = new Map<string, typeof detail.comparisons>();
  for (const row of detail.comparisons) {
    if (
      row.fairProbability === null ||
      !row.sourceUpdatedAt ||
      now - Date.parse(row.sourceUpdatedAt) > 120000 ||
      Date.parse(row.sourceUpdatedAt) > now + 30000
    )
      continue;
    const key = row.outcome.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  for (const [outcome, rows] of groups) {
    const distinct = [...new Map(rows.map((r) => [r.venue, r])).values()];
    if (distinct.length < 2) continue;
    const probs = distinct.map((r) => r.fairProbability!);
    result.push({
      title: `Bookmaker disagreement · ${outcome}`,
      detail: `${distinct.length} books imply ${Math.min(...probs).toFixed(3)}–${Math.max(...probs).toFixed(3)} probability after each book’s margin is removed (${((Math.max(...probs) - Math.min(...probs)) * 100).toFixed(1)} percentage points apart). This is market disagreement, not a validated fair-value model; settlement rules still need checking.`,
      kind: 'observation',
    });
  }
  result.push({
    title: 'Independent prediction not established',
    detail:
      'These diagnostics explain observed markets. Tickrr has not yet demonstrated out-of-sample forecasting accuracy or an after-fee betting advantage.',
    kind: 'gap',
  });
  return result;
}
