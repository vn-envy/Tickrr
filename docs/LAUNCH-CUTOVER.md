# Tickrr cutover — 9 September 2026

## Implemented and verified

- Sites/Cloudflare Worker application privately published at https://tickrr.neekhil007.chatgpt.site.
- React 19.2.8, Vite 8.2.2, patched Vinext and Cloudflare tooling; dependency audit reports zero known vulnerabilities.
- D1 schema, signed-in watchlists, hashed API keys, server-side quotas and Pro entitlements.
- Polymarket active markets, precise Yes-token lookup, direct depth, historical prices, and resolution text.
- Optional OpticOdds pregame fixtures, moneylines, matching-team injuries, lineups; no coverage represented without credentials.
- OpenAI Responses pinned to gpt-5.6-luna; server-retrieved evidence and no mock analysis fallback.
- Dodo checkout, customer portal and signature-verified, deduplicated subscription webhooks. Checkout return URLs never grant access. Canonical subscription retrieval limits out-of-order event risk.
- 10 tests pass: price bounds, crossed/stale/future books, depth/slippage, incomplete outcome sets, isolated bookmaker groups, authentic/tampered/replayed webhook signatures. Type check and production build pass.

## Required before public cutover

1. Configure and verify OPENAI_API_KEY securely. Run representative actual Luna responses; evaluate factual grounding and missing-evidence behavior. No live model request has been tested.
2. Configure live DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_KEY, DODO_PRO_PRODUCT_ID, and DODO_BUSINESS_ID. Confirm the account accepts this information-service product and the intended price/renewal/currency. Subscribe the public webhook to subscription lifecycle events and test activation, renewal, failure, cancellation, duplicate delivery and customer portal. No live transaction was executed.
3. Configure OPTICODDS_API_KEY and validate contracted league/book coverage plus schemas against actual responses. Confirm display and external API redistribution rights separately; FEED_API_ENABLED remains false.
4. Verify Polymarket reachability from the hosted origin. This local machine currently fails TLS to gamma-api.polymarket.com; the UI honestly shows unavailable data. No workaround bypasses source restrictions.
5. Export existing Firestore users/watchlists/billing and establish verified identity linking from Firebase to Sites sign-in. Do not attach paid accounts by an unverified email match. Import and reconcile counts before the old app is retired. The replacement starts with an empty account database.
6. Confirm public access and anonymous market browsing, signed-in private routes and Dodo webhook reachability. The current Site is intentionally owner-private.
7. Apply domain verification, then route tickrr.tech only when the above checks pass. Update APP_ORIGIN to https://tickrr.tech and publish that environment revision. Preserve unrelated DNS/MX/TXT records. Confirm HTTPS certificate, sign-in, checkout return, webhook, market data and watchlists at the custom domain.
8. Observe the replacement and retain a reversible Cloud Run rollback. Then retire the old Cloud Run web/API services and obsolete schedulers, after backup retention is agreed. Removing workflows/source from this branch does not shut down existing Cloud resources.

## DNS records returned by Sites

Domain attachment is pending. Authoritative nameservers observed: solar.dns-parking.com and lunar.dns-parking.com.

Add the validation records first:

| Type | Name | Value |
|---|---|---|
| TXT | _openai-site-verification.tickrr.tech | openai-site-verification=ZzXzv2WNliWKxEMueaHptd1gGLADSmyHGT_P2STC7HM |
| TXT | _cf-custom-hostname.tickrr.tech | e8243066-07f6-4ce5-a086-69ed5d8d2dcb |

After cutover gates pass, replace only apex web routing records with the returned A targets: `162.159.143.30` and `172.66.3.26`. Inspect existing AAAA/CNAME conflicts, TTL, and rollback values first. Sites returned `custom-domains.chatgpt.site.` as its subdomain CNAME target, but tickrr.tech is an apex; use the returned apex targets.

## Research-to-implementation mapping

Stale prices → source/retrieval timestamps, expiry, polling and stale warnings.
Unfillable “edges” → sorted order-book walk, depth at size, pre-fee disclaimer and no false arbitrage label.
Poor normalization → active lifecycle filtering, exact token identity, complete named bookmaker outcome sets, no approximate cross-venue join.
Expensive opaque AI → bounded Luna request, server-entitlement checks, per-user/global daily limits and explicit unavailable states.
Fragmented research → market list with one evidence drawer for rules, history, depth, contextual data and Pro notes.
API inconsistency → versioned envelope, null missing fields, structured errors, pagination, source status and shared UI/MCP contract.

Further work: licensed normalized event registry, fee schedules and settlement equivalence, durable streaming ingestion, CLV/closing snapshots, historical signal evaluation, wider sport/region coverage, verified account-data import, and operational alerting. These have not been represented as completed.
