create table if not exists public.revforge_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb check (octet_length(data::text) < 2000000),
 updated_at timestamptz not null default now()
);
alter table public.revforge_profiles enable row level security;
create policy "Owners read their garage" on public.revforge_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners create their garage" on public.revforge_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update their garage" on public.revforge_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
