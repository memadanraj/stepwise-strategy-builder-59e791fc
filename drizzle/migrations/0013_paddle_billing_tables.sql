alter table public.plans add column if not exists paddle_price_id text;
alter table public.credit_packs add column if not exists paddle_price_id text;

create table if not exists public.paddle_customers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  paddle_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.paddle_customers to authenticated;
grant all on public.paddle_customers to service_role;
alter table public.paddle_customers enable row level security;
create policy "Users can read own paddle customer" on public.paddle_customers for select to authenticated using (auth.uid() = user_id);

create table if not exists public.paddle_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paddle_customer_id text not null,
  paddle_subscription_id text not null unique,
  plan_slug text not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.paddle_subscriptions to authenticated;
grant all on public.paddle_subscriptions to service_role;
alter table public.paddle_subscriptions enable row level security;
create policy "Users can read own paddle subscriptions" on public.paddle_subscriptions for select to authenticated using (auth.uid() = user_id);