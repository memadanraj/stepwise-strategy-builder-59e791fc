# Reelforge — Integration Setup

This repository now includes the Phase 07 AI scene-clip fix and Phase 10 rendering/export flow.

## 1. Database

Apply the new migration after the existing migrations:

    drizzle/migrations/0006_clips_and_rendering.sql

It adds scenes.clip_path, the generate_clip AI task using google/veo-3.1-lite, and the rendering/export tables.

The migration is registered in drizzle/migrations/meta/_journal.json.

## 2. AI scene clips

Set:

- LOVABLE_API_KEY

Clip generation is asynchronous: create a video job, poll until it completes, obtain the returned media URL when available, and fall back to the Lovable video content endpoint when the URL cannot be fetched.

Scene duration maps to valid video durations of 4, 6, or 8 seconds. Short projects use vertical output and long projects use widescreen output.

## 3. Final rendering

Set:

- SHOTSTACK_API_KEY
- SHOTSTACK_ENV=stage for testing or production for production

The app signs private Supabase Storage assets before sending them to Shotstack. A project can be rendered directly from scenes even before a full timeline editor exists; the renderer falls back to scenes in position order.

An optional custom renderer can be used instead:

- RENDERER_URL
- RENDERER_API_KEY

## 4. Exports

Completed renderer output is downloaded server-side, stored under the user's project in the private project-assets bucket, registered as an asset/export, and exposed to the authenticated user through a short-lived signed download URL.

Do not commit real secrets.
