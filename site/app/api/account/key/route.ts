import { proIdentity } from '@/lib/server/identity';
import {
  sameOrigin,
  errorResponse,
  setting,
  ApiError,
  database,
  consumeLimit,
} from '@/lib/server/runtime';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await proIdentity();
    if (setting('FEED_API_ENABLED') !== 'true')
      throw new ApiError(
        403,
        'api_not_enabled',
        'External API access is not enabled.',
      );
    await consumeLimit(`key:${user.userId}`, 3, 3600);
    const key = `tk_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)),
      ),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    await database().batch([
      database()
        .prepare('DELETE FROM api_keys WHERE user_id=?')
        .bind(user.userId),
      database()
        .prepare('INSERT INTO api_keys(hash,user_id,created_at) VALUES(?,?,?)')
        .bind(hash, user.userId, Date.now()),
    ]);
    return Response.json({ key }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
