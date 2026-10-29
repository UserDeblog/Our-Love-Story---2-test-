-- Private couple data for the Our Love Story app.
-- Run in Supabase Dashboard > SQL Editor on the NEW project only.
-- The first Auth user ID below is Samuel's; the second is his partner's.
-- This script grants no access to anon/public users.

create table if not exists public.couples (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
    couple_id uuid not null references public.couples(id) on delete cascade,
    user_id uuid not null unique references auth.users(id) on delete cascade,
    display_name text not null,
    created_at timestamptz not null default now(),
    primary key (couple_id, user_id)
);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
revoke all on public.couples, public.couple_members from public, anon, authenticated;
grant select on public.couple_members to authenticated;

create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select m.couple_id
    from public.couple_members as m
    where m.user_id = (select auth.uid())
    limit 1;
$$;

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.couple_members as m
        where m.couple_id = target_couple_id
          and m.user_id = (select auth.uid())
    );
$$;

create or replace function public.is_gallery_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.couple_members as m
        where m.user_id = (select auth.uid())
    );
$$;

revoke all on function public.current_couple_id() from public, anon;
revoke all on function public.is_couple_member(uuid) from public, anon;
revoke all on function public.is_gallery_admin() from public, anon;
grant execute on function public.current_couple_id() to authenticated;
grant execute on function public.is_couple_member(uuid) to authenticated;
grant execute on function public.is_gallery_admin() to authenticated;

drop policy if exists "Members can view their own couple membership" on public.couple_members;
create policy "Members can view their own couple membership"
    on public.couple_members for select to authenticated
    using (user_id = (select auth.uid()) or public.is_couple_member(couple_id));

create table if not exists public.love_letters (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null default public.current_couple_id() references public.couples(id) on delete cascade,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    message text not null check (pg_catalog.length(pg_catalog.btrim(message)) > 0),
    open_on date,
    author text not null default 'Nós dois',
    editable boolean not null default true,
    deletable boolean not null default true,
    created_at timestamptz not null default now()
);
alter table public.love_letters enable row level security;
revoke all on public.love_letters from public, anon, authenticated;
grant select, insert, update, delete on public.love_letters to authenticated;

drop policy if exists "Couple members can read letters" on public.love_letters;
create policy "Couple members can read letters" on public.love_letters
    for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists "Couple members can create letters" on public.love_letters;
create policy "Couple members can create letters" on public.love_letters
    for insert to authenticated with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
    );
drop policy if exists "Couple members can edit permitted letters" on public.love_letters;
create policy "Couple members can edit permitted letters" on public.love_letters
    for update to authenticated
    using (public.is_couple_member(couple_id) and editable)
    with check (public.is_couple_member(couple_id));
drop policy if exists "Couple members can delete permitted letters" on public.love_letters;
create policy "Couple members can delete permitted letters" on public.love_letters
    for delete to authenticated using (public.is_couple_member(couple_id) and deletable);

create table if not exists public.love_capsules (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null default public.current_couple_id() references public.couples(id) on delete cascade,
    title text not null check (pg_catalog.length(pg_catalog.btrim(title)) > 0),
    open_on date not null,
    author text not null default 'Nós dois',
    created_at timestamptz not null default now()
);
create table if not exists public.love_capsule_contents (
    capsule_id uuid primary key references public.love_capsules(id) on delete cascade,
    message text not null check (pg_catalog.length(pg_catalog.btrim(message)) > 0)
);
alter table public.love_capsules enable row level security;
alter table public.love_capsule_contents enable row level security;
revoke all on public.love_capsules, public.love_capsule_contents from public, anon, authenticated;
grant select, insert, update, delete on public.love_capsules to authenticated;
grant select, insert, delete on public.love_capsule_contents to authenticated;

drop policy if exists "Couple members can read capsule dates" on public.love_capsules;
create policy "Couple members can read capsule dates" on public.love_capsules
    for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists "Couple members can create capsules" on public.love_capsules;
create policy "Couple members can create capsules" on public.love_capsules
    for insert to authenticated with check (
        public.is_couple_member(couple_id)
        and couple_id = (select public.current_couple_id())
    );
drop policy if exists "Couple members can update capsules" on public.love_capsules;
create policy "Couple members can update capsules" on public.love_capsules
    for update to authenticated
    using (public.is_couple_member(couple_id))
    with check (public.is_couple_member(couple_id));
drop policy if exists "Couple members can delete capsules" on public.love_capsules;
create policy "Couple members can delete capsules" on public.love_capsules
    for delete to authenticated using (public.is_couple_member(couple_id));

drop policy if exists "Members can add capsule contents" on public.love_capsule_contents;
create policy "Members can add capsule contents" on public.love_capsule_contents
    for insert to authenticated with check (
        exists (
            select 1 from public.love_capsules as c
            where c.id = capsule_id
              and c.couple_id = (select public.current_couple_id())
        )
    );
drop policy if exists "Members can read opened capsule contents" on public.love_capsule_contents;
create policy "Members can read opened capsule contents" on public.love_capsule_contents
    for select to authenticated using (
        exists (
            select 1 from public.love_capsules as c
            where c.id = capsule_id
              and c.couple_id = (select public.current_couple_id())
              and c.open_on <= current_date
        )
    );
drop policy if exists "Members can delete capsule contents" on public.love_capsule_contents;
create policy "Members can delete capsule contents" on public.love_capsule_contents
    for delete to authenticated using (
        exists (
            select 1 from public.love_capsules as c
            where c.id = capsule_id
              and c.couple_id = (select public.current_couple_id())
        )
    );

create table if not exists public.location_shares (
    user_id uuid primary key references auth.users(id) on delete cascade,
    couple_id uuid not null default public.current_couple_id() references public.couples(id) on delete cascade,
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
    sharing boolean not null default false,
    updated_at timestamptz not null default now(),
    constraint location_share_owner_is_member check (user_id is not null)
);
alter table public.location_shares enable row level security;
revoke all on public.location_shares from public, anon, authenticated;
grant select, insert, update, delete on public.location_shares to authenticated;

drop policy if exists "Members can read own or shared partner location" on public.location_shares;
create policy "Members can read own or shared partner location" on public.location_shares
    for select to authenticated using (
        user_id = (select auth.uid())
        or (
            sharing
            and couple_id = (select public.current_couple_id())
        )
    );
drop policy if exists "Members can publish their own location" on public.location_shares;
create policy "Members can publish their own location" on public.location_shares
    for insert to authenticated with check (
        user_id = (select auth.uid())
        and couple_id = (select public.current_couple_id())
    );
drop policy if exists "Members can update their own location" on public.location_shares;
create policy "Members can update their own location" on public.location_shares
    for update to authenticated
    using (user_id = (select auth.uid()) and couple_id = (select public.current_couple_id()))
    with check (user_id = (select auth.uid()) and couple_id = (select public.current_couple_id()));
drop policy if exists "Members can delete their own location" on public.location_shares;
create policy "Members can delete their own location" on public.location_shares
    for delete to authenticated using (user_id = (select auth.uid()));

-- Pair the two Auth users. Run once after both users exist in Authentication > Users.
-- If either ID is wrong or already belongs to a different pair, the transaction fails.
do $$
declare
    pair_id uuid;
begin
    if exists (
        select 1 from public.couple_members
        where user_id in (
            '3ed8a724-408e-4c0d-bb18-79c7c2d14b4f'::uuid,
            '02ad3f04-3273-4b88-8d5d-79ee6f837a03'::uuid
        )
    ) then
        raise exception 'One or both accounts are already linked to a couple; check couple_members before retrying.';
    end if;

    insert into public.couples default values returning id into pair_id;
    insert into public.couple_members (couple_id, user_id, display_name) values
        (pair_id, '3ed8a724-408e-4c0d-bb18-79c7c2d14b4f'::uuid, 'Você'),
        (pair_id, '02ad3f04-3273-4b88-8d5d-79ee6f837a03'::uuid, 'Ela');
end
$$;
