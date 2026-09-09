import { dodo, persistSubscription } from '@/lib/server/billing';
import {
  database,
  errorResponse,
  ApiError,
  setting,
  boundedText,
} from '@/lib/server/runtime';
export async function POST(request: Request) {
  try {
    const client = dodo();
    const raw = await boundedText(new Response(request.body), 200000);
    let event;
    try {
      event = client.webhooks.unwrap(raw, {
        headers: {
          'webhook-id': request.headers.get('webhook-id') || '',
          'webhook-signature': request.headers.get('webhook-signature') || '',
          'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
        },
      });
    } catch {
      throw new ApiError(
        401,
        'invalid_signature',
        'Invalid webhook signature.',
      );
    }
    if (event.business_id !== setting('DODO_BUSINESS_ID'))
      throw new ApiError(401, 'invalid_business', 'Invalid webhook business.');
    const id = request.headers.get('webhook-id')!;
    if (
      await database()
        .prepare('SELECT id FROM webhook_events WHERE id=?')
        .bind(id)
        .first()
    )
      return Response.json({ received: true });
    if (
      event.type.startsWith('subscription.') &&
      'subscription_id' in event.data &&
      typeof event.data.subscription_id === 'string'
    ) {
      // Retrieve canonical current status; delayed payloads cannot reactivate an expired subscription.
      const observedAt = Date.now();
      const current = await client.subscriptions.retrieve(
        event.data.subscription_id,
      );
      const owned = await persistSubscription(current, observedAt);
      if (!owned)
        throw new ApiError(
          409,
          'unmapped_subscription',
          'Subscription owner has not been linked.',
        );
    }
    await database()
      .prepare(
        'INSERT INTO webhook_events(id,type,received_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING',
      )
      .bind(id, event.type, Date.now())
      .run();
    return Response.json({ received: true });
  } catch (e) {
    return errorResponse(e);
  }
}
