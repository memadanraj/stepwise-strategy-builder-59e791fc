# Reelforge — Integration Setup

The repository contains the Phase 06–15 application implementation. External providers still require their own credentials, service configuration, and Paddle product/price IDs.

## 1. Apply database migrations

Apply migrations in order. The billing provider migration is:

- `drizzle/migrations/0010_billing.sql` — original billing tables and seeded credit packs
- `drizzle/migrations/0013_paddle_billing.sql` — renames active Stripe billing tables to Paddle names and adds Paddle price IDs

Do not edit an already-applied migration in place. The Paddle migration is intentionally additive/rename-based so existing billing data is preserved when moving the schema forward.

## 2. AI visuals and clips

Set `LOVABLE_API_KEY` and the provider keys required by the existing AI, audio, rendering, and YouTube features.

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

## 4. Production hardening

Do not commit real provider secrets. Use `.env.example` as the configuration template. Rotate any provider secret that was previously committed.
