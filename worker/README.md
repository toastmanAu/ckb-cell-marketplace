# cellswap-api (Cloudflare Worker)

Off-chain derivatives backend for cellswap.xyz. Currently exposes view
tracking and batch lookups; eventual home for report submission and any
other non-authoritative aggregates.

## Endpoints

- `POST /api/view` — body `{outpoint}` — increment view count for an outpoint
- `POST /api/counts` — body `{outpoints: string[]}` (max 200) — batch lookup
- `GET  /api/top?limit=N` — top-N outpoints by view count (max N=100)

Outpoint format: `0x<64 hex>:<decimal index>`.

## First-time deploy

Requires a Cloudflare API token with at minimum:
- **Workers Scripts: Edit**
- **Workers KV Storage: Edit**
- **Account: Read**

(The token used for Pages deploys earlier in the project had only
Pages:Edit + Account:Read. Extend it, or create a new token with Pages
and Workers scopes together.)

```bash
cd worker
export CLOUDFLARE_API_TOKEN="<token>"

# Create the KV namespace and note the id it prints:
npx wrangler kv namespace create VIEWS
# → Add the printed id into wrangler.toml under [[kv_namespaces]].id

# (optional) create a preview namespace for wrangler dev:
# npx wrangler kv namespace create VIEWS --preview

# Deploy:
npm install
npm run deploy
# → prints the worker URL, e.g. https://cellswap-api.<account>.workers.dev
```

## Wire the frontend at the deployed URL

The frontend reads `VITE_API_BASE` from build-time env, falling back to
`https://cellswap-api.toastmanau.workers.dev` if unset. To override on a
per-deploy basis:

```bash
# In the frontend dir:
VITE_API_BASE=https://cellswap-api.<your-account>.workers.dev npm run build
```

Or set it as a persistent env var in the Cloudflare Pages project
settings so every Pages deploy picks up the correct worker origin
automatically.

## CORS

The worker allows requests from:
- `https://cellswap.xyz`
- `https://master.cellswap.pages.dev`
- `https://production.cellswap.pages.dev`
- `http://localhost:5173`

Add more origins in `src/index.ts` → `CORS_ORIGINS` if you stand up
additional preview environments.

## Abuse + quotas

- Per-request outpoint cap: 200 (on `/api/counts`)
- No rate limiting yet. If view-count spam becomes a problem, gate
  `/api/view` behind a per-IP cooldown using the request's
  `cf-connecting-ip` header.
- KV free tier: 100k reads/day, 1k writes/day. For cellswap-scale
  traffic that's plenty; upgrade or add caching if it's not.

## Development

```bash
cd worker
npm install
npm run dev
# → http://localhost:8787
```

`wrangler dev` honours the KV namespace bindings with a local-only
store, so you can iterate without touching production data.
