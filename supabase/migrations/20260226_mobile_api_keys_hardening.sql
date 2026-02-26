-- Mobile API key hardening: optimize active-key lookups

create index if not exists mobile_api_keys_active_user_idx
on public.mobile_api_keys(user_id, created_at desc)
where revoked_at is null;