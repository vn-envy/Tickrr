import type {
  Market,
  MarketFeed,
  SourceState,
  Detail,
  Category,
} from '../data/types';
import {
  array,
  object,
  probability,
  finite,
  timestamp,
  normalizeBook,
  executeBuy,
  normalizeOpticOdds,
} from '../data/quality';
import { ApiError, database, fetchJson, setting } from './runtime';
function category(title: string, tags: string[]): Category {
  const s = [title, ...tags].join(' ').toLowerCase();
  if (
    /sport|soccer|football|nba|nfl|mlb|premier league|champions league|world cup|tennis|cricket/.test(
      s,
    )
  )
    return 'Sports';
  if (/bitcoin|ethereum|crypto|btc|solana/.test(s)) return 'Crypto';
  if (/politic|election|president|senate|trump|congress/.test(s))
    return 'Politics';
  return 'Other';
}
export function normalizePolymarket(raw: unknown, now = Date.now()): Market[] {
  const o = object(raw);
  if (
    o.closed !== false ||
    o.active !== true ||
    o.archived === true ||
    o.acceptingOrders === false
  )
    return [];
  const endAt = timestamp(o.endDate);
  if (!endAt || Date.parse(endAt) <= now) return [];
  const outcomes = array(o.outcomes);
  const yes = outcomes.findIndex((x) => String(x).toLowerCase() === 'yes');
  if (yes < 0 || outcomes.length !== 2) return [];
  const id = String(o.id || '');
  if (!/^\d+$/.test(id) || typeof o.question !== 'string') return [];
  const tags = array(o.tags).map((x) => String(object(x).label || ''));
  return [
    {
      id: `poly:${id}`,
      title: o.question,
      category: category(o.question, tags),
      venue: 'Polymarket',
      sourceUrl: `https://polymarket.com/market/${encodeURIComponent(String(o.slug || ''))}`,
      endAt,
      observedAt: new Date(now).toISOString(),
      sourceUpdatedAt: null,
      probability: probability(array(o.outcomePrices)[yes]),
      volume24h: finite(o.volume24hr),
      tokenId: String(array(o.clobTokenIds)[yes] || '') || null,
      rules: String(o.description || ''),
      tags,
    },
  ];
}
async function polymarket(cursor: number) {
  const response = await fetchJson(
    `https://gamma-api.polymarket.com/markets?active=true&closed=false&archived=false&limit=100&offset=${cursor}&order=volume24hr&ascending=false`,
  );
  return array(response).flatMap((x) => normalizePolymarket(x));
}
async function optic(path: string, params: URLSearchParams) {
  const key = setting('OPTICODDS_API_KEY');
  if (!key)
    throw new ApiError(
      503,
      'not_configured',
      'Sportsbook data is not connected.',
    );
  return fetchJson(`https://api.opticodds.com/api/v3/${path}?${params}`, {
    headers: { 'X-Api-Key': key },
  });
}
async function fixtures() {
  const leagues = (
    setting('OPTICODDS_LEAGUES') || 'nfl,nba,england_-_premier_league'
  )
    .split(',')
    .slice(0, 3);
  const results = await Promise.all(
    leagues.map((league) =>
      optic('fixtures/active', new URLSearchParams({ league })),
    ),
  );
  return results.flatMap((r, i) =>
    array(object(r).data)
      .slice(0, 30)
      .flatMap((raw) => {
        const f = object(raw),
          endAt = timestamp(f.start_date);
        if (!endAt || Date.parse(endAt) <= Date.now() || f.is_live === true)
          return [];
        const names = [
          ...array(f.away_competitors),
          ...array(f.home_competitors),
        ].map((x) => String(object(x).name || ''));
        if (names.length !== 2 || !f.id) return [];
        return [
          {
            id: `optic:${String(f.id)}`,
            fixtureId: String(f.id),
            title: names.join(' vs '),
            category: 'Sports' as const,
            venue: 'Sportsbooks',
            sourceUrl: 'https://developer.opticodds.com/',
            endAt,
            observedAt: new Date().toISOString(),
            sourceUpdatedAt: null,
            probability: null,
            volume24h: null,
            tokenId: null,
            rules:
              'Moneyline comparison for this fixture. Check the sportsbook’s settlement rules, overtime policy, and regional availability before relying on a price.',
            league: leagues[i],
            tags: [leagues[i]],
          },
        ];
      }),
  );
}
async function readCache<T>(key: string) {
  const row = await database()
    .prepare('SELECT payload,updated_at FROM cache WHERE key=?')
    .bind(key)
    .first<{ payload: string; updated_at: number }>();
  return row
    ? { value: JSON.parse(row.payload) as T, updatedAt: row.updated_at }
    : null;
}
async function saveCache(key: string, payload: unknown) {
  await database()
    .prepare(
      'INSERT INTO cache(key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
    )
    .bind(key, JSON.stringify(payload), Date.now())
    .run();
}
export async function marketFeed(cursor = 0): Promise<MarketFeed> {
  const key = `markets:${cursor}`;
  const cached = await readCache<MarketFeed>(key);
  if (cached && Date.now() - cached.updatedAt < 60000)
    return { ...cached.value, stale: false };
  const lease = await database()
    .prepare(
      "INSERT INTO cache(key,payload,updated_at) VALUES(?,'null',?) ON CONFLICT(key) DO UPDATE SET updated_at=excluded.updated_at WHERE cache.updated_at < ? RETURNING key",
    )
    .bind(`lock:${key}`, Date.now(), Date.now() - 15000)
    .first();
  if (!lease) {
    if (cached && Date.now() - cached.updatedAt < 600000)
      return { ...cached.value, stale: true };
    throw new ApiError(
      503,
      'refresh_in_progress',
      'Market refresh is in progress. Try again shortly.',
    );
  }
  const sources: SourceState[] = [];
  let markets: Market[] = [];
  const results = await Promise.allSettled([
    polymarket(cursor),
    cursor === 0 && setting('OPTICODDS_API_KEY')
      ? fixtures()
      : Promise.resolve([]),
  ]);
  results.forEach((result, i) => {
    const name = i === 0 ? 'Polymarket' : 'OpticOdds';
    const configured = i === 0 || !!setting('OPTICODDS_API_KEY');
    if (result.status === 'fulfilled') {
      markets.push(...result.value);
      sources.push({
        name,
        status: configured ? 'available' : 'not_configured',
        observedAt: configured ? new Date().toISOString() : null,
        detail: configured
          ? 'Snapshot retrieved. Open a market to check executable prices.'
          : 'Sportsbook prices and injury data are not connected.',
      });
    } else
      sources.push({
        name,
        status: 'unavailable',
        observedAt: null,
        detail: 'Source could not be refreshed.',
      });
  });
  await database()
    .prepare('DELETE FROM cache WHERE key=?')
    .bind(`lock:${key}`)
    .run();
  if (!markets.length && cached && Date.now() - cached.updatedAt < 600000)
    return { ...cached.value, stale: true, sources };
  const observedAt = new Date().toISOString();
  const feed: MarketFeed = {
    markets,
    sources,
    observedAt,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    stale: false,
    nextCursor:
      results[0].status === 'fulfilled' && results[0].value.length
        ? String(cursor + 100)
        : null,
  };
  if (markets.length) await saveCache(key, feed);
  return feed;
}
export async function getMarket(id: string): Promise<Market> {
  if (id.startsWith('poly:')) {
    const raw = await fetchJson(
      `https://gamma-api.polymarket.com/markets/${encodeURIComponent(id.slice(5))}`,
    );
    const m = normalizePolymarket(raw)[0];
    if (!m)
      throw new ApiError(
        404,
        'market_not_active',
        'This market is no longer available for active analysis.',
      );
    return m;
  }
  if (id.startsWith('optic:')) {
    const feed = await marketFeed();
    const m = feed.markets.find((x) => x.id === id);
    if (m) return m;
  }
  throw new ApiError(404, 'market_not_found', 'Market not found.');
}
export async function marketDetail(id: string, shares = 100): Promise<Detail> {
  const cached = await readCache<Detail>(`detail:${id}`);
  if (cached && Date.now() - cached.updatedAt < 15000)
    return {
      ...cached.value,
      execution: cached.value.book
        ? executeBuy(cached.value.book, shares)
        : null,
    };
  const market = await getMarket(id);
  const detail: Detail = {
    market,
    book: null,
    execution: null,
    history: [],
    comparisons: [],
    context: [],
    warnings: [],
    observedAt: new Date().toISOString(),
  };
  if (market.tokenId) {
    const results = await Promise.allSettled([
      fetchJson(
        `https://clob.polymarket.com/book?token_id=${encodeURIComponent(market.tokenId)}`,
      ),
      fetchJson(
        `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(market.tokenId)}&interval=1w&fidelity=60`,
      ),
    ]);
    if (results[0].status === 'fulfilled') {
      detail.book = normalizeBook(results[0].value);
      detail.execution = executeBuy(detail.book, shares);
      detail.warnings.push(...detail.book.issues);
    } else
      detail.warnings.push(
        'The order book is unavailable. Displayed market probability is indicative only.',
      );
    if (results[1].status === 'fulfilled')
      detail.history = array(object(results[1].value).history)
        .flatMap((x) => {
          const o = object(x),
            p = probability(o.p),
            t = finite(o.t);
          return p !== null && t !== null ? [{ time: t, price: p }] : [];
        })
        .sort((a, b) => a.time - b.time)
        .slice(-168);
    detail.warnings.push(
      'Fees are not included. Cross-venue equivalence has not been verified.',
    );
  }
  if (market.fixtureId) {
    const params = new URLSearchParams({
      fixture_id: market.fixtureId,
      market: 'moneyline',
      odds_format: 'DECIMAL',
      is_main: 'true',
    });
    for (const book of (
      setting('OPTICODDS_BOOKS') || 'pinnacle,betfair_exchange,draftkings'
    )
      .split(',')
      .slice(0, 5))
      params.append('sportsbook', book);
    const results = await Promise.allSettled([
      optic('fixtures/odds', params),
      optic(
        'fixtures',
        new URLSearchParams({
          id: market.fixtureId,
          include_starting_lineups: 'true',
        }),
      ),
      optic(
        'injuries',
        new URLSearchParams({ league: market.league || 'nfl' }),
      ),
    ]);
    if (results[0].status === 'fulfilled')
      detail.comparisons = normalizeOpticOdds(results[0].value);
    else detail.warnings.push('Sportsbook prices could not be refreshed.');
    if (results[1].status === 'fulfilled') {
      const fixture = object(array(object(results[1].value).data)[0]);
      const teams = [
        ...array(fixture.home_competitors),
        ...array(fixture.away_competitors),
      ].map((x) => String(object(x).id));
      if (results[2].status === 'fulfilled') {
        for (const injury of array(object(results[2].value).data)) {
          const row = object(injury);
          if (teams.includes(String(object(row.team).id)))
            detail.context.push({
              title: `${String(object(row.player).name || 'Player')} · injury report`,
              detail: JSON.stringify({
                status: row.status,
                description: row.description,
                updated_at: row.updated_at,
              }).slice(0, 1200),
              sourceUrl:
                'https://developer.opticodds.com/reference/get_injuries',
            });
        }
      }
      const lineups = fixture.starting_lineups;
      if (lineups)
        detail.context.push({
          title: 'Reported starting lineups',
          detail: JSON.stringify(lineups).slice(0, 4000),
          sourceUrl: 'https://developer.opticodds.com/reference/get_fixtures',
        });
    }
    if (!detail.comparisons.length)
      detail.warnings.push(
        'No complete, fresh moneyline prices are available.',
      );
    detail.warnings.push(
      'Bookmaker fair probabilities remove margin; they are not an independently validated prediction. Settlement rules can differ between books.',
    );
  }
  await saveCache(`detail:${id}`, detail);
  return detail;
}
