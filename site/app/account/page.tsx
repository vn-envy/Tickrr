import { getChatGPTUser, chatGPTSignInPath } from '../chatgpt-auth';
import { SiteHeader } from '@/components/site-header';
import AccountPanel from '@/components/account-panel';
export const dynamic = 'force-dynamic';
export default async function Account() {
  const user = await getChatGPTUser();
  return (
    <main>
      <SiteHeader signedIn={!!user} />
      <section className="workspace">
        <div className="eyebrow">YOUR TICKRR</div>
        <h1 className="mt-4 mb-8">Keep your research together.</h1>
        {user ? (
          <AccountPanel />
        ) : (
          <section className="panel account-card">
            <h2>Sign in to save markets and use Pro.</h2>
            <p>Your watchlist and subscription follow your account.</p>
            <a
              className="sign-in"
              href={chatGPTSignInPath('/account')}
              target="_top"
            >
              Sign in with ChatGPT →
            </a>
          </section>
        )}
      </section>
    </main>
  );
}
