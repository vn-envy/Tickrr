import { SiteHeader } from '@/components/site-header';
export default function Methodology() {
  return (
    <main>
      <SiteHeader />
      <article className="workspace prose-page">
        <div className="eyebrow">METHODOLOGY</div>
        <h1>Know what a number means.</h1>
        <h2>Indicative prices</h2>
        <p>
          The market list displays a venue’s reported probability. This is a
          snapshot, not a guaranteed fill or our prediction. Retrieval time
          shows when Tickrr received the data; it is distinct from the source’s
          quote timestamp.
        </p>
        <h2>Executable prices and depth</h2>
        <p>
          Market details use the order book. Quotes must have a source timestamp
          within two minutes, prices between zero and one, and a non-crossed
          two-sided book. The size estimate walks available sell orders from
          cheapest to most expensive. It excludes fees and cannot guarantee that
          orders will remain available.
        </p>
        <h2>Bookmaker comparison</h2>
        <p>
          Sportsbook moneylines are grouped by fixture, book, market, and line.
          Margin removal requires a complete set of named outcomes from that
          same book. We do not interpret one outcome as a complete market.
          Different settlement rules can still make prices incomparable.
        </p>
        <h2>AI research</h2>
        <p>
          Tickrr Pro uses OpenAI Luna to summarize server-retrieved evidence. It
          does not set fair probabilities or invent an edge. AI can make
          mistakes; check the underlying source and resolution rules. Injury and
          lineup coverage depends on the connected provider and league.
        </p>
        <h2>Coverage and limitations</h2>
        <p>
          Polymarket discovery is paginated and focuses on active binary
          markets. Sportsbook coverage is available only when the licensed
          provider is connected. No global completeness claim is made. Accounts,
          minimum stakes, limits, fees, and local availability vary by venue.
        </p>
        <h2>Use responsibly</h2>
        <p>
          Tickrr is an information service for adults, not a bookmaker. Prices
          and research do not promise returns. Only use betting services
          permitted in your location. If gambling is causing harm, seek local
          professional support.
        </p>
        <a href="/">← Back to markets</a>
      </article>
    </main>
  );
}
