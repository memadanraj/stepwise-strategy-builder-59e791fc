alter table public.projects add column if not exists visual_style text not null default 'cinematic';
alter table public.scenes add column if not exists image_path text;
alter table public.scenes add column if not exists clip_path text;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  visual_notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.characters to authenticated;
grant all on public.characters to service_role;

alter table public.characters enable row level security;

create policy "Users manage characters in own projects"
on public.characters for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

insert into public.ai_tasks (slug, name, description, model, credit_cost) values
  ('generate_image', 'Scene image', 'Generate an AI image for a scene', 'openai/gpt-image-2', 4),
  ('generate_clip', 'Scene clip', 'Generate an AI video clip for a scene', 'google/veo-3.1-lite', 25)
on conflict (slug) do update set model = excluded.model, credit_cost = excluded.credit_cost;