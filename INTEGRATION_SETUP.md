# Reelforge — Integration Setup

The repository now contains the Phase 06–15 application implementation. External providers still require their own credentials, service configuration, and (for Stripe) real Price IDs.

## 1. Apply database migrations

The target repository keeps its existing merged Phase 07/10 migration at:

    drizzle/migrations/0006_clips_and_rendering.sql

Apply the added migrations after it, in order:

- drizzle/migrations/0007_audio_studio.sql
- drizzle/migrations/0008_thumbnail_tasks.sql
- drizzle/migrations/0009_youtube.sql
- drizzle/migrations/0010_billing.sql
- drizzle/migrations/0011_fix_ai_media_models.sql

The 0007 migration also completes the Phase 07 visual schema by adding `projects.visual_style`, `scenes.image_path`, and `characters`.

The timeline/caption/render tables are already present in the target's 0006 migration, so they are reused by Phase 09/10 rather than duplicated.

## 2. AI visuals and clips

Set:

- LOVABLE_API_KEY

The visual pipeline uses the Lovable AI Gateway. Scene image generation uses `openai/gpt-image-2`; scene clips use `google/veo-3.1-lite`.

Clip generation is asynchronous: create the video job, poll until it completes, use the returned media URL when available, and fall back to the gateway video-content endpoint when the direct URL cannot be fetched.

Scene duration maps to valid video durations of 4, 6, or 8 seconds. Short projects use vertical output; long projects use widescreen output.

## 3. Audio Studio

Set the provider key(s) for the features you intend to use:

- OPENAI_API_KEY for OpenAI text-to-speech
- ELEVENLABS_API_KEY for ElevenLabs voices, voice cloning, and music

Voice cloning is only intended for speakers for whom you have authorization.

## 4. Rendering and exports

Set:

- SHOTSTACK_API_KEY
- SHOTSTACK_ENV=stage for testing or production for production

Optional custom renderer fallback:

- RENDERER_URL
- RENDERER_API_KEY

Phase 10 signs private Supabase Storage assets before dispatching the render manifest. Completed renderer output is downloaded server-side, stored in the private project-assets bucket, registered as an export, and exposed through a short-lived signed URL.

## 5. YouTube

Enable YouTube Data API v3 and YouTube Analytics API in Google Cloud.

Set:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- YOUTUBE_OAUTH_REDIRECT_URI=https://YOUR-DOMAIN/youtube/callback
- YOUTUBE_TOKEN_ENCRYPTION_KEY

The encryption key must be base64-encoded 32 random bytes.

Register the exact redirect URI in the Google OAuth client. The app requests:

- youtube.upload
- youtube.readonly
- yt-analytics.readonly

Refresh/access tokens are encrypted at rest and are never returned to the browser.

Create a webhook route only for Stripe; YouTube uses the OAuth callback route at `/youtube/callback`.

## 6. Stripe billing

Set:

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Create recurring Stripe Prices for the Starter/Creator/Pro/Agency plans, then save their Price IDs:

    update public.plans set stripe_price_id = 'price_...' where slug = 'starter';
    update public.plans set stripe_price_id = 'price_...' where slug = 'creator';
    update public.plans set stripe_price_id = 'price_...' where slug = 'pro';
    update public.plans set stripe_price_id = 'price_...' where slug = 'agency';

Create one-time Stripe Prices for the seeded credit packs and save them:

    update public.credit_packs set stripe_price_id = 'price_...' where slug = 'credits-500';
    update public.credit_packs set stripe_price_id = 'price_...' where slug = 'credits-1500';
    update public.credit_packs set stripe_price_id = 'price_...' where slug = 'credits-5000';

Create a Stripe webhook pointing to:

    https://YOUR-DOMAIN/api/stripe/webhook

The handler verifies the Stripe signature and is idempotent by Stripe event ID. Existing active subscribers are routed through a Stripe subscription-item plan change instead of creating duplicate subscriptions. Initial subscription credits are not duplicated by the first `invoice.paid` event.

## 7. Optional Sentry monitoring

Set:

- SENTRY_DSN
- APP_NAME=Reelforge

The server reports unhandled/catastrophic errors to Sentry when a DSN is configured.

## 8. Production hardening

Server functions use a dependency-free per-IP/path rate limiter. Security headers and request IDs are applied centrally.

The in-process limiter is suitable for a single instance. For a multi-region deployment, replace it with a shared rate-limit store such as Workers KV, Redis, or a Durable Object.

Do not commit real provider secrets. Use `.env.example` as the configuration template. If a real secret was ever committed, rotate it before production deployment.
