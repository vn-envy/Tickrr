import { getChatGPTUser } from './chatgpt-auth';
import { SiteHeader } from '@/components/site-header';
import MarketWorkspace from '@/components/market-workspace';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <main>
      <SiteHeader signedIn={!!user} />
      <section className="workspace">
        <MarketWorkspace signedIn={!!user} />
        <footer>
          <span>
            Market information, not a promise of returns. For adults 18+.
          </span>
          <a href="/methodology">How Tickrr evaluates markets ↗</a>
        </footer>
      </section>
    </main>
  );
}
