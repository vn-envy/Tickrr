import { env } from 'cloudflare:workers';
export function database() {
  if (!env.DB) throw new Error('Database unavailable');
  return env.DB;
}
export function setting(name: string): string {
  return String(Reflect.get(env, name) || '');
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function boundedText(
  response: Response,
  maxBytes = 2_000_000,
): Promise<string> {
  if (!response.ok)
    throw new ApiError(
      502,
      'source_unavailable',
      'A data source is temporarily unavailable.',
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(all);
}
export async function boundedJson(
  response: Response,
  maxBytes = 2_000_000,
): Promise<unknown> {
  return JSON.parse(await boundedText(response, maxBytes));
}
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  maxBytes = 2_000_000,
) {
  return boundedJson(
    await fetch(url, { ...init, signal: AbortSignal.timeout(10000) }),
    maxBytes,
  );
}
export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  console.error(
    JSON.stringify({
      event: 'api_error',
      type: error instanceof Error ? error.name : 'Unknown',
    }),
  );
  return Response.json(
    {
      error: {
        code: 'temporarily_unavailable',
        message: 'This service is temporarily unavailable. Please try again.',
      },
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function body(request: Request) {
  const n = Number(request.headers.get('content-length') || 0);
  if (n > 20000) throw new ApiError(413, 'too_large', 'Request is too large.');
  return boundedJson(new Response(request.body), 20000);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError(403, 'invalid_origin', 'Please retry from Tickrr.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError(415, 'invalid_content_type', 'Use application/json.');
}
export async function consumeLimit(
  key: string,
  limit: number,
  seconds: number,
) {
  const bucket = Math.floor(Date.now() / 1000 / seconds);
  await database()
    .prepare('DELETE FROM usage WHERE expires_at < ?')
    .bind(Math.floor(Date.now() / 1000))
    .run();
  const row = await database()
    .prepare(
      'INSERT INTO usage (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count',
    )
    .bind(`${key}:${bucket}`, (bucket + 2) * seconds, limit)
    .first();
  if (!row)
    throw new ApiError(
      429,
      'rate_limit',
      'Request limit reached. Please try again later.',
    );
}
