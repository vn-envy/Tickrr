# SEO & AEO

Tickrr's terminal is a client-rendered SPA (uncrawlable on its own), so the marketing/content
surface is **server-rendered as real HTML** by the Express server (`web/server.ts`), with
structured data so it's eligible for rich results and citable by answer engines (Google AI
Overviews, Perplexity, ChatGPT, Gemini).

## Pages & files (all server-rendered)

| Route | What | Structured data |
|-------|------|-----------------|
| `/faq` | FAQ (intel-only positioning, divergences, fair value, data) | `Organization`, `FAQPage` |
| `/compliance` | Compliance & responsible-use notice | `Organization` |
| `/blog` | Journal index (seed + AI-generated) | `Organization`, `Blog` |
| `/blog/:slug` | A post | `Organization`, `BlogPosting`, `FAQPage` (per-post) |
| `/robots.txt` | Allow all + sitemap pointer | — |
| `/sitemap.xml` | All pages + every post (dynamic) | — |
| `/llms.txt` | Answer-engine guide to the site | — |

Content lives in `web/content.ts` (site meta, FAQs, compliance, seed posts); rendering + schema +
crawl files in `web/seo.ts`; generated posts persist via `web/blogStore.ts` (Firestore on Cloud
Run, file locally — same pattern as the growth store).

## Automating SEO/AEO — the AI SEO editor

`generateBlogPost()` drafts a fresh, **answer-first** post from **live market data** (top
cross-venue divergences + upcoming catalysts), via Gemini with an intel-only system instruction and
a structured-output schema (title / description / body / tags / FAQs). Every draft passes an
**intel-only compliance gate** (blocks betting/advice language) before it's persisted. Without a
Gemini key it falls back to a templated post from the same live data, so the loop is demoable free.

Each generated post automatically gets `BlogPosting` + `FAQPage` schema and is added to
`/sitemap.xml` and `/llms.txt` — so new content is discoverable the moment it's created.

### Trigger it

```bash
# Manual (local or prod)
curl -X POST http://localhost:3000/api/seo/generate

# Secret-guarded cron (for Cloud Scheduler); set SEO_CRON_SECRET (falls back to GROWTH_CRON_SECRET)
curl -X POST "https://<web-host>/api/seo/cron" -H "x-cron-key: $SEO_CRON_SECRET"
```

### Schedule it (Cloud Scheduler — free tier, 3 jobs)

```bash
gcloud scheduler jobs create http tickrr-seo \
  --schedule="0 14 * * *" --time-zone="Etc/UTC" \
  --uri="https://<web-host>/api/seo/cron" --http-method=POST \
  --headers="x-cron-key=$SEO_CRON_SECRET" \
  --location=us-central1
```

## Environment

| Var | Meaning |
|-----|---------|
| `APP_URL` | Public origin — used for canonical URLs, sitemap, `og:url`, `llms.txt`. **Set this in prod.** |
| `GEMINI_API_KEY` | Enables the AI SEO editor (falls back to a templated post if unset). |
| `SEO_CRON_SECRET` | Guards `/api/seo/cron` (falls back to `GROWTH_CRON_SECRET`). |
| `BLOG_COLLECTION` | Firestore collection for generated posts (default `blog_posts`). |

## Checklist when the domain goes live

- Set `APP_URL=https://<your-domain>` on the web service (canonicals + sitemap must be absolute).
- Fill `SITE.sameAs` in `web/content.ts` with real social URLs (feeds `Organization.sameAs`).
- Submit `/sitemap.xml` in Google Search Console; confirm `/robots.txt` and `/llms.txt` resolve.
- Validate a blog post + `/faq` in Google's Rich Results Test (FAQPage / BlogPosting).
