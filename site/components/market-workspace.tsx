'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  RefreshCw,
  ArrowUpRight,
  Bookmark,
  Search,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import type { MarketFeed, Market, Detail } from '@/lib/data/types';
const pct = (p: number | null) =>
  p === null ? '—' : `${(p * 100).toFixed(1)}%`;
const date = (d: string | null) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not supplied';
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(path, options),
    d = (await r.json()) as T & { error?: { message: string } };
  if (!r.ok)
    throw new Error(d.error?.message || 'Unable to complete this request.');
  return d;
}
export default function MarketWorkspace({ signedIn }: { signedIn: boolean }) {
  const [feed, setFeed] = useState<MarketFeed | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('All markets'),
    [selected, setSelected] = useState<Market | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [detailError, setDetailError] = useState(''),
    [shares, setShares] = useState('100'),
    [analysis, setAnalysis] = useState(''),
    [analyzing, setAnalyzing] = useState(false),
    [notice, setNotice] = useState(''),
    [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await api<MarketFeed>('/api/v1/markets'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden) void refresh();
    }, 60000);
    const age = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(age);
    };
  }, [refresh]);
  const loadDetail = useCallback(async (m: Market, size: string) => {
    const g = ++generation.current;
    setDetail(null);
    setDetailError('');
    try {
      const result = await api<Detail>(
        `/api/v1/markets/${encodeURIComponent(m.id)}?shares=${encodeURIComponent(size)}`,
      );
      if (g === generation.current) setDetail(result);
    } catch (e) {
      if (g === generation.current) setDetailError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!feed) return;
    const id = new URLSearchParams(location.search).get('market');
    const market = feed.markets.find((m) => m.id === id);
    if (market) {
      setSelected(market);
      void loadDetail(market, '100');
      history.replaceState(null, '', '/');
    }
  }, [feed, loadDetail]);
  function openMarket(m: Market) {
    setSelected(m);
    setAnalysis('');
    setNotice('');
    void loadDetail(m, shares);
  }
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      if (!document.hidden) void loadDetail(selected, shares);
    }, 30000);
    return () => clearInterval(interval);
  }, [selected, shares, loadDetail]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const c = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'filter_tickrr_markets',
          description: 'Filter the visible Tickrr market list by text.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string', maxLength: 120 } },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute(input: unknown) {
            if (
              !input ||
              typeof input !== 'object' ||
              !('query' in input) ||
              typeof input.query !== 'string' ||
              input.query.length > 120
            )
              throw new Error('A query of at most 120 characters is required.');
            setQuery(input.query);
            return { query: input.query };
          },
        },
        { signal: c.signal },
      ),
    ).catch(() => {});
    return () => c.abort();
  }, []);
  const markets = (feed?.markets || []).filter(
    (m) =>
      (category === 'All markets' || m.category === category) &&
      m.title.toLowerCase().includes(query.toLowerCase()),
  );
  const stale = !!feed && (feed.stale || Date.parse(feed.expiresAt) < now);
  const detailStale = !!detail && now - Date.parse(detail.observedAt) > 120000;
  async function save() {
    if (!selected) return;
    try {
      await api('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: selected.id }),
      });
      setNotice('Saved to your watchlist.');
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  async function analyze() {
    if (!selected) return;
    setAnalyzing(true);
    setNotice('');
    try {
      const r = await api<{ text: string }>('/api/v1/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: selected.id }),
      });
      setAnalysis(r.text);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }
  async function more() {
    if (!feed?.nextCursor) return;
    setLoading(true);
    try {
      const next = await api<MarketFeed>(
        `/api/v1/markets?cursor=${feed.nextCursor}`,
      );
      setFeed({
        ...next,
        markets: [
          ...new Map(
            [...feed.markets, ...next.markets].map((m) => [m.id, m]),
          ).values(),
        ],
        sources: feed.sources,
        observedAt: feed.observedAt,
        expiresAt: feed.expiresAt,
        stale: feed.stale || next.stale,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="eyebrow">THE MARKET, WITH CONTEXT</div>
      <div className="heading">
        <div>
          <h1>Make sense of the odds.</h1>
          <p>Compare prices. Check the evidence. Know what is missing.</p>
        </div>
        <Button
          variant="outline"
          className="h-11 px-5"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh markets'}
        </Button>
      </div>
      <div className="search-wrap">
        <Search size={19} />
        <Input
          aria-label="Search markets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a team, event, or market…"
          className="search"
          maxLength={120}
        />
      </div>
      <div className="filters">
        {['All markets', 'Sports', 'Crypto', 'Politics', 'Other'].map((c) => (
          <Button
            key={c}
            variant={category === c ? 'default' : 'ghost'}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>
      {error && (
        <p className="alert" role="alert">
          {error} {feed ? 'Previously retrieved prices are shown below.' : ''}
        </p>
      )}
      {stale && (
        <p className="alert">
          This snapshot is out of date. Refresh before comparing prices.
        </p>
      )}
      <div className="market-layout">
        <section className="panel">
          <div className="panel-title">
            <span className="market-count">{markets.length} markets</span>
            <span>
              {feed
                ? `Retrieved ${date(feed.observedAt)}`
                : 'Connecting to market sources…'}
            </span>
          </div>
          {markets.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Market</TableHead>
                  <TableHead>Yes price</TableHead>
                  <TableHead className="desktop-cell">
                    Closes / starts
                  </TableHead>
                  <TableHead className="pr-5 text-right">Research</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {markets.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-5 market-cell">
                      <button
                        className="market-title"
                        onClick={() => openMarket(m)}
                      >
                        {m.title}
                      </button>
                      <div className="market-meta">
                        {m.category} <span>·</span> {m.venue}
                      </div>
                    </TableCell>
                    <TableCell>
                      <strong className="probability">
                        {pct(m.probability)}
                      </strong>
                      <div className="market-meta">Indicative</div>
                    </TableCell>
                    <TableCell className="desktop-cell date-cell">
                      {date(m.endAt)}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        aria-label={`Research ${m.title}`}
                        onClick={() => openMarket(m)}
                      >
                        <ArrowUpRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <Activity size={28} />
              <h2>
                {loading
                  ? 'Retrieving current markets…'
                  : query
                    ? 'No matches on this page.'
                    : 'No active markets available.'}
              </h2>
              <p>
                {query
                  ? 'Try another name, change the category, or load more markets.'
                  : 'We only show market data returned by a source. Refresh to try again.'}
              </p>
            </div>
          )}
          {feed?.nextCursor && (
            <div className="load-more">
              <Button
                variant="outline"
                onClick={() => void more()}
                disabled={loading}
              >
                Load more markets
              </Button>
            </div>
          )}
        </section>
        <aside>
          <section className="panel evidence">
            <span className="eyebrow">BEFORE YOU DECIDE</span>
            <h2>A price is only part of the picture.</h2>
            <div>
              <b>01 · Freshness</b>
              <p>See the time behind every quote.</p>
            </div>
            <div>
              <b>02 · Tradability</b>
              <p>Check the spread and available depth.</p>
            </div>
            <div>
              <b>03 · Evidence</b>
              <p>Read the rules and the reasons for uncertainty.</p>
            </div>
          </section>
          <section className="panel sources">
            <h3>
              <ShieldCheck size={17} /> Data connections
            </h3>
            {feed?.sources.map((s) => (
              <div key={s.name}>
                <b>{s.name}</b>
                <span className={s.status === 'available' ? 'connected' : ''}>
                  {s.status.replace('_', ' ')}
                </span>
                <p>{s.detail}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            generation.current++;
          }
        }}
      >
        <SheetContent className="detail-sheet w-full sm:max-w-[620px]">
          <SheetHeader>
            <div className="eyebrow">{selected?.venue} · MARKET RESEARCH</div>
            <SheetTitle className="text-2xl leading-snug mt-3 pr-5">
              {selected?.title}
            </SheetTitle>
            <SheetDescription>
              Closes / starts {date(selected?.endAt || null)}
            </SheetDescription>
          </SheetHeader>
          <div className="detail-body">
            {detailError ? (
              <p role="alert" className="alert">
                {detailError}
              </p>
            ) : !detail ? (
              <p aria-live="polite">Checking prices and evidence…</p>
            ) : (
              <>
                {detailStale && (
                  <p className="alert">
                    These details are out of date. Refresh to compare prices.
                  </p>
                )}
                <div className="quote-grid">
                  <div>
                    <span>Best buy · Yes</span>
                    <strong>
                      {detail.book?.valid && !detailStale
                        ? pct(detail.book.asks[0]?.price ?? null)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Best sell · Yes</span>
                    <strong>
                      {detail.book?.valid && !detailStale
                        ? pct(detail.book.bids[0]?.price ?? null)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span>Spread</span>
                    <strong>
                      {detail.book?.valid && !detailStale
                        ? `${((detail.book.asks[0].price - detail.book.bids[0].price) * 100).toFixed(1)} pts`
                        : '—'}
                    </strong>
                  </div>
                </div>
                <p className="small">
                  Book timestamp: {date(detail.book?.sourceUpdatedAt || null)} ·
                  Retrieved {date(detail.observedAt)}
                </p>
                {detail.book && (
                  <section className="detail-section">
                    <h3>What can actually trade?</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (selected) void loadDetail(selected, shares);
                      }}
                      className="size-form"
                    >
                      <label htmlFor="shares">Shares to buy</label>
                      <Input
                        id="shares"
                        type="number"
                        min="1"
                        max="100000"
                        value={shares}
                        onChange={(e) => setShares(e.target.value)}
                      />
                      <Button type="submit" variant="outline">
                        Check size
                      </Button>
                    </form>
                    {detail.execution && !detailStale ? (
                      <p>
                        {detail.execution.filledShares.toFixed(2)} of{' '}
                        {detail.execution.shares} shares available · average{' '}
                        {pct(detail.execution.averagePrice)} · $
                        {detail.execution.cost.toFixed(2)} before fees.{' '}
                        {!detail.execution.complete
                          ? 'Insufficient depth to fill the full size.'
                          : ''}
                      </p>
                    ) : (
                      <p>
                        Execution estimate unavailable until the book passes
                        freshness and validity checks.
                      </p>
                    )}
                  </section>
                )}
                {detail.history.length > 1 && (
                  <section className="detail-section">
                    <h3>Price history · past week</h3>
                    <svg
                      viewBox="0 0 500 110"
                      role="img"
                      aria-label={`Historical yes price from ${pct(detail.history[0].price)} to ${pct(detail.history.at(-1)!.price)}`}
                      className="history"
                    >
                      <path
                        d={detail.history
                          .map(
                            (p, i) =>
                              `${i ? 'L' : 'M'}${(i / (detail.history.length - 1)) * 500},${100 - p.price * 90}`,
                          )
                          .join(' ')}
                        fill="none"
                        stroke="#217657"
                        strokeWidth="2"
                      />
                    </svg>
                    <div className="chart-labels">
                      <span>
                        {date(
                          new Date(detail.history[0].time * 1000).toISOString(),
                        )}
                      </span>
                      <span>{pct(detail.history.at(-1)!.price)}</span>
                    </div>
                  </section>
                )}
                {detail.comparisons.length > 0 && (
                  <section className="detail-section">
                    <h3>Sportsbook moneylines</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Outcome / book</TableHead>
                          <TableHead>Decimal odds</TableHead>
                          <TableHead>Margin removed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.comparisons.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {c.outcome}
                              <div className="small">
                                {c.venue} · {date(c.sourceUpdatedAt)}
                              </div>
                            </TableCell>
                            <TableCell>{c.decimalOdds.toFixed(2)}</TableCell>
                            <TableCell>{pct(c.fairProbability)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </section>
                )}
                <section className="detail-section">
                  <h3>What is missing?</h3>
                  {detail.warnings.map((w) => (
                    <p key={w} className="warning-line">
                      {w}
                    </p>
                  ))}
                </section>
                {detail.context.map((c, i) => (
                  <section className="detail-section" key={i}>
                    <h3>{c.title}</h3>
                    <p>{c.detail}</p>
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                  </section>
                ))}
                <section className="detail-section">
                  <h3>Resolution rules</h3>
                  <p className="rules">
                    {detail.market.rules ||
                      'The source did not supply resolution rules. Verify them at the venue.'}
                  </p>
                  <a
                    href={detail.market.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read at {detail.market.venue} ↗
                  </a>
                </section>
                <section className="pro-panel">
                  <div className="eyebrow">TICKRR PRO</div>
                  <h3>Understand what the evidence says.</h3>
                  <p>
                    A concise research note based on the prices, rules, and data
                    checked above.
                  </p>
                  {signedIn ? (
                    <Button
                      onClick={() => void analyze()}
                      disabled={analyzing || detailStale}
                    >
                      {analyzing
                        ? 'Reviewing the evidence…'
                        : 'Generate Pro analysis'}
                    </Button>
                  ) : (
                    <a href="/account">Sign in for Pro intelligence →</a>
                  )}
                  {analysis && (
                    <div className="analysis-text">
                      {analysis}
                      <p className="small">
                        AI-generated analysis · OpenAI Luna · Verify the
                        sources.
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}
            {notice && (
              <p role="status" className="alert">
                {notice}
              </p>
            )}
            <div className="detail-actions">
              {signedIn ? (
                <Button variant="outline" onClick={() => void save()}>
                  <Bookmark /> Save market
                </Button>
              ) : (
                <a href="/account">Sign in to save markets →</a>
              )}
              <a href="/account">Manage Pro</a>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
