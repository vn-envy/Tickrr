import { identity, entitlement } from '@/lib/server/identity';
import { billingReady } from '@/lib/server/billing';
import { errorResponse, setting } from '@/lib/server/runtime';
export async function GET() {
  try {
    const user = await identity();
    const subscription = await entitlement(user.userId);
    return Response.json(
      {
        email: user.email,
        pro: !!subscription,
        validUntil: subscription?.valid_until || null,
        billingAvailable: billingReady(),
        billingMode: setting('DODO_PAYMENTS_ENVIRONMENT'),
        intelligenceAvailable: !!setting('OPENAI_API_KEY'),
        externalApiAvailable: setting('FEED_API_ENABLED') === 'true',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
