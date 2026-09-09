import { identity } from '@/lib/server/identity';
import { dodo } from '@/lib/server/billing';
import {
  sameOrigin,
  errorResponse,
  database,
  ApiError,
  consumeLimit,
} from '@/lib/server/runtime';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    await consumeLimit(`portal:${user.userId}`, 10, 600);
    const subscription = await database()
      .prepare(
        'SELECT customer_id FROM subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1',
      )
      .bind(user.userId)
      .first<{ customer_id: string }>();
    if (!subscription)
      throw new ApiError(404, 'no_subscription', 'No subscription found.');
    const portal = await dodo().customers.customerPortal.create(
      subscription.customer_id,
    );
    return Response.json(
      { url: portal.link },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
