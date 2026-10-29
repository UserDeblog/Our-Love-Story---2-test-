-- Run once in the new Supabase project after supabase-private-setup.sql.
-- Only the two members of the couple can read or edit this shared note.

create table if not exists public.couple_notes (
    couple_id uuid primary key references public.couples(id) on delete cascade,
    note text not null check (
        pg_catalog.length(pg_catalog.btrim(note)) between 1 and 1000
    ),
    updated_by uuid not null references auth.users(id) on delete restrict,
    updated_at timestamptz not null default now()
);

alter table public.couple_notes enable row level security;
revoke all on public.couple_notes from public, anon, authenticated;
grant select, insert, update on public.couple_notes to authenticated;

drop policy if exists "Couple members can read their note" on public.couple_notes;
create policy "Couple members can read their note" on public.couple_notes
    for select to authenticated
    using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can create their note" on public.couple_notes;
create policy "Couple members can create their note" on public.couple_notes
    for insert to authenticated
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
        and updated_by = (select auth.uid())
    );

drop policy if exists "Couple members can update their note" on public.couple_notes;
create policy "Couple members can update their note" on public.couple_notes
    for update to authenticated
    using (public.is_couple_member(couple_id))
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
        and updated_by = (select auth.uid())
    );
