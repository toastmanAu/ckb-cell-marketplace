// cellswap-api: a minimal Cloudflare Worker backing off-chain derivatives
// for cellswap.xyz. Currently exposes view tracking and batch lookups so
// the marketplace can render a "Most viewed" sort and per-card counts.
//
// Design notes
// ------------
// First-class assets (listings, mints, ownership, payments) stay on chain.
// This worker owns only derived data — counters, aggregates, eventual
// reports. Nothing here is authoritative; losing all of it would not harm
// any user's position. That framing lets us pick simple storage (KV) over
// durable transactional stores.
//
// Endpoints
//   POST /api/view    {outpoint}            → {count}
//   POST /api/counts  {outpoints: string[]} → {counts: Record<string, number>}
//   GET  /api/top?limit=N                   → {top: {outpoint, count}[]}
//
// Outpoint format expected as "0x<txhash>:<index>" to match the frontend.

export interface Env {
  VIEWS: KVNamespace;
}

interface ViewRecord {
  count: number;
  updatedAt: string;
}

const CORS_ORIGINS = new Set([
  'https://cellswap.xyz',
  'https://master.cellswap.pages.dev',
  'https://production.cellswap.pages.dev',
  'http://localhost:5173',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && CORS_ORIGINS.has(origin) ? origin : 'https://cellswap.xyz';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// Validate outpoint format before it hits KV keys. Accepts "0x" + 64 hex
// chars + ":" + decimal index. Rejecting malformed input at the boundary
// keeps the KV namespace clean.
const OUTPOINT_RE = /^0x[0-9a-fA-F]{64}:\d+$/;
const viewKey = (outpoint: string) => `view:${outpoint.toLowerCase()}`;

async function handleView(request: Request, env: Env, origin: string | null): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { outpoint?: unknown } | null;
  const outpoint = typeof body?.outpoint === 'string' ? body.outpoint : null;
  if (!outpoint || !OUTPOINT_RE.test(outpoint)) {
    return jsonResponse({ error: 'invalid outpoint' }, 400, origin);
  }

  const key = viewKey(outpoint);
  const existing = (await env.VIEWS.get<ViewRecord>(key, 'json')) ?? { count: 0, updatedAt: '' };
  const next: ViewRecord = {
    count: existing.count + 1,
    updatedAt: new Date().toISOString(),
  };
  await env.VIEWS.put(key, JSON.stringify(next));

  return jsonResponse({ count: next.count }, 200, origin);
}

async function handleCounts(request: Request, env: Env, origin: string | null): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { outpoints?: unknown } | null;
  const outpoints = Array.isArray(body?.outpoints) ? body!.outpoints : null;
  if (!outpoints) {
    return jsonResponse({ error: 'outpoints array required' }, 400, origin);
  }

  // Bound request size — 200 is enough for a typical Browse page render
  // and prevents someone firing a 10k-outpoint probe to blow through free
  // tier KV read quota.
  if (outpoints.length > 200) {
    return jsonResponse({ error: 'at most 200 outpoints per request' }, 400, origin);
  }

  const valid = outpoints.filter((o): o is string => typeof o === 'string' && OUTPOINT_RE.test(o));
  const results = await Promise.all(
    valid.map(async (op) => {
      const rec = await env.VIEWS.get<ViewRecord>(viewKey(op), 'json');
      return [op, rec?.count ?? 0] as const;
    }),
  );

  return jsonResponse({ counts: Object.fromEntries(results) }, 200, origin);
}

async function handleTop(url: URL, env: Env, origin: string | null): Promise<Response> {
  const limitRaw = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitRaw ?? '20', 10) || 20, 1), 100);

  // KV list is limited to 1000 keys per call. For cellswap-scale
  // cardinality (hundreds of listings) this is fine. When we cross into
  // thousands, move to a separate "leaderboard" key updated on each view.
  const list = await env.VIEWS.list({ prefix: 'view:', limit: 1000 });
  const records = await Promise.all(
    list.keys.map(async (k) => {
      const rec = await env.VIEWS.get<ViewRecord>(k.name, 'json');
      return {
        outpoint: k.name.slice('view:'.length),
        count: rec?.count ?? 0,
      };
    }),
  );
  records.sort((a, b) => b.count - a.count);

  return jsonResponse({ top: records.slice(0, limit) }, 200, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/view' && request.method === 'POST') {
      return handleView(request, env, origin);
    }
    if (url.pathname === '/api/counts' && request.method === 'POST') {
      return handleCounts(request, env, origin);
    }
    if (url.pathname === '/api/top' && request.method === 'GET') {
      return handleTop(url, env, origin);
    }
    if (url.pathname === '/' || url.pathname === '/api') {
      return jsonResponse({ name: 'cellswap-api', endpoints: ['/api/view', '/api/counts', '/api/top'] }, 200, origin);
    }

    return jsonResponse({ error: 'not found' }, 404, origin);
  },
} satisfies ExportedHandler<Env>;
