# Supabase Edge Functions Setup

This directory contains Supabase Edge Functions for PassGen activation and mobile production APIs.

## Setup

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link to your mobile project:
```bash
supabase link --project-ref msapggfdkgugctycrbqi
```

## Deploy Edge Functions

To deploy the activation-request function:

```bash
supabase functions deploy activation-request
supabase functions deploy mobile-api-keys-create
supabase functions deploy mobile-api-keys-list
supabase functions deploy mobile-api-keys-revoke
supabase functions deploy mobile-api-keys-verify
supabase functions deploy revenuecat-webhook
```

## Environment Variables

Make sure these environment variables are set in your Supabase project:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (required for server-side writes)
- `REVENUECAT_WEBHOOK_SECRET`: Optional webhook secret for RevenueCat signature validation
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for notifications

You can set them using:

```bash
supabase secrets set SUPABASE_URL="https://msapggfdkgugctycrbqi.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set REVENUECAT_WEBHOOK_SECRET="your-revenuecat-webhook-secret"
supabase secrets set DISCORD_WEBHOOK_URL="your-webhook-url"
```

## Developer API Keys

- Maximum active API keys per user: **3**
- API key prefix format: `pg_live_...`
- API key headers supported:
  - `Authorization: Bearer pg_live_...`
  - `x-passgen-api-key: pg_live_...`
- API keys require an active `pro` or `cloud` plan in `mobile_subscription_state`.

### Verify API key endpoint

`POST /functions/v1/mobile-api-keys-verify`

Successful response:

```json
{
  "ok": true,
  "user_id": "uuid",
  "key_id": "uuid",
  "key_prefix": "pg_live_xxxxxxxx",
  "plan": "pro",
  "label": "Vercel v0"
}
```

### Quick usage examples

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/mobile-api-keys-verify \
  -H "Authorization: Bearer pg_live_XXXX" \
  -H "Content-Type: application/json"
```

```ts
const response = await fetch(`${PASSGEN_API_BASE}/mobile-api-keys-verify`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.PASSGEN_API_KEY}`
  }
});
const verification = await response.json();
```

## Testing Locally

To test the Edge Function locally:

```bash
supabase start
supabase functions serve activation-request
```

Then test with:
```bash
curl -X POST http://localhost:54321/functions/v1/activation-request \
  -H "Content-Type: application/json" \
  -d '{"install_id":"test-123","user_email":"test@example.com"}'
```
