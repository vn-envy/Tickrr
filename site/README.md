# Tickrr on Sites / Cloudflare

The active replacement application is a React 19 / Vinext / Vite 8 Cloudflare Worker. It uses Sites authentication, D1, OpenAI Responses (`gpt-5.6-luna`), and Dodo subscriptions. No Google/Firebase/Gemini/Razorpay dependency is used by this application.

## Local development

Node 22.13+ (Node 24 LTS recommended), `npm ci`, `npm run db:generate` only when changing schema, then `npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc` and `npm run dev`. The local configuration's database ID is an explicit simulator placeholder. Sites owns the production binding. Never deploy the local Wrangler config directly.

`npm run test`, `npm run typecheck`, `npm run build` validate the application. Generated D1 migrations are schema-only and must be preserved once published. Production output is packaged using the Sites helper.

## Live services

Set the keys listed in `.env.example` through Sites environment controls. OpenAI and Dodo keys never go to the browser. Do not accept subscriptions before both services have passed live account validation. Dodo product price/currency/recurrence come from the merchant's product, not client input.

Dodo endpoint: `/api/billing/webhook`. Subscribe to all subscription lifecycle events. Signature verification uses the official SDK over bounded raw bytes. Events are deduplicated, and subscription state is retrieved from Dodo before being persisted; the checkout-owner nonce prevents client-selected ownership. A checkout return URL does not grant Pro. Unknown owners return a retryable error for operational reconciliation. Existing subscribers require an audited migration mapping; do not silently bind by unverified email.

## Data

Polymarket: active binary-market discovery, exact Yes-token mapping, direct book depth, price history, and resolution text. OpticOdds: configurable pregame fixtures, moneyline prices, matching-team injury reports, and available lineups. No external source is represented as connected without configuration. Bookmaker margin removal requires complete named outcomes from one book. Cross-venue automatic event matching and executable arbitrage are intentionally not claimed.

Quotes have independent retrieval and source timestamps. Invalid/stale books cannot produce an execution estimate. Fees are explicitly excluded. External API access is disabled until the provider agreements authorize redistribution. API credentials are hashed and server-rate-limited.

## Cutover

1. Publish and validate the Sites origin, including identity, live data, signed Dodo event replay, and an actual Luna request.
2. Export existing Firestore users/watchlists and subscription records. Establish verified account linking before import; retain backups.
3. Attach tickrr.tech via Sites, apply the returned ownership/TLS validation records, then change the apex routing records only after health checks pass. Preserve all unrelated mail and verification records.
4. Verify HTTPS and the complete account/payment flow on tickrr.tech. Keep the previous Cloud Run release available for rollback during observation.
5. Disable legacy deployment automation. Retire Cloud Run services/schedulers only after data migration and rollback checks; do not delete Firestore data or secrets prematurely.

Known validation limits: no live Dodo, OpenAI, or OpticOdds credentials were supplied during implementation; WebMCP's optional market filter is not runtime-verified without a supported browser context. The old application's user migration is an explicit cutover prerequisite.
