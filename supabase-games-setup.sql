-- Shared, editable game questions for each couple. Run once in Supabase SQL Editor.
-- Requires the couples/couple_members tables and current_couple_id()/is_couple_member() functions
-- from supabase-private-setup.sql.
create table if not exists public.couple_game_settings (
    couple_id uuid primary key default public.current_couple_id()
        references public.couples(id) on delete cascade,
    game_content jsonb not null default '{}'::jsonb
        check (jsonb_typeof(game_content) = 'object'),
    updated_at timestamptz not null default now()
);

alter table public.couple_game_settings enable row level security;
revoke all on public.couple_game_settings from public, anon, authenticated;
grant select, insert, update on public.couple_game_settings to authenticated;

drop policy if exists "Couple members can read game settings" on public.couple_game_settings;
create policy "Couple members can read game settings"
    on public.couple_game_settings for select to authenticated
    using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can create game settings" on public.couple_game_settings;
create policy "Couple members can create game settings"
    on public.couple_game_settings for insert to authenticated
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
    );

drop policy if exists "Couple members can update game settings" on public.couple_game_settings;
create policy "Couple members can update game settings"
    on public.couple_game_settings for update to authenticated
    using (public.is_couple_member(couple_id))
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
    );
