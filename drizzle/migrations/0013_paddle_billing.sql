-- Phase 14: replace Stripe billing storage with Paddle Billing storage
alter table public.plans add column if not exists paddle_price_id text;
alter table public.credit_packs add column if not exists paddle_price_id text;

do $$
begin
  if to_regclass('public.stripe_customers') is not null and to_regclass('public.paddle_customers') is null then alter table public.stripe_customers rename to paddle_customers; end if;
  if to_regclass('public.stripe_subscriptions') is not null and to_regclass('public.paddle_subscriptions') is null then alter table public.stripe_subscriptions rename to paddle_subscriptions; end if;
end $$;

do $$
begin
  if to_regclass('public.paddle_customers') is not null and exists (select 1 from information_schema.columns where table_schema='public' and table_name='paddle_customers' and column_name='stripe_customer_id') then alter table public.paddle_customers rename column stripe_customer_id to paddle_customer_id; end if;
  if to_regclass('public.paddle_subscriptions') is not null and exists (select 1 from information_schema.columns where table_schema='public' and table_name='paddle_subscriptions' and column_name='stripe_customer_id') then alter table public.paddle_subscriptions rename column stripe_customer_id to paddle_customer_id; end if;
  if to_regclass('public.paddle_subscriptions') is not null and exists (select 1 from information_schema.columns where table_schema='public' and table_name='paddle_subscriptions' and column_name='stripe_subscription_id') then alter table public.paddle_subscriptions rename column stripe_subscription_id to paddle_subscription_id; end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='billing_events' and column_name='stripe_event_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='billing_events' and column_name='paddle_event_id')
  then alter table public.billing_events rename column stripe_event_id to paddle_event_id; end if;
end $$;

alter index if exists public.stripe_subscriptions_user_idx rename to paddle_subscriptions_user_idx;

alter table public.paddle_customers enable row level security;
alter table public.paddle_subscriptions enable row level security;
drop policy if exists "Users read own Stripe customer" on public.paddle_customers;
drop policy if exists "Users read own Paddle customer" on public.paddle_customers;
create policy "Users read own Paddle customer" on public.paddle_customers for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users read own Stripe subscriptions" on public.paddle_subscriptions;
drop policy if exists "Users read own Paddle subscriptions" on public.paddle_subscriptions;
create policy "Users read own Paddle subscriptions" on public.paddle_subscriptions for select to authenticated using (auth.uid() = user_id);
grant select on public.paddle_customers to authenticated;
grant all on public.paddle_customers to service_role;
grant select on public.paddle_subscriptions to authenticated;
grant all on public.paddle_subscriptions to service_role;
grant all on public.billing_events to service_role;
