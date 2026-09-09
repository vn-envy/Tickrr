export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header>
      <a className="brand" href="/" aria-label="Tickrr home">
        tickrr<span>●</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="/">Markets</a>
        <a href="/account">My watchlist</a>
        <a href="/api-docs">API</a>
      </nav>
      <a className="account" href="/account">
        {signedIn ? 'My account' : 'Sign in'}
      </a>
    </header>
  );
}
