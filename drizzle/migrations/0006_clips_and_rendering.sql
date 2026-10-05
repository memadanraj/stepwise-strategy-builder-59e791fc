-- Phase 07: AI scene clips
alter table public.scenes add column if not exists clip_path text;

insert into public.ai_tasks (slug, name, description, model, credit_cost, is_active)
values ('generate_clip', 'Scene clip', 'AI video clip for a scene', 'google/veo-3.1-lite', 150, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    model = excluded.model,
    credit_cost = excluded.credit_cost,
    is_active = excluded.is_active;

-- Phase 10: Rendering + Cloud Export
create table if not exists public.render_presets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  width integer not null check (width between 320 and 7680),
  height integer not null check (height between 320 and 7680),
  fps integer not null check (fps in (24,25,30,50,60)),
  video_codec text not null default 'h264',
  audio_codec text not null default 'aac',
  video_bitrate_kbps integer not null default 8000 check (video_bitrate_kbps between 500 and 100000),
  audio_bitrate_kbps integer not null default 192 check (audio_bitrate_kbps between 32 and 1024),
  container text not null default 'mp4' check (container in ('mp4','webm')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.render_presets to authenticated;
grant all on public.render_presets to service_role;
alter table public.render_presets enable row level security;
drop policy if exists "Users manage own render presets" on public.render_presets;
create policy "Users manage own render presets" on public.render_presets for all to authenticated
using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create table if not exists public.timeline_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  fps integer not null default 30 check (fps in (24,25,30,50,60)),
  width integer not null default 1920 check (width between 320 and 7680),
  height integer not null default 1080 check (height between 320 and 7680),
  snap_enabled boolean not null default true,
  grid_seconds numeric not null default 1 check (grid_seconds > 0 and grid_seconds <= 10),
  caption_style jsonb not null default '{"font":"Inter","size":54,"position":"bottom","max_words":5}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.timeline_settings to authenticated;
grant all on public.timeline_settings to service_role;
alter table public.timeline_settings enable row level security;
drop policy if exists "Users manage own timeline settings" on public.timeline_settings;
create policy "Users manage own timeline settings" on public.timeline_settings for all to authenticated
using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create table if not exists public.timeline_tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  track_type text not null check (track_type in ('video','audio','caption','overlay')),
  position integer not null default 0,
  muted boolean not null default false,
  locked boolean not null default false,
  visible boolean not null default true,
  volume numeric not null default 1 check (volume between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.timeline_tracks to authenticated;
grant all on public.timeline_tracks to service_role;
alter table public.timeline_tracks enable row level security;
drop policy if exists "Users manage own timeline tracks" on public.timeline_tracks;
create policy "Users manage own timeline tracks" on public.timeline_tracks for all to authenticated
using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create table if not exists public.timeline_clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  track_id uuid not null references public.timeline_tracks(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  clip_type text not null check (clip_type in ('video','image','voice','music','sfx','overlay')),
  start_seconds numeric not null default 0 check (start_seconds >= 0),
  duration_seconds numeric not null default 1 check (duration_seconds > 0),
  source_start_seconds numeric not null default 0 check (source_start_seconds >= 0),
  playback_rate numeric not null default 1 check (playback_rate > 0 and playback_rate <= 4),
  volume numeric not null default 1 check (volume between 0 and 2),
  opacity numeric not null default 1 check (opacity between 0 and 1),
  transition_in text,
  transition_out text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.timeline_clips to authenticated;
grant all on public.timeline_clips to service_role;
alter table public.timeline_clips enable row level security;
drop policy if exists "Users manage own timeline clips" on public.timeline_clips;
create policy "Users manage own timeline clips" on public.timeline_clips for all to authenticated
using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete set null,
  text text not null,
  start_seconds numeric not null check (start_seconds >= 0),
  end_seconds numeric not null check (end_seconds > start_seconds),
  style jsonb not null default '{}'::jsonb,
  position text not null default 'bottom' check (position in ('top','center','bottom')),
  words jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select,insert,update,delete on public.captions to authenticated;
grant all on public.captions to service_role;
alter table public.captions enable row level security;
drop policy if exists "Users manage own captions" on public.captions;
create policy "Users manage own captions" on public.captions for all to authenticated
using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preset_id uuid references public.render_presets(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  provider text not null default 'cloud',
  provider_job_id text,
  progress numeric not null default 0 check (progress between 0 and 100),
  input_manifest jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select,insert,update on public.render_jobs to authenticated;
grant all on public.render_jobs to service_role;
alter table public.render_jobs enable row level security;
drop policy if exists "Users read own render jobs" on public.render_jobs;
drop policy if exists "Users create own render jobs" on public.render_jobs;
create policy "Users read own render jobs" on public.render_jobs for select to authenticated using (auth.uid()=user_id);
create policy "Users create own render jobs" on public.render_jobs for insert to authenticated
with check (auth.uid()=user_id and public.owns_project(project_id));

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  render_job_id uuid not null references public.render_jobs(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  format text not null,
  storage_path text,
  filename text not null,
  size_bytes bigint,
  duration_seconds numeric,
  width integer,
  height integer,
  fps integer,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select,insert,update on public.exports to authenticated;
grant all on public.exports to service_role;
alter table public.exports enable row level security;
drop policy if exists "Users read own exports" on public.exports;
create policy "Users read own exports" on public.exports for select to authenticated using (public.owns_project(project_id));

insert into public.ai_tasks (slug,name,description,model,credit_cost,is_active)
values ('render_video','Video render','Render the project timeline to an export','cloud-renderer',0,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,model=excluded.model,credit_cost=excluded.credit_cost,is_active=excluded.is_active;
