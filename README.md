# Tickrr

Evidence-led betting and prediction-market intelligence, built for Sites on Cloudflare Workers.

The replacement application lives in [`site/`](site/README.md). It uses React 19, Vite 8, Vinext, D1, Sites sign-in, OpenAI Luna via Responses, and verified Dodo subscriptions. The old Cloud Run/Firebase/Gemini/Razorpay application is removed from this branch; its previous release remains in Git history at `52a3fddf12c293cae5d3eb07ae7251bb286ab8b5` for rollback.

Private hosted review: https://tickrr.neekhil007.chatgpt.site

The existing live tickrr.tech deployment has **not** been cut over. See [`docs/LAUNCH-CUTOVER.md`](docs/LAUNCH-CUTOVER.md) for the remaining external configuration and migration checks. Do not remove production services or data before those gates pass.

## Develop

```sh
cd site
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npm run dev
```

## Validate

```sh
cd site
npm run test
npm run typecheck
npm run build
```

## API / MCP

The application exposes `/api/v1/markets` and `/api/v1/markets/:id`. The optional local MCP client in `mcp/` consumes the same contract. External feed access is gated until provider redistribution rights are confirmed. There are no fabricated fair values, automatic cross-venue matches, or guaranteed-return claims.
