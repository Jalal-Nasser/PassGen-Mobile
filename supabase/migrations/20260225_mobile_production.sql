-- PassGen Mobile production tables and RLS

create table if not exists public.mobile_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  label text not null default 'mobile',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index if not exists mobile_api_keys_user_idx on public.mobile_api_keys(user_id, created_at desc);

alter table public.mobile_api_keys enable row level security;

drop policy if exists "mobile_api_keys_select_own" on public.mobile_api_keys;
create policy "mobile_api_keys_select_own"
on public.mobile_api_keys
for select
using (auth.uid() = user_id);

drop policy if exists "mobile_api_keys_insert_own" on public.mobile_api_keys;
create policy "mobile_api_keys_insert_own"
on public.mobile_api_keys
for insert
with check (auth.uid() = user_id);

drop policy if exists "mobile_api_keys_update_own" on public.mobile_api_keys;
create policy "mobile_api_keys_update_own"
on public.mobile_api_keys
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "mobile_api_keys_delete_own" on public.mobile_api_keys;
create policy "mobile_api_keys_delete_own"
on public.mobile_api_keys
for delete
using (auth.uid() = user_id);

create table if not exists public.mobile_subscription_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'cloud')),
  status text not null default 'inactive',
  expires_at timestamptz,
  source text not null default 'revenuecat',
  updated_at timestamptz not null default now()
);

alter table public.mobile_subscription_state enable row level security;

drop policy if exists "mobile_subscription_select_own" on public.mobile_subscription_state;
create policy "mobile_subscription_select_own"
on public.mobile_subscription_state
for select
using (auth.uid() = user_id);

drop policy if exists "mobile_subscription_insert_own" on public.mobile_subscription_state;
create policy "mobile_subscription_insert_own"
on public.mobile_subscription_state
for insert
with check (auth.uid() = user_id);

drop policy if exists "mobile_subscription_update_own" on public.mobile_subscription_state;
create policy "mobile_subscription_update_own"
on public.mobile_subscription_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_mobile_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_mobile_subscription_updated_at on public.mobile_subscription_state;
create trigger trg_touch_mobile_subscription_updated_at
before update on public.mobile_subscription_state
for each row
execute function public.touch_mobile_subscription_updated_at();
