import { identity } from '@/lib/server/identity';
import { getMarket } from '@/lib/server/markets';
import {
  database,
  sameOrigin,
  body,
  errorResponse,
  ApiError,
  consumeLimit,
} from '@/lib/server/runtime';
import { object } from '@/lib/data/quality';
export async function GET() {
  try {
    const user = await identity();
    const rows = await database()
      .prepare(
        'SELECT market_id,title,created_at FROM watches WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
      )
      .bind(user.userId)
      .all();
    return Response.json(
      { items: rows.results },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    await consumeLimit(`watch:${user.userId}`, 30, 60);
    const data = object(await body(request));
    if (typeof data.marketId !== 'string' || data.marketId.length > 160)
      throw new ApiError(400, 'invalid_market', 'Choose a market.');
    const market = await getMarket(data.marketId);
    await database()
      .prepare(
        'INSERT INTO watches(user_id,market_id,title,created_at) SELECT ?,?,?,? WHERE (SELECT count(*) FROM watches WHERE user_id=?)<100 ON CONFLICT(user_id,market_id) DO NOTHING',
      )
      .bind(user.userId, market.id, market.title, Date.now(), user.userId)
      .run();
    return Response.json({ saved: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const user = await identity();
    const data = object(await body(request));
    await database()
      .prepare('DELETE FROM watches WHERE user_id=? AND market_id=?')
      .bind(user.userId, String(data.marketId || ''))
      .run();
    return Response.json({ removed: true });
  } catch (e) {
    return errorResponse(e);
  }
}
