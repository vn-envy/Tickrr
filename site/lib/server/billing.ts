import DodoPayments from 'dodopayments';
import type { Subscription } from 'dodopayments/resources/subscriptions';
import { setting, ApiError, database } from './runtime';
export function billingReady() {
  return !!(
    setting('DODO_PAYMENTS_API_KEY') &&
    setting('DODO_PAYMENTS_WEBHOOK_KEY') &&
    setting('DODO_PRO_PRODUCT_ID') &&
    setting('DODO_BUSINESS_ID') &&
    setting('APP_ORIGIN')
  );
}
export function dodo() {
  if (!billingReady())
    throw new ApiError(
      503,
      'billing_unavailable',
      'Subscriptions are not available yet. Please check back soon.',
    );
  const environment = setting('DODO_PAYMENTS_ENVIRONMENT');
  if (environment !== 'live_mode' && environment !== 'test_mode')
    throw new ApiError(
      503,
      'billing_unavailable',
      'Subscriptions are not available yet.',
    );
  return new DodoPayments({
    bearerToken: setting('DODO_PAYMENTS_API_KEY'),
    webhookKey: setting('DODO_PAYMENTS_WEBHOOK_KEY'),
    environment,
    timeout: 10000,
    maxRetries: 1,
  });
}
export async function persistSubscription(
  subscription: Subscription,
  observedAt: number,
) {
  const owner = await database()
    .prepare('SELECT user_id FROM checkout_owners WHERE id=?')
    .bind(String(subscription.metadata.tickrr_checkout || ''))
    .first<{ user_id: string }>();
  if (!owner) return false;
  if (subscription.product_id !== setting('DODO_PRO_PRODUCT_ID')) return false;
  const expiry = Date.parse(subscription.next_billing_date);
  if (!Number.isFinite(expiry)) throw new Error('Invalid subscription expiry');
  await database()
    .prepare(
      'INSERT INTO subscriptions(id,user_id,customer_id,product_id,status,valid_until,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,valid_until=excluded.valid_until,updated_at=excluded.updated_at WHERE excluded.updated_at>=subscriptions.updated_at AND subscriptions.user_id=excluded.user_id AND subscriptions.product_id=excluded.product_id',
    )
    .bind(
      subscription.subscription_id,
      owner.user_id,
      subscription.customer.customer_id,
      subscription.product_id,
      subscription.status,
      expiry,
      observedAt,
    )
    .run();
  return true;
}
