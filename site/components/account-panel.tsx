'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
type Account = {
  email: string;
  pro: boolean;
  validUntil: number | null;
  billingAvailable: boolean;
  billingMode: string;
  intelligenceAvailable: boolean;
  externalApiAvailable: boolean;
};
type Watch = { market_id: string; title: string };
export default function AccountPanel() {
  const [account, setAccount] = useState<Account | null>(null),
    [watches, setWatches] = useState<Watch[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState('');
  async function load() {
    try {
      const [a, w] = await Promise.all([
        fetch('/api/account'),
        fetch('/api/watchlist'),
      ]);
      const ad = (await a.json()) as Account & { error?: { message: string } },
        wd = (await w.json()) as { items: Watch[] };
      if (!a.ok) throw new Error(ad.error?.message);
      setAccount(ad);
      if (w.ok) setWatches(wd.items);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    if (new URLSearchParams(location.search).has('checkout'))
      setMessage(
        'Checking your subscription. Access appears after Dodo confirms it.',
      );
    const id = setInterval(() => void load(), 15000);
    return () => clearInterval(id);
  }, []);
  async function action(path: string) {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }),
        d = (await r.json()) as {
          url?: string;
          key?: string;
          error?: { message: string };
        };
      if (!r.ok) throw new Error(d.error?.message);
      if (d.url) location.assign(d.url);
      if (d.key) setKey(d.key);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(marketId: string) {
    try {
      const r = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId }),
      });
      if (!r.ok) throw new Error('Could not remove this market.');
      setWatches((w) => w.filter((x) => x.market_id !== marketId));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <div className="account-grid">
        <section className="panel account-card">
          <div className="eyebrow">YOUR MEMBERSHIP</div>
          <h2>{account?.pro ? 'Tickrr Pro' : 'Tickrr Free'}</h2>
          <p>{account?.email}</p>
          <p>
            Pro adds evidence-based analysis with OpenAI Luna. Up to 20 research
            notes per day.
          </p>
          {account?.pro && (
            <p>
              Access through{' '}
              {new Date(account.validUntil!).toLocaleDateString()}.
            </p>
          )}
          {account?.billingMode === 'test_mode' && (
            <p className="alert">
              Test checkout · no live subscription purchase.
            </p>
          )}
          {account?.pro ? (
            <Button
              onClick={() => void action('/api/billing/portal')}
              disabled={busy}
            >
              Manage subscription
            </Button>
          ) : (
            <Button
              onClick={() => void action('/api/billing/checkout')}
              disabled={
                busy ||
                !account?.billingAvailable ||
                !account?.intelligenceAvailable
              }
            >
              {busy ? 'Opening checkout…' : 'View Pro subscription'}
            </Button>
          )}
          {account && !account.billingAvailable && (
            <p className="small">Pro subscriptions are not open yet.</p>
          )}
          {account && !account.intelligenceAvailable && (
            <p className="small">Pro intelligence is not available yet.</p>
          )}
          <p className="small">
            The price, currency, renewal period, taxes, and cancellation terms
            are shown at checkout before purchase.
          </p>
          <Button
            variant="link"
            onClick={() => void action('/api/billing/portal')}
            disabled={busy}
          >
            Billing history and cancellation
          </Button>
        </section>
        <section className="panel account-card">
          <div className="eyebrow">MY WATCHLIST</div>
          <h2>Your saved markets</h2>
          {!watches.length ? (
            <p>Open a market and choose Save market to keep it here.</p>
          ) : (
            watches.map((w) => (
              <div className="watch-row" key={w.market_id}>
                <a href={`/?market=${encodeURIComponent(w.market_id)}`}>
                  {w.title}
                </a>
                <Button
                  variant="ghost"
                  onClick={() => void remove(w.market_id)}
                  aria-label={`Remove ${w.title}`}
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </section>
      </div>
      {account?.pro && account.externalApiAvailable && (
        <section className="panel account-card">
          <h2>Developer API</h2>
          <p>Generate a new API key. This replaces your previous key.</p>
          <Button
            onClick={() => void action('/api/account/key')}
            disabled={busy}
          >
            Generate API key
          </Button>
          {key && (
            <p className="api-key">
              <code>{key}</code>
              <br />
              Copy this key now. It will not be displayed again.
            </p>
          )}
        </section>
      )}
      {message && (
        <p className="alert" role="status">
          {message}
        </p>
      )}
      <p>
        <a href="/signout-with-chatgpt?return_to=%2F">Sign out</a>
      </p>
    </>
  );
}
