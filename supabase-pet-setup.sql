-- Shared care state for the couple's virtual pet. Run once in Supabase SQL Editor.
create table if not exists public.couple_pet_state (
    couple_id uuid primary key default public.current_couple_id()
        references public.couples(id) on delete cascade,
    pet_name text not null default 'Pipoca' check (length(btrim(pet_name)) between 1 and 18),
    food integer not null default 82 check (food between 0 and 100),
    water integer not null default 86 check (water between 0 and 100),
    joy integer not null default 88 check (joy between 0 and 100),
    energy integer not null default 78 check (energy between 0 and 100),
    last_tick timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.couple_pet_state enable row level security;
revoke all on public.couple_pet_state from public, anon, authenticated;
grant select, insert, update on public.couple_pet_state to authenticated;

drop policy if exists "Couple members can read pet state" on public.couple_pet_state;
create policy "Couple members can read pet state"
    on public.couple_pet_state for select to authenticated
    using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can create pet state" on public.couple_pet_state;
create policy "Couple members can create pet state"
    on public.couple_pet_state for insert to authenticated
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
    );

drop policy if exists "Couple members can update pet state" on public.couple_pet_state;
create policy "Couple members can update pet state"
    on public.couple_pet_state for update to authenticated
    using (public.is_couple_member(couple_id))
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
    );
