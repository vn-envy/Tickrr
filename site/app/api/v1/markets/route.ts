import { marketFeed } from '@/lib/server/markets';
import { authorizeRead } from '@/lib/server/identity';
import { ApiError, errorResponse } from '@/lib/server/runtime';
export async function GET(request: Request) {
  try {
    await authorizeRead(request);
    const url = new URL(request.url);
    const cursor = Number(url.searchParams.get('cursor') || 0);
    if (
      !Number.isInteger(cursor) ||
      cursor < 0 ||
      cursor > 1000 ||
      cursor % 100 !== 0
    )
      throw new ApiError(400, 'invalid_cursor', 'Invalid page cursor.');
    const feed = await marketFeed(cursor);
    return Response.json(feed, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
