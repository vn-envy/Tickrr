import type { Market } from '../data/types';
import type { Intelligence } from '../data/intelligence';
import { relatedForecasts, searchTerms } from '../data/intelligence';
import { array, object } from '../data/quality';
import { database, fetchJson, consumeLimit } from './runtime';
export async function crossCheck(
  market: Market,
): Promise<Pick<Intelligence, 'forecasts' | 'crossCheck'>> {
  const key = `cross-check:v1:${market.id}`;
  const cached = await database()
    .prepare('SELECT payload,updated_at FROM cache WHERE key=?')
    .bind(key)
    .first<{ payload: string; updated_at: number }>();
  if (cached && Date.now() - cached.updated_at < 300000)
    return JSON.parse(cached.payload);
  const observedAt = new Date().toISOString();
  let result: Pick<Intelligence, 'forecasts' | 'crossCheck'>;
  try {
    // A shared budget bounds uncached requests across users and market IDs.
    await consumeLimit('manifold:cross-check', 50, 60);
    const requests = await Promise.allSettled(
      searchTerms(market.title).map((term) =>
        fetchJson(
          `https://api.manifold.markets/v0/search-markets?${new URLSearchParams({ term, filter: 'open', contractType: 'BINARY', limit: '30', sort: 'liquidity' })}`,
        ),
      ),
    );
    if (requests.every((r) => r.status === 'rejected'))
      throw new Error('Source unavailable');
    const raw = requests.flatMap((r) =>
      r.status === 'fulfilled' ? array(r.value) : [],
    );
    let forecasts = relatedForecasts(market, [
      ...new Map(raw.map((r) => [String(object(r).id), r])).values(),
    ]);
    const candidateCount = forecasts.length;
    forecasts = await Promise.all(
      forecasts.map(async (forecast) => {
        try {
          const full = object(
            await fetchJson(
              `https://api.manifold.markets/v0/market/${encodeURIComponent(forecast.id)}`,
            ),
          );
          const fresh = relatedForecasts(market, [full])[0];
          return fresh
            ? {
                ...fresh,
                rules: String(full.textDescription || '').slice(0, 4000),
              }
            : null;
        } catch {
          return null;
        }
      }),
    ).then((rows) => rows.filter((row) => row !== null));
    if (candidateCount && !forecasts.length)
      throw new Error('Candidate details unavailable');
    result = {
      forecasts,
      crossCheck: {
        status: forecasts.length ? 'available' : 'no_match',
        observedAt,
        detail: forecasts.length
          ? 'Related Manifold play-money forecasts retrieved. Similarity is a discovery aid; no contract equivalence, consensus probability or tradable price advantage is inferred.'
          : 'No qualifying related forecast was retrieved from the bounded Manifold search. This does not establish agreement or absence of other markets.',
      },
    };
  } catch {
    result = {
      forecasts: [],
      crossCheck: {
        status: 'unavailable',
        observedAt,
        detail:
          'Independent crowd forecasts could not be refreshed. Cross-platform corroboration is unavailable.',
      },
    };
  }
  await database()
    .prepare(
      'INSERT INTO cache(key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
    )
    .bind(key, JSON.stringify(result), Date.now())
    .run();
  return result;
}
