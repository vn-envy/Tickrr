import { SiteHeader } from '@/components/site-header';
export default function ApiDocs() {
  return (
    <main>
      <SiteHeader />
      <article className="workspace prose-page">
        <div className="eyebrow">DEVELOPERS</div>
        <h1>One evidence model. Clear limits.</h1>
        <p>
          Tickrr’s versioned API returns source identity, retrieval times,
          missing fields, and quote quality alongside market data. External
          access is enabled only for licensed coverage.
        </p>
        <h2>Market discovery</h2>
        <pre>GET /api/v1/markets?cursor=0</pre>
        <p>
          Returns markets, source availability, observedAt, expiresAt, stale,
          and nextCursor. Follow nextCursor to paginate. The public interface
          uses the same response.
        </p>
        <h2>Market evidence</h2>
        <pre>GET /api/v1/markets/poly%3A123?shares=100</pre>
        <p>
          Use an actual id from discovery. Returns resolution rules, validated
          book depth, a pre-fee execution estimate, history, provider context,
          and explicit warnings. Unavailable values are null, never fabricated
          zeroes.
        </p>
        <h2>Authentication and limits</h2>
        <pre>Authorization: Bearer YOUR_TICKRR_API_KEY</pre>
        <p>
          When external access opens, Pro members can generate a key in their
          account. Keys are stored as hashes, scoped to a user, and limited to
          60 requests per minute. A new key revokes the previous one. Missing
          coverage is not permission to redistribute provider data.
        </p>
        <h2>Error contract</h2>
        <pre>
          {JSON.stringify(
            {
              error: {
                code: 'rate_limit',
                message: 'Request limit reached. Please try again later.',
              },
            },
            null,
            2,
          )}
        </pre>
        <p>
          400: invalid input. 401: sign-in or key required. 403: subscription or
          coverage unavailable. 404: market not active. 429: limit reached. 503:
          temporary service failure.
        </p>
        <h2>Freshness</h2>
        <p>
          Discovery is cached for up to 60 seconds. On upstream failure, an
          explicitly stale snapshot may be shown for up to 10 minutes. Book
          evidence is cached for 15 seconds and must pass a two-minute source
          timestamp check. Consumers must also compare timestamps at use time.
        </p>
        <a href="/methodology">Read the full methodology ↗</a>
      </article>
    </main>
  );
}
