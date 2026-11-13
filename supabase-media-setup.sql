-- Run once in the NEW Supabase project after supabase-private-setup.sql.
-- Private gallery files and metadata are available only to the linked couple accounts.

create table if not exists public.couple_memories (
    id uuid primary key default gen_random_uuid(),
    couple_id uuid not null default public.current_couple_id()
        references public.couples(id) on delete cascade,
    title text not null default '',
    subtitle text not null default '',
    category text not null default 'us'
        check (category in ('us', 'dates', 'special-days', 'videos')),
    media_type text not null check (media_type in ('image', 'video')),
    file_path text not null unique,
    created_at timestamptz not null default now(),
    uploaded_by uuid not null default auth.uid()
        references auth.users(id) on delete cascade
);

alter table public.couple_memories enable row level security;
revoke all on public.couple_memories from public, anon, authenticated;
grant select, insert, delete on public.couple_memories to authenticated;

drop policy if exists "Couple members can read their gallery" on public.couple_memories;
create policy "Couple members can read their gallery"
    on public.couple_memories for select to authenticated
    using (public.is_couple_member(couple_id));

drop policy if exists "Couple members can add their gallery media" on public.couple_memories;
create policy "Couple members can add their gallery media"
    on public.couple_memories for insert to authenticated
    with check (
        public.is_couple_member(couple_id)
        and uploaded_by = (select auth.uid())
    );

drop policy if exists "Couple members can delete their gallery media" on public.couple_memories;
create policy "Couple members can delete their gallery media"
    on public.couple_memories for delete to authenticated
    using (public.is_couple_member(couple_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'couple-memories',
    'couple-memories',
    false,
    52428800,
    array['image/*', 'video/*']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Couple members can read their private gallery files" on storage.objects;
create policy "Couple members can read their private gallery files"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'couple-memories'
        and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    );

drop policy if exists "Couple members can upload their private gallery files" on storage.objects;
create policy "Couple members can upload their private gallery files"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'couple-memories'
        and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    );

drop policy if exists "Couple members can delete their private gallery files" on storage.objects;
create policy "Couple members can delete their private gallery files"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'couple-memories'
        and (storage.foldername(name))[1] = (select public.current_couple_id())::text
    );
