# Autonomous drafting on a schedule (Google Cloud Scheduler)

The growth loop can run itself: on a cadence it **drafts** posts from Tickrr's live market
signals and **pings you** — you only open the Growth Console and approve. Nothing publishes
without your approval. This is the "only needing me for approvals" loop.

There are two ways to drive the cadence. Both are free.

---

## Option A — In-process cadence (free, zero setup, local/single-instance)

Set in `web/.env`:

```
GROWTH_AUTODRAFT="1"
GROWTH_AUTODRAFT_HOURS="6"
GROWTH_NOTIFY_WEBHOOK="https://discord.com/api/webhooks/…"   # optional founder ping
```

The server drafts every N hours via `setInterval`. Good while the app runs on one always-on
instance. (If the app sleeps/scales to zero, the timer sleeps too — use Option B for that.)

---

## Option B — Google Cloud Scheduler (free tier: 3 jobs/month)

Cloud Scheduler calls a secured HTTP endpoint on a cron schedule. This is the right choice once
the app is deployed to a public URL (e.g. Cloud Run) and may scale to zero between hits.

### 1. Secure the trigger

Set a secret in the app's environment (locally in `web/.env`, or as a Cloud Run env var):

```
GROWTH_CRON_SECRET="<a long random string>"
GROWTH_NOTIFY_WEBHOOK="https://discord.com/api/webhooks/…"   # optional
```

The endpoint (already built) is:

```
POST /api/growth/cron?key=<GROWTH_CRON_SECRET>&count=3
# or send the secret as a header:  x-cron-key: <GROWTH_CRON_SECRET>
```

- Returns `{ "created": 3, "pending": <n> }`.
- Rejects with 401 if the key is wrong, 403 if no secret is configured.
- It **only drafts + notifies** — it never publishes. Approval stays manual.

### 2. Create the scheduled job

```bash
gcloud scheduler jobs create http tickrr-autodraft \
  --location=us-central1 \
  --schedule="0 9,17 * * *" \
  --time-zone="America/New_York" \
  --uri="https://YOUR_APP_URL/api/growth/cron?key=YOUR_SECRET&count=3" \
  --http-method=POST
```

- `--schedule` is standard cron (above = 9am & 5pm ET daily = 2 drafting runs/day).
- Free tier = **3 jobs/month**, so one or two schedules is well within free.
- Prefer not to put the secret in the URL? Pass it as a header instead:
  `--headers="x-cron-key=YOUR_SECRET"`.

### 3. (Optional) Lock it down further

For a private Cloud Run service, have Scheduler authenticate with a service account
(`--oidc-service-account-email=…`) and drop the shared secret. The shared secret is enough for
a public endpoint and keeps this free/simple.

---

## The full autonomous loop

```
Cloud Scheduler (or interval) ─▶ POST /api/growth/cron ─▶ agent drafts from live signals
        └─ pings you on Discord ◀─ notifyFounder ◀─────────────────────┘
you open Growth Console ─▶ Approve ─▶ Discord + Bluesky + Buffer (X / LinkedIn / Instagram)
```

Everything except your approval tap is automated, and every piece runs on a free tier.
