import { marketDetail } from '@/lib/server/markets';
import { authorizeRead } from '@/lib/server/identity';
import { ApiError, errorResponse } from '@/lib/server/runtime';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await authorizeRead(request);
    const { id } = await params;
    if (id.length > 160)
      throw new ApiError(400, 'invalid_market', 'Invalid market.');
    const shares = Number(
      new URL(request.url).searchParams.get('shares') || 100,
    );
    if (!Number.isFinite(shares) || shares < 1 || shares > 100000)
      throw new ApiError(
        400,
        'invalid_size',
        'Choose between 1 and 100,000 shares.',
      );
    return Response.json(await marketDetail(id, shares), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
