import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ApiError, database, consumeLimit, setting } from './runtime';
export async function identity() {
  const user = await getChatGPTUser();
  if (!user)
    throw new ApiError(401, 'sign_in_required', 'Sign in to continue.');
  return user;
}
export async function entitlement(userId: string) {
  const row = await database()
    .prepare(
      "SELECT id,customer_id,status,valid_until FROM subscriptions WHERE user_id=? AND product_id=? AND status='active' AND valid_until>? ORDER BY valid_until DESC LIMIT 1",
    )
    .bind(userId, setting('DODO_PRO_PRODUCT_ID'), Date.now())
    .first<{
      id: string;
      customer_id: string;
      status: string;
      valid_until: number;
    }>();
  return row;
}
export async function proIdentity() {
  const user = await identity();
  if (!(await entitlement(user.userId)))
    throw new ApiError(
      403,
      'pro_required',
      'Tickrr Pro is required for this analysis.',
    );
  return user;
}
export async function authorizeRead(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth) {
    if (setting('FEED_API_ENABLED') !== 'true')
      throw new ApiError(
        403,
        'api_not_enabled',
        'External API access is not enabled.',
      );
    const token = auth.replace(/^Bearer /, '');
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token),
    );
    const hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    const row = await database()
      .prepare('SELECT user_id FROM api_keys WHERE hash=?')
      .bind(hash)
      .first<{ user_id: string }>();
    if (!row || !(await entitlement(row.user_id)))
      throw new ApiError(
        401,
        'invalid_api_key',
        'API key is invalid or inactive.',
      );
    await consumeLimit(`api:${row.user_id}`, 60, 60);
    return;
  }
  const ip = request.headers.get('cf-connecting-ip') || 'anonymous';
  await consumeLimit(`read:${ip}`, 90, 60);
}
