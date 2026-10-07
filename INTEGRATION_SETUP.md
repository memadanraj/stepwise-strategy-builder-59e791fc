# Reelforge — Integration Setup

The repository contains the Phase 06–15 application implementation. External providers still require their own credentials, service configuration, and Paddle product/price IDs.

## 1. Apply database migrations

Apply migrations in order. The billing provider migration is:

- `drizzle/migrations/0010_billing.sql` — original billing tables and seeded credit packs
- `drizzle/migrations/0013_paddle_billing.sql` — renames active Stripe billing tables to Paddle names and adds Paddle price IDs

Do not edit an already-applied migration in place. The Paddle migration is intentionally additive/rename-based so existing billing data is preserved when moving the schema forward.

## 2. AI visuals and clips

Set `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, and `OPENAI_IMAGE_MODEL` for AI text/images, plus the provider keys required by audio, rendering, and YouTube. Video generation is provider-neutral through `VIDEO_GENERATION_API_URL`, `VIDEO_GENERATION_API_KEY`, and `VIDEO_GENERATION_MODEL`.

## 3. Paddle Billing

Set:
- `PADDLE_ENVIRONMENT=sandbox` for testing or `live` for production
- `PADDLE_API_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `VITE_PADDLE_ENVIRONMENT=sandbox` for testing or omit it for live
- `VITE_PADDLE_CLIENT_TOKEN`

Create recurring Paddle Prices for the Starter/Creator/Pro/Agency plans and store their IDs in `plans.paddle_price_id`. Create one-time Paddle Prices for the seeded credit packs and store them in `credit_packs.paddle_price_id`.

The authenticated server creates Paddle transactions and places the app user ID, plan/pack information, and type in Paddle `custom_data`. The browser opens the server-created transaction through Paddle.js; the browser never chooses the price directly.

Configure a Paddle notification destination at:

    https://YOUR-DOMAIN/api/paddle/webhook

Subscribe it to transaction completion and subscription lifecycle events used by the application, including `transaction.completed`, `subscription.activated`, `subscription.updated`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, and `subscription.canceled`.

The webhook verifies Paddle's signature before changing subscription state or credits and records event IDs for idempotency. Initial subscription credits come from the initial completed checkout; recurring subscription transactions are handled separately so plan changes do not accidentally grant monthly credits.

The Manage Billing button uses Paddle Customer Portal sessions. Use the Paddle sandbox client token and sandbox API credentials together during testing; do not mix sandbox and live credentials.

## 4. Privacy, bot protection and analytics

Add `VITE_CF_WEB_ANALYTICS_TOKEN` with the Cloudflare Web Analytics site token. The app respects the analytics consent choice before loading the beacon.

For bot protection, create a Cloudflare Turnstile site, set `VITE_TURNSTILE_SITE_KEY`, and enable CAPTCHA protection in Supabase Auth using Turnstile. The frontend passes the challenge token to Supabase Auth auth flows.

Never put `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `SHOTSTACK_API_KEY`, or other server credentials in `VITE_*` variables. The Paddle browser value is only the public client token.

## 5. Production hardening

Do not commit real provider secrets. Use `.env.example` as the configuration template. Rotate any provider secret that was previously committed.
