import { identity, entitlement } from '@/lib/server/identity';
import { dodo } from '@/lib/server/billing';
import {
  sameOrigin,
  errorResponse,
  setting,
  database,
  consumeLimit,
  ApiError,
} from '@/lib/server/runtime';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    await consumeLimit(`checkout:${user.userId}`, 3, 600);
    if (await entitlement(user.userId))
      throw new ApiError(
        409,
        'already_subscribed',
        'You already have Tickrr Pro. Manage your subscription from your account.',
      );
    if (!setting('OPENAI_API_KEY'))
      throw new ApiError(
        503,
        'intelligence_unavailable',
        'Pro intelligence is not available yet.',
      );
    const client = dodo(),
      id = crypto.randomUUID();
    await database()
      .prepare(
        'INSERT INTO checkout_owners(id,user_id,email,created_at) VALUES(?,?,?,?)',
      )
      .bind(id, user.userId, user.email, Date.now())
      .run();
    const session = await client.checkoutSessions.create({
      product_cart: [
        { product_id: setting('DODO_PRO_PRODUCT_ID'), quantity: 1 },
      ],
      customer: { email: user.email, name: user.displayName },
      metadata: { tickrr_checkout: id },
      return_url: `${setting('APP_ORIGIN')}/account?checkout=returned`,
    });
    if (!session.checkout_url) throw new Error('Missing checkout URL');
    return Response.json(
      { url: session.checkout_url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
