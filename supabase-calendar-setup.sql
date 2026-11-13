-- Shared couple calendar events. Run once in Supabase SQL Editor.
create table if not exists public.couple_calendar_events (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null default public.current_couple_id()
        references public.couples(id) on delete cascade,
    title text not null check (length(btrim(title)) > 0),
    event_date date not null,
    type text not null default 'plan'
        check (type in ('plan', 'birthday', 'anniversary', 'trip')),
    note text not null default '',
    is_annual boolean not null default false,
    created_by uuid not null default auth.uid() references auth.users(id),
    created_at timestamptz not null default now()
);

alter table public.couple_calendar_events enable row level security;
revoke all on public.couple_calendar_events from public, anon, authenticated;
grant select, insert, delete on public.couple_calendar_events to authenticated;

drop policy if exists "Couple members can read calendar events" on public.couple_calendar_events;
create policy "Couple members can read calendar events"
    on public.couple_calendar_events for select to authenticated
    using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can add calendar events" on public.couple_calendar_events;
create policy "Couple members can add calendar events"
    on public.couple_calendar_events for insert to authenticated
    with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
        and created_by = (select auth.uid())
    );

drop policy if exists "Couple members can delete calendar events" on public.couple_calendar_events;
create policy "Couple members can delete calendar events"
    on public.couple_calendar_events for delete to authenticated
    using (public.is_couple_member(couple_id));

create index if not exists couple_calendar_events_date_idx
    on public.couple_calendar_events (couple_id, event_date);
